const HTML_CHARS_REGEX = /[&<>"']/g;
const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

export default function escapeHTML(text) {
  return text.replace(HTML_CHARS_REGEX, (c) => HTML_ENTITIES[c]);
}
