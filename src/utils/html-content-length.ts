const template = document.createElement('template');

interface InnerTextNode extends ChildNode {
  readonly innerText: string;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function hasInnerText(n: ChildNode): n is InnerTextNode {
  // oxlint-disable-next-line unicorn/prefer-dom-node-text-content
  return 'innerText' in n && typeof n.innerText === 'string';
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function getNodeText(n: ChildNode): string {
  if (hasInnerText(n)) {
    // oxlint-disable-next-line unicorn/prefer-dom-node-text-content
    const { innerText } = n;
    if (innerText === '') {
      return n.textContent ?? '';
    }
    return innerText;
  }
  return n.textContent ?? '';
}

export default function htmlContentLength(html: string): number {
  if (!html) {
    return 0;
  }
  template.innerHTML = html;
  // .invisible spans for links
  // E.g. <span class="invisible">https://</span>mastodon.social
  const invisibleElements = template.content.querySelectorAll('.invisible');
  for (const invisibleElement of invisibleElements) {
    invisibleElement.remove();
  }
  // Collect innerText from all child nodes since DocumentFragment doesn't have innerText
  let textContent = '';
  for (const n of template.content.childNodes) {
    textContent += getNodeText(n);
  }
  return textContent.length;
}
