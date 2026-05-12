const HTML_CHARS_REGEX = /[&<>"']/g;
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

export default function escapeHTML(text: string): string {
  return text.replace(HTML_CHARS_REGEX, (c) => HTML_ENTITIES[c]);
}
