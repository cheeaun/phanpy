const template = document.createElement('template');

// Regex patterns for HTML text processing
const PARAGRAPH_END_RE = /<\/p>/gu;
const LIST_ITEM_END_RE = /<\/li>/gu;
const MULTIPLE_LINE_BREAKS_RE = /[\r\n]{3,}/gu;
interface GetHTMLTextOptions {
  readonly preProcess?: (content: DocumentFragment) => void;
  readonly truncateLinks?: boolean;
}

function truncateMastodonLinks(content: DocumentFragment): void {
  // MASTODON-SPECIFIC classes
  // Remove .invisible
  for (const invisibleElement of content.querySelectorAll('.invisible')) {
    invisibleElement.remove();
  }
  // Add … at end of .ellipsis
  for (const ellipsisElement of content.querySelectorAll('.ellipsis')) {
    ellipsisElement.append('…');
  }
}

function replaceLineBreakElements(content: DocumentFragment): void {
  for (const br of content.querySelectorAll('br')) {
    br.replaceWith('\n');
  }
}

function getNodeText(node: ChildNode): string {
  if (node instanceof HTMLElement) {
    return node.innerText || node.textContent || '';
  }

  return node.textContent ?? '';
}

function getHTMLText(
  html: string,
  { preProcess, truncateLinks = true }: GetHTMLTextOptions = {},
): string {
  if (!html) {
    return '';
  }

  template.innerHTML = html
    .replace(PARAGRAPH_END_RE, '</p>\n\n')
    .replace(LIST_ITEM_END_RE, '</li>\n');

  const { content } = template;
  replaceLineBreakElements(content);

  preProcess?.(content);

  if (truncateLinks) {
    truncateMastodonLinks(content);
  }

  // Collect innerText from all child nodes since DocumentFragment doesn't have innerText
  return Array.from(content.childNodes, getNodeText)
    .join('')
    .replace(MULTIPLE_LINE_BREAKS_RE, '\n\n')
    .trim();
}

export default getHTMLText;
