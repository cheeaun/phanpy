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

const alphaCache = {};

const canvas = window.OffscreenCanvas
  ? new OffscreenCanvas(1, 1)
  : document.createElement('canvas');
const ctx = canvas.getContext('2d', {
  willReadFrequently: true,
});

function Avatar({ url, size, alt = '', squircle, ...props }) {
  size = SIZES[size] || size || SIZES.m;
  const avatarRef = useRef();
  const isMissing = /missing\.png$/.test(url);
  return (
    <span
      ref={avatarRef}
      class={`avatar ${squircle ? 'squircle' : ''} ${
        alphaCache[url] ? 'has-alpha' : ''
      }`}
      style={{
        width: size,
        height: size,
      }}
      title={alt}
      {...props}
    >
      {!!url && (
        <img
          src={url}
          width={size}
          height={size}
          alt={alt}
          loading="lazy"
          decoding="async"
          crossOrigin={
            alphaCache[url] === undefined && !isMissing
              ? 'anonymous'
              : undefined
          }
          onError={(e) => {
            if (e.target.crossOrigin) {
              e.target.crossOrigin = null;
              e.target.src = url;
            }
          }}
          onLoad={(e) => {
            if (avatarRef.current) avatarRef.current.dataset.loaded = true;
            if (alphaCache[url] !== undefined) return;
            if (isMissing) return;
            try {
              // Check if image has alpha channel
              const { width, height } = e.target;
              if (canvas.width !== width) canvas.width = width;
              if (canvas.height !== height) canvas.height = height;
              ctx.drawImage(e.target, 0, 0);
              const allPixels = ctx.getImageData(0, 0, width, height);
              // At least 10% of pixels have alpha <= 128
              const hasAlpha =
                allPixels.data.filter((pixel, i) => i % 4 === 3 && pixel <= 128)
                  .length /
                  (allPixels.data.length / 4) >
                0.1;
              if (hasAlpha) {
                // console.log('hasAlpha', hasAlpha, allPixels.data);
                avatarRef.current.classList.add('has-alpha');
              }
              alphaCache[url] = hasAlpha;
              ctx.clearRect(0, 0, width, height);
            } catch (e) {
              // Silent fail
              alphaCache[url] = false;
            }
          }}
        />
      )}
    </span>
  );
}

export default mem(Avatar);
