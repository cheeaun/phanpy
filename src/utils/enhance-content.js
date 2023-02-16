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
    pre.innerHTML = `<code>${block.innerHTML.trim()}</code>`;
    block.replaceWith(pre);
  });

  // Convert multi-paragraph code blocks to <pre><code>code</code></pre>
  const paragraphs = Array.from(dom.querySelectorAll('p'));
  // Filter out paragraphs with ``` in beginning only
  const codeBlocks = paragraphs.filter((p) => /^```/g.test(p.innerText));
  // For each codeBlocks, get all paragraphs until the last paragraph with ``` at the end only
  codeBlocks.forEach((block) => {
    const nextParagraphs = [block];
    let hasCodeBlock = false;
    do {
      const next = block.nextElementSibling;
      if (next && next.tagName === 'P') {
        if (/```$/g.test(next.innerText)) {
          nextParagraphs.push(next);
          hasCodeBlock = true;
          break;
        } else {
          nextParagraphs.push(next);
        }
      } else {
        break;
      }
    } while (true);
    if (hasCodeBlock) {
      const pre = document.createElement('pre');
      nextParagraphs.forEach((p) => {
        // Replace <br /> with newlines
        p.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
      });
      const codeText = nextParagraphs.map((p) => p.innerHTML).join('\n\n');
      pre.innerHTML = `<code>${codeText}</code>`;
      block.replaceWith(pre);
      nextParagraphs.forEach((p) => p.remove());
    }
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

  // TWITTER USERNAMES
  // =================
  // Convert @username@twitter.com to <a href="https://twitter.com/username">@username@twitter.com</a>
  textNodes = extractTextNodes(dom, {
    rejectFilter: ['A'],
  });
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

const defaultRejectFilter = [
  // Document metadata
  'STYLE',
  // Image and multimedia
  'IMG',
  'VIDEO',
  'AUDIO',
  'AREA',
  'MAP',
  'TRACK',
  // Embedded content
  'EMBED',
  'IFRAME',
  'OBJECT',
  'PICTURE',
  'PORTAL',
  'SOURCE',
  // SVG and MathML
  'SVG',
  'MATH',
  // Scripting
  'CANVAS',
  'NOSCRIPT',
  'SCRIPT',
  // Forms
  'INPUT',
  'OPTION',
  'TEXTAREA',
  // Web Components
  'SLOT',
  'TEMPLATE',
];
const defaultRejectFilterMap = Object.fromEntries(
  defaultRejectFilter.map((nodeName) => [nodeName, true]),
);
function extractTextNodes(dom, opts = {}) {
  const textNodes = [];
  const walk = document.createTreeWalker(
    dom,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (defaultRejectFilterMap[node.parentNode.nodeName]) {
          return NodeFilter.FILTER_REJECT;
        }
        if (
          opts.rejectFilter &&
          opts.rejectFilter.includes(node.parentNode.nodeName)
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    },
    false,
  );
  let node;
  while ((node = walk.nextNode())) {
    textNodes.push(node);
  }
  return textNodes;
}

export default enhanceContent;
