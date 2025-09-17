export default function CustomEmoji({ staticUrl, alt, url }) {
  return (
    <picture>
      {staticUrl && (
        <source srcset={staticUrl} media="(prefers-reduced-motion: reduce)" />
      )}
      <img
        key={alt || url}
        src={url}
        alt={alt}
        class="shortcode-emoji emoji"
        width="16"
        height="16"
        loading="lazy"
        decoding="async"
        fetchPriority="low"
        onLoad={(e) => {
          try {
            e.target.dataset.isLarger =
              e.target.naturalWidth > e.target.width * 2 ||
              e.target.naturalHeight > e.target.height * 2;
          } catch (e) {}
        }}
      />
    </picture>
  );
}
