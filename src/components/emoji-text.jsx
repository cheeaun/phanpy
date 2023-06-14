function EmojiText({ text, emojis }) {
  if (!text) return '';
  if (!emojis?.length) return text;
  if (text.indexOf(':') === -1) return text;

  const components = [];
  let lastIndex = 0;

  emojis.forEach((shortcodeObj) => {
    const { shortcode, staticUrl, url } = shortcodeObj;
    const regex = new RegExp(`:${shortcode}:`, 'g');
    let match;

    while ((match = regex.exec(text))) {
      const beforeText = text.substring(lastIndex, match.index);
      if (beforeText) {
        components.push(beforeText);
      }
      components.push(
        <img
          src={url}
          alt={shortcode}
          class="shortcode-emoji emoji"
          width="12"
          height="12"
          loading="lazy"
          decoding="async"
        />,
      );
      lastIndex = match.index + match[0].length;
    }
  });

  const afterText = text.substring(lastIndex);
  if (afterText) {
    components.push(afterText);
  }

  return components;
}

export default EmojiText;
