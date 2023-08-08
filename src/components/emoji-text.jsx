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
      return (
        <img
          key={word}
          src={emoji.url}
          alt={word}
          class="shortcode-emoji emoji"
          width="12"
          height="12"
          loading="lazy"
          decoding="async"
        />
      );
    }
    return word;
  });
  return elements;
}

export default EmojiText;
