import emojifyText from './emojify-text';
import mem from './mem';

const fauxDiv = document.createElement('div');
const whitelistLinkClasses = ['u-url', 'mention', 'hashtag'];

function _enhanceContent(content, opts = {}) {
  const { emojis, postEnhanceDOM = () => {} } = opts;
  let enhancedContent = content;
  const dom = document.createElement('div');
  dom.innerHTML = enhancedContent;
  const hasLink = /<a/i.test(enhancedContent);
  const hasCodeBlock = enhancedContent.includes('```');

  if (hasLink) {
    // Add target="_blank" to all links with no target="_blank"
    // E.g. `note` in `account`
    const noTargetBlankLinks = dom.querySelectorAll('a:not([target="_blank"])');
    noTargetBlankLinks.forEach((link) => {
      link.setAttribute('target', '_blank');
    });

    // Remove all classes except `u-url`, `mention`, `hashtag`
    const links = dom.querySelectorAll('a[class]');
    links.forEach((link) => {
      link.classList.forEach((c) => {
        if (!whitelistLinkClasses.includes(c)) {
          link.classList.remove(c);
        }
      });
    });
  }

  // Add 'has-url-text' to all links that contains a url
  if (hasLink) {
    const links = dom.querySelectorAll('a[href]');
    links.forEach((link) => {
      if (/^https?:\/\//i.test(link.textContent.trim())) {
        link.classList.add('has-url-text');
      }
    });
  }

  // Spanify un-spanned mentions
  if (hasLink) {
    const links = dom.querySelectorAll('a[href]');
    const usernames = [];
    links.forEach((link) => {
      const text = link.innerText.trim();
      const hasChildren = link.querySelector('*');
      // If text looks like @username@domain, then it's a mention
      if (/^@[^@]+(@[^@]+)?$/g.test(text)) {
        // Only show @username
        const [_, username, domain] = text.split('@');
        if (!hasChildren) {
          if (
            !usernames.some(([u]) => u === username) ||
            usernames.some(([u, d]) => u === username && d === domain)
          ) {
            link.innerHTML = `@<span>${username}</span>`;
            usernames.push([username, domain]);
          } else {
            link.innerHTML = `@<span>${username}@${domain}</span>`;
          }
        }
        link.classList.add('mention');
      }
      // If text looks like #hashtag, then it's a hashtag
      if (/^#[^#]+$/g.test(text)) {
        if (!hasChildren) link.innerHTML = `#<span>${text.slice(1)}</span>`;
        link.classList.add('mention', 'hashtag');
      }
    });
  }

  // EMOJIS
  // ======
  // Convert :shortcode: to <img />
  let textNodes;
  if (enhancedContent.includes(':')) {
    textNodes = extractTextNodes(dom);
    textNodes.forEach((node) => {
      let html = node.nodeValue
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      if (emojis) {
        html = emojifyText(html, emojis);
      }
      fauxDiv.innerHTML = html;
      // const nodes = [...fauxDiv.childNodes];
      node.replaceWith(...fauxDiv.childNodes);
    });
  }

  // CODE BLOCKS
  // ===========
  // Convert ```code``` to <pre><code>code</code></pre>
  if (hasCodeBlock) {
    const blocks = [...dom.querySelectorAll('p')].filter((p) =>
      /^```[^]+```$/g.test(p.innerText.trim()),
    );
    blocks.forEach((block) => {
      const pre = document.createElement('pre');
      // Replace <br /> with newlines
      block.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
      pre.innerHTML = `<code>${block.innerHTML.trim()}</code>`;
      block.replaceWith(pre);
    });
  }

  // Convert multi-paragraph code blocks to <pre><code>code</code></pre>
  if (hasCodeBlock) {
    const paragraphs = [...dom.querySelectorAll('p')];
    // Filter out paragraphs with ``` in beginning only
    const codeBlocks = paragraphs.filter((p) => /^```/g.test(p.innerText));
    // For each codeBlocks, get all paragraphs until the last paragraph with ``` at the end only
    codeBlocks.forEach((block) => {
      const nextParagraphs = [block];
      let hasCodeBlock = false;
      let currentBlock = block;
      while (currentBlock.nextElementSibling) {
        const next = currentBlock.nextElementSibling;
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
        currentBlock = next;
      }
      if (hasCodeBlock) {
        const pre = document.createElement('pre');
        nextParagraphs.forEach((p) => {
          // Replace <br /> with newlines
          p.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
        });
        const codeText = nextParagraphs.map((p) => p.innerHTML).join('\n\n');
        pre.innerHTML = `<code tabindex="0">${codeText}</code>`;
        block.replaceWith(pre);
        nextParagraphs.forEach((p) => p.remove());
      }
    });
  }

  // INLINE CODE
  // ===========
  // Convert `code` to <code>code</code>
  if (enhancedContent.includes('`')) {
    textNodes = extractTextNodes(dom);
    textNodes.forEach((node) => {
      let html = node.nodeValue
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      if (/`[^`]+`/g.test(html)) {
        html = html.replaceAll(/(`[^]+?`)/g, '<code>$1</code>');
      }
      fauxDiv.innerHTML = html;
      // const nodes = [...fauxDiv.childNodes];
      node.replaceWith(...fauxDiv.childNodes);
    });
  }

  // TWITTER USERNAMES
  // =================
  // Convert @username@twitter.com to <a href="https://twitter.com/username">@username@twitter.com</a>
  if (/twitter\.com/i.test(enhancedContent)) {
    textNodes = extractTextNodes(dom, {
      rejectFilter: ['A'],
    });
    textNodes.forEach((node) => {
      let html = node.nodeValue
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      if (/@[a-zA-Z0-9_]+@twitter\.com/g.test(html)) {
        html = html.replaceAll(
          /(@([a-zA-Z0-9_]+)@twitter\.com)/g,
          '<a href="https://twitter.com/$2" rel="nofollow noopener noreferrer" target="_blank">$1</a>',
        );
      }
      fauxDiv.innerHTML = html;
      // const nodes = [...fauxDiv.childNodes];
      node.replaceWith(...fauxDiv.childNodes);
    });
  }

  // HASHTAG STUFFING
  // ================
  // Get the <p> that contains a lot of hashtags, add a class to it
  if (enhancedContent.includes('#')) {
    let prevIndex = null;
    const hashtagStuffedParagraphs = [...dom.querySelectorAll('p')].filter(
      (p, index) => {
        let hashtagCount = 0;
        for (let i = 0; i < p.childNodes.length; i++) {
          const node = p.childNodes[i];

          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim();
            if (text !== '') {
              return false;
            }
          } else if (node.tagName === 'BR') {
            // Ignore <br />
          } else if (node.tagName === 'A') {
            const linkText = node.textContent.trim();
            if (!linkText || !linkText.startsWith('#')) {
              return false;
            } else {
              hashtagCount++;
            }
          } else {
            return false;
          }
        }
        // Only consider "stuffing" if:
        // - there are more than 3 hashtags
        // - there are more than 1 hashtag in adjacent paragraphs
        if (hashtagCount > 3) {
          prevIndex = index;
          return true;
        }
        if (hashtagCount > 1 && prevIndex && index === prevIndex + 1) {
          prevIndex = index;
          return true;
        }
      },
    );
    if (hashtagStuffedParagraphs?.length) {
      hashtagStuffedParagraphs.forEach((p) => {
        p.classList.add('hashtag-stuffing');
        p.title = p.innerText;
      });
    }
  }

  if (postEnhanceDOM) {
    queueMicrotask(() => postEnhanceDOM(dom));
    // postEnhanceDOM(dom); // mutate dom
  }

  enhancedContent = dom.innerHTML;

  return enhancedContent;
}
const enhanceContent = mem(_enhanceContent);

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
  const rejectFilterMap = Object.assign(
    {},
    defaultRejectFilterMap,
    opts.rejectFilter?.reduce((acc, cur) => {
      acc[cur] = true;
      return acc;
    }, {}),
  );
  const walk = document.createTreeWalker(
    dom,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (rejectFilterMap[node.parentNode.nodeName]) {
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
