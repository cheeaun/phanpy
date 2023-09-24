function EmojiText({ text, emojis }) {
  if (!text) return '';
  if (!emojis?.length) return text;
  if (text.indexOf(':') === -1) return text;
  const regex = new RegExp(
    `:(${emojis.map((e) => e.shortcode).join('|')}):`,
    'g',
  );
  const elements = text.split(regex).map((word) => {
    const emoji = emojis.find((e) => e.shortcode === word);
    if (emoji) {
      const { url, staticUrl } = emoji;
      return (
        <picture>
          <source srcset={staticUrl} media="(prefers-reduced-motion: reduce)" />
          <img
            key={word}
            src={url}
            alt={word}
            class="shortcode-emoji emoji"
            width="16"
            height="16"
            loading="lazy"
            decoding="async"
          />
        </picture>
      );
    }
    return word;
  });
  return elements;
}

export default EmojiText;
