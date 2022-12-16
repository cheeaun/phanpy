const div = document.createElement('div');
export default function htmlContentLength(html) {
  div.innerHTML = html;
  return div.innerText.length;
}
