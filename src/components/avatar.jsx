import './avatar.css';

import { useRef } from 'preact/hooks';

const SIZES = {
  s: 16,
  m: 20,
  l: 24,
  xl: 32,
  xxl: 50,
  xxxl: 64,
};

const alphaCache = {};

function Avatar({ url, size, alt = '', ...props }) {
  size = SIZES[size] || size || SIZES.m;
  const avatarRef = useRef();
  return (
    <span
      ref={avatarRef}
      class={`avatar ${alphaCache[url] ? 'has-alpha' : ''}`}
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
          crossOrigin={alphaCache[url] === undefined ? 'anonymous' : undefined}
          onError={(e) => {
            e.target.crossOrigin = null;
            e.target.src = url;
          }}
          onLoad={(e) => {
            if (avatarRef.current) avatarRef.current.dataset.loaded = true;
            try {
              // Check if image has alpha channel
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              canvas.width = e.target.width;
              canvas.height = e.target.height;
              ctx.drawImage(e.target, 0, 0);
              const allPixels = ctx.getImageData(
                0,
                0,
                canvas.width,
                canvas.height,
              );
              const hasAlpha = allPixels.data.some((pixel, i) => {
                return i % 4 === 3 && pixel !== 255;
              });
              if (hasAlpha) {
                avatarRef.current.classList.add('has-alpha');
                alphaCache[url] = true;
              }
            } catch (e) {
              // Ignore
            }
          }}
        />
      )}
    </span>
  );
}

export default Avatar;
