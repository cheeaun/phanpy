import emojifyText from './emojify-text';

export default (content, opts = {}) => {
  const { emojis, postEnhanceDOM = () => {} } = opts;
  let enhancedContent = content;
  const dom = document.createElement('div');
  dom.innerHTML = enhancedContent;

  // 1. Emojis
  if (emojis) {
    enhancedContent = emojifyText(enhancedContent, emojis);
  }

  // 2. Add target="_blank" to all links with no target="_blank"
  // E.g. `note` in `account`
  const links = Array.from(dom.querySelectorAll('a:not([target="_blank"])'));
  links.forEach((link) => {
    link.setAttribute('target', '_blank');
  });

  // 3. Code blocks
  // Check for <p> with markdown-like content "```"
  {
    const blocks = Array.from(dom.querySelectorAll('p')).filter((p) =>
      /^```[^]+```$/g.test(p.innerText.trim()),
    );
    blocks.forEach((block) => {
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      const breaks = block.querySelectorAll('br');
      breaks.forEach((br) => br.replaceWith('\n'));
      code.innerHTML = block.innerText
        .trim()
        // .replace(/^```/g, '')
        // .replace(/```$/g, '')
        .replace(/^[\n\r]+/, '');
      pre.appendChild(code);
      block.replaceWith(pre);
    });
  }

  // 4. Inline code
  {
    // Get all text nodes in the DOM
    const textNodes = [];
    const walk = document.createTreeWalker(
      dom,
      NodeFilter.SHOW_TEXT,
      null,
      false,
    );
    let node;
    while ((node = walk.nextNode())) {
      // Only get text that contains markdown-like code syntax
      if (/`[^]+`/g.test(node.nodeValue)) {
        textNodes.push(node);
      }
    }
    if (textNodes.length) {
      // - Split text nodes into array of text and DOM nodes
      // - Replace markdown-like code syntax with <code> element
      // - Apply them all back to parent node
      textNodes.forEach((node) => {
        const parent = node.parentNode;
        const text = node.nodeValue;
        const nodes = [];
        let i = 0;
        let j = 0;
        let k = 0;
        while ((i = text.indexOf('`', j)) !== -1) {
          if (i > j) {
            nodes.push(document.createTextNode(text.substring(j, i)));
          }
          j = i + 1;
          if ((k = text.indexOf('`', j)) === -1) {
            k = j;
          }
          if (j < k) {
            const code = document.createElement('code');
            code.appendChild(document.createTextNode(text.substring(j, k)));
            nodes.push(document.createTextNode('`'));
            nodes.push(code);
            nodes.push(document.createTextNode('`'));
          }
          j = k + 1;
        }
        if (j < text.length) {
          nodes.push(document.createTextNode(text.substring(j)));
        }
        nodes.forEach((n) => parent.insertBefore(n, node));
        parent.removeChild(node);
      });
    }
  }

  if (postEnhanceDOM) {
    postEnhanceDOM(dom); // mutate dom
  }

  enhancedContent = dom.innerHTML;

  return enhancedContent;
};
