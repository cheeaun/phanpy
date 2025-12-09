const ESCAPE_REGEX = /[.*+?^${}()|[\]\\]/g;
const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '"': '&quot;',
  '<': '&lt;',
  '>': '&gt;',
};
const HTML_ESCAPE_REGEX = /[&"<>]/g;

function escapeRegex(str) {
  return str.replace(ESCAPE_REGEX, '\\$&');
}

function escapeHTML(str) {
  return str.replace(HTML_ESCAPE_REGEX, (char) => HTML_ESCAPE_MAP[char]);
}

function emojifyText(text, emojis = []) {
  if (!text) return '';
  if (!emojis.length) return text;
  if (!text.includes(':')) return text;

  // Deduplicate emojis by shortcode and filter out invalid entries
  const emojiMap = new Map();
  for (let i = 0; i < emojis.length; i++) {
    const emoji = emojis[i];
    if (emoji?.shortcode && emoji?.url) {
      emojiMap.set(emoji.shortcode, emoji);
    }
  }

  if (emojiMap.size === 0) return text;

  const shortcodes = Array.from(emojiMap.keys());
  const pattern = shortcodes.map((sc) => `:${escapeRegex(sc)}:`).join('|');
  const regex = new RegExp(pattern, 'g');

  return text.replace(regex, (match) => {
    const shortcode = match.slice(1, -1);
    const emoji = emojiMap.get(shortcode);

    if (!emoji) return match;

    const { staticUrl, url } = emoji;
    const escapedShortcode = escapeHTML(match);

    const sourceTag = staticUrl
      ? `<source srcset="${staticUrl}" media="(prefers-reduced-motion: reduce)"></source>`
      : '';

    return `<picture>${sourceTag}<img class="shortcode-emoji emoji" src="${url}" alt="${escapedShortcode}" title="${shortcode}" width="16" height="16" loading="lazy" decoding="async" fetchPriority="low" onload="try { this.dataset.isLarger = this.naturalWidth > (this.width * 2) || this.naturalHeight > (this.height * 2) } catch (e) {}" /></picture>`;
  });
}

export default emojifyText;
