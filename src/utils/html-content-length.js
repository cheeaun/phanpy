const div = document.createElement('div');
export default function htmlContentLength(html) {
  if (!html) return 0;
  div.innerHTML = html;
  return div.innerText.length;
}
