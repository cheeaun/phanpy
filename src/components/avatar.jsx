import './avatar.css';

const SIZES = {
  s: 16,
  m: 20,
  l: 24,
  xl: 32,
  xxl: 50,
  xxxl: 64,
};

function Avatar({ url, size, alt = '', ...props }) {
  size = SIZES[size] || size || SIZES.m;
  return (
    <span
      class="avatar"
      style={{
        width: size,
        height: size,
      }}
      title={alt}
      {...props}
    >
      {!!url && (
        <img src={url} width={size} height={size} alt={alt} loading="lazy" />
      )}
    </span>
  );
}

export default Avatar;
