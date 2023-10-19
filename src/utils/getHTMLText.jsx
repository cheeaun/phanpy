import mem from './mem';

const div = document.createElement('div');
function getHTMLText(html) {
  if (!html) return '';
  div.innerHTML = html
    .replace(/<\/p>/g, '</p>\n\n')
    .replace(/<\/li>/g, '</li>\n');
  div.querySelectorAll('br').forEach((br) => {
    br.replaceWith('\n');
  });
  return div.innerText.replace(/[\r\n]{3,}/g, '\n\n').trim();
}

export default mem(getHTMLText);
