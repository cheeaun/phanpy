import emojifyText from './emojify-text';

const fauxDiv = document.createElement('div');

function enhanceContent(content, opts = {}) {
  const { emojis, postEnhanceDOM = () => {} } = opts;
  let enhancedContent = content;
  const dom = document.createElement('div');
  dom.innerHTML = enhancedContent;

  // Add target="_blank" to all links with no target="_blank"
  // E.g. `note` in `account`
  const links = Array.from(dom.querySelectorAll('a:not([target="_blank"])'));
  links.forEach((link) => {
    link.setAttribute('target', '_blank');
  });

  // EMOJIS
  // ======
  // Convert :shortcode: to <img />
  let textNodes = extractTextNodes(dom);
  textNodes.forEach((node) => {
    let html = node.nodeValue.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (emojis) {
      html = emojifyText(html, emojis);
    }
    fauxDiv.innerHTML = html;
    const nodes = Array.from(fauxDiv.childNodes);
    node.replaceWith(...nodes);
  });

  // INLINE CODE
  // ===========
  // Convert `code` to <code>code</code>
  textNodes = extractTextNodes(dom);
  textNodes.forEach((node) => {
    let html = node.nodeValue.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (/`[^`]+`/g.test(html)) {
      html = html.replaceAll(/(`[^]+?`)/g, '<code>$1</code>');
    }
    fauxDiv.innerHTML = html;
    const nodes = Array.from(fauxDiv.childNodes);
    node.replaceWith(...nodes);
  });

  // CODE BLOCKS
  // ===========
  // Convert ```code``` to <pre><code>code</code></pre>
  const blocks = Array.from(dom.querySelectorAll('p')).filter((p) =>
    /^```[^]+```$/g.test(p.innerText.trim()),
  );
  blocks.forEach((block) => {
    const pre = document.createElement('pre');
    // Replace <br /> with newlines
    block.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
    pre.innerHTML = `<code>${block.innerText.trim()}</code>`;
    block.replaceWith(pre);
  });

  // TWITTER USERNAMES
  // =================
  // Convert @username@twitter.com to <a href="https://twitter.com/username">@username@twitter.com</a>
  textNodes = extractTextNodes(dom);
  textNodes.forEach((node) => {
    let html = node.nodeValue.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (/@[a-zA-Z0-9_]+@twitter\.com/g.test(html)) {
      html = html.replaceAll(
        /(@([a-zA-Z0-9_]+)@twitter\.com)/g,
        '<a href="https://twitter.com/$2" rel="nofollow noopener noreferrer" target="_blank">$1</a>',
      );
    }
    fauxDiv.innerHTML = html;
    const nodes = Array.from(fauxDiv.childNodes);
    node.replaceWith(...nodes);
  });

  if (postEnhanceDOM) {
    postEnhanceDOM(dom); // mutate dom
  }

  enhancedContent = dom.innerHTML;

  return enhancedContent;
}

function extractTextNodes(dom) {
  const textNodes = [];
  const walk = document.createTreeWalker(
    dom,
    NodeFilter.SHOW_TEXT,
    null,
    false,
  );
  let node;
  while ((node = walk.nextNode())) {
    textNodes.push(node);
  }
  return textNodes;
}

export default enhanceContent;
