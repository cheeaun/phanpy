function emojifyText(text, emojis = []) {
  if (!text) return '';
  if (!emojis.length) return text;
  if (text.indexOf(':') === -1) return text;
  // Replace shortcodes in text with emoji
  // emojis = [{ shortcode: 'smile', url: 'https://example.com/emoji.png' }]
  emojis.forEach((emoji) => {
    const { shortcode, staticUrl, url } = emoji;
    text = text.replace(
      new RegExp(`:${shortcode}:`, 'g'),
      `<picture><source srcset="${staticUrl}" media="(prefers-reduced-motion: reduce)"></source><img class="shortcode-emoji emoji" src="${url}" alt=":${shortcode}:" width="16" height="16" loading="lazy" decoding="async" /></picture>`,
    );
  });
  // console.log(text, emojis);
  return text;
}

export default emojifyText;
