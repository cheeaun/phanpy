import './avatar.css';

import { memo } from 'preact/compat';
import { useRef } from 'preact/hooks';

const SIZES = {
  s: 16,
  m: 20,
  l: 24,
  xl: 32,
  xxl: 50,
  xxxl: 64,
};

const alphaCache = new Map();

const canvas = window.OffscreenCanvas
  ? new OffscreenCanvas(1, 1)
  : document.createElement('canvas');
const ctx = canvas.getContext('2d', {
  willReadFrequently: true,
});
ctx.imageSmoothingEnabled = false;

const scheduleTask =
  typeof requestIdleCallback === 'function'
    ? (fn) => requestIdleCallback(fn, { timeout: 500 })
    : (fn) => setTimeout(fn, 1);

function drawAndCountAlpha(img, sampleW, sampleH) {
  if (canvas.width !== sampleW) canvas.width = sampleW;
  if (canvas.height !== sampleH) canvas.height = sampleH;
  ctx.drawImage(img, 0, 0, sampleW, sampleH);
  const { data } = ctx.getImageData(0, 0, sampleW, sampleH);
  let alphaCount = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] <= 128) alphaCount++;
  }
  return alphaCount;
}

const MISSING_IMAGE_PATH_REGEX = /missing\.png$/;

function Avatar({ url, staticUrl, size, alt = '', squircle, ...props }) {
  if (!url) {
    url = staticUrl;
    staticUrl = undefined;
  }
  size = SIZES[size] || size || SIZES.m;
  const avatarRef = useRef();
  const isMissing = MISSING_IMAGE_PATH_REGEX.test(url);
  return (
    <picture
      ref={avatarRef}
      class={`avatar ${squircle ? 'squircle' : ''} ${
        alphaCache.get(url) ? 'has-alpha' : ''
      }`}
      style={{
        width: size,
        height: size,
      }}
      title={alt}
      {...props}
    >
      {!!staticUrl && (
        <source srcset={staticUrl} media="(prefers-reduced-motion: reduce)" />
      )}
      {!!url && (
        <img
          src={url}
          width={size}
          height={size}
          alt={alt}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          crossOrigin={
            !alphaCache.has(url) && !isMissing ? 'anonymous' : undefined
          }
          onError={(e) => {
            if (e.target.crossOrigin) {
              e.target.crossOrigin = null;
              e.target.src = url;
            }
          }}
          onLoad={(e) => {
            if (avatarRef.current) avatarRef.current.dataset.loaded = true;
            if (alphaCache.has(url)) return;
            if (isMissing) return;
            const img = e.target;
            const loadedSrc = img.currentSrc || img.src;
            scheduleTask(async () => {
              try {
                // <img> nodes can be reused; bail without caching if src changed
                if ((img.currentSrc || img.src) !== loadedSrc) return;
                await img.decode();
                if ((img.currentSrc || img.src) !== loadedSrc) return;
                if (!img.complete || !img.naturalWidth) return;
                // Check if image has alpha channel
                // Sample at reduced resolution to avoid processing large images
                const { naturalWidth: nw, naturalHeight: nh } = img;
                const scale = Math.min(1, SIZES.xxxl / Math.max(nw, nh));
                const sampleW = Math.max(1, Math.round(nw * scale));
                const sampleH = Math.max(1, Math.round(nh * scale));
                const totalPixels = sampleW * sampleH;
                const alphaCount = drawAndCountAlpha(img, sampleW, sampleH);
                // 100% transparent = blank draw, not alpha; don't cache
                if (alphaCount === totalPixels) return;
                // At least 10% of pixels have alpha <= 128
                const hasAlpha = alphaCount > totalPixels * 0.1;
                if (hasAlpha) {
                  // Draw again to confirm
                  if (drawAndCountAlpha(img, sampleW, sampleH) !== alphaCount)
                    return;
                  avatarRef.current?.classList.add('has-alpha');
                }
                alphaCache.set(url, hasAlpha);
              } catch (e) {
                // Silent fail (tainted canvas is permanent)
                if (e?.name === 'SecurityError') alphaCache.set(url, false);
              }
            });
          }}
        />
      )}
    </picture>
  );
}

export default memo(Avatar);
