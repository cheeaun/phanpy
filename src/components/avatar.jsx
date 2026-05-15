import './avatar.css';

import { useRef } from 'preact/hooks';

import mem from '../utils/mem';

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
            scheduleTask(() => {
              try {
                // Check if image has alpha channel
                // Sample at reduced resolution to avoid processing large images
                const { naturalWidth: nw, naturalHeight: nh } = e.target;
                const scale = Math.min(1, SIZES.xxxl / Math.max(nw, nh));
                const sampleW = Math.max(1, Math.round(nw * scale));
                const sampleH = Math.max(1, Math.round(nh * scale));
                if (canvas.width !== sampleW) canvas.width = sampleW;
                if (canvas.height !== sampleH) canvas.height = sampleH;
                ctx.drawImage(e.target, 0, 0, sampleW, sampleH);
                const { data } = ctx.getImageData(0, 0, sampleW, sampleH);
                // Early-exit loop: stop once 10% of pixels have alpha <= 128
                const totalPixels = data.length / 4;
                const threshold = totalPixels * 0.1;
                let alphaCount = 0;
                for (let i = 3; i < data.length; i += 4) {
                  if (data[i] <= 128 && ++alphaCount > threshold) break;
                }
                const hasAlpha = alphaCount > threshold;
                if (hasAlpha) {
                  avatarRef.current?.classList.add('has-alpha');
                }
                alphaCache.set(url, hasAlpha);
              } catch (e) {
                // Silent fail
                alphaCache.set(url, false);
              }
            });
          }}
        />
      )}
    </picture>
  );
}

export default mem(Avatar);
