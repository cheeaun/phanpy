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
        loading="lazy"
        decoding="async"
        fetchPriority="low"
      />
    </picture>
  );
}
