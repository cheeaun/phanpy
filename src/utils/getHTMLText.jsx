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

  // MASTODON-SPECIFIC classes
  // Remove .invisible
  div.querySelectorAll('.invisible').forEach((el) => {
    el.remove();
  });
  // Add … at end of .ellipsis
  div.querySelectorAll('.ellipsis').forEach((el) => {
    el.append('...');
  });

  return div.innerText.replace(/[\r\n]{3,}/g, '\n\n').trim();
}

export default mem(getHTMLText);
