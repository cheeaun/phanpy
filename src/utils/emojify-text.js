function emojifyText(text, emojis = []) {
  if (!text) return '';
  if (!emojis.length) return text;
  // Replace shortcodes in text with emoji
  // emojis = [{ shortcode: 'smile', url: 'https://example.com/emoji.png' }]
  emojis.forEach((emoji) => {
    const { shortcode, staticUrl, url } = emoji;
    text = text.replace(
      new RegExp(`:${shortcode}:`, 'g'),
      `<img class="shortcode-emoji emoji" src="${url}" alt=":${shortcode}:" width="12" height="12" loading="lazy" />`,
    );
  });
  // console.log(text, emojis);
  return text;
}

export default emojifyText;
