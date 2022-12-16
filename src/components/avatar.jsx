import './avatar.css';

const SIZES = {
  s: 16,
  m: 20,
  l: 24,
  xl: 32,
  xxl: 50,
};

function Avatar({ url, size, alt = '' }) {
  size = SIZES[size] || size || SIZES.m;
  return (
    <span
      class="avatar"
      style={{
        width: size,
        height: size,
      }}
      title={alt}
    >
      {!!url && (
        <img src={url} width={size} height={size} alt={alt} loading="lazy" />
      )}
    </span>
  );
}

export default Avatar;
