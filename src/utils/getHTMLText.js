const template = document.createElement('template');

// Regex patterns for HTML text processing
const PARAGRAPH_END_RE = /<\/p>/g;
const LIST_ITEM_END_RE = /<\/li>/g;
const MULTIPLE_LINE_BREAKS_RE = /[\r\n]{3,}/g;
function getHTMLText(html, opts) {
  if (!html) return '';
  const { preProcess, truncateLinks = true } = opts || {};

  template.innerHTML = html
    .replace(PARAGRAPH_END_RE, '</p>\n\n')
    .replace(LIST_ITEM_END_RE, '</li>\n');

  const content = template.content;
  const brElements = content.querySelectorAll('br');
  for (let i = 0; i < brElements.length; i++) {
    brElements[i].replaceWith('\n');
  }

  preProcess?.(content);

  if (truncateLinks) {
    // MASTODON-SPECIFIC classes
    // Remove .invisible
    const invisibleElements = content.querySelectorAll('.invisible');
    for (let i = 0; i < invisibleElements.length; i++) {
      invisibleElements[i].remove();
    }
    // Add … at end of .ellipsis
    const ellipsisElements = content.querySelectorAll('.ellipsis');
    for (let i = 0; i < ellipsisElements.length; i++) {
      ellipsisElements[i].append('…');
    }
  }

  // Collect innerText from all child nodes since DocumentFragment doesn't have innerText
  let textContent = '';
  for (let i = 0; i < content.childNodes.length; i++) {
    const n = content.childNodes[i];
    textContent += n.innerText || n.textContent || '';
  }

  return textContent.replace(MULTIPLE_LINE_BREAKS_RE, '\n\n').trim();
}

export default getHTMLText;
