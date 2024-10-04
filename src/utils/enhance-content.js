import emojifyText from './emojify-text';
import mem from './mem';

const fauxDiv = document.createElement('div');
const whitelistLinkClasses = ['u-url', 'mention', 'hashtag'];

const HTML_CHARS_REGEX = /[&<>]/g;
function escapeHTML(html) {
  return html.replace(
    HTML_CHARS_REGEX,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
      }[c]),
  );
}

const LINK_REGEX = /<a/i;
const HTTP_LINK_REGEX = /^https?:\/\//i;
const MENTION_REGEX = /^@[^@]+(@[^@]+)?$/g;
const HASHTAG_REGEX = /^#[^#]+$/g;
const CODE_BLOCK_REGEX = /^```[^]+```$/g;
const CODE_BLOCK_START_REGEX = /^```/g;
const CODE_BLOCK_END_REGEX = /```$/g;
const INLINE_CODE_REGEX = /`[^`]+`/g;
const TWITTER_DOMAIN_REGEX = /(twitter|x)\.com/i;
const TWITTER_MENTION_REGEX = /@[a-zA-Z0-9_]+@(twitter|x)\.com/g;
const TWITTER_MENTION_CAPTURE_REGEX = /(@([a-zA-Z0-9_]+)@(twitter|x)\.com)/g;

function createDOM(html, isDocumentFragment) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  return isDocumentFragment ? tpl.content : tpl;
}

function _countEntities(p) {
  let count = 0;
  
  for (const node of p.childNodes) {
    if(node.nodeType === Node.TEXT_NODE) {
      // Check if there's text between the entities
      const text = node.textContent.trim();
      if(text !== '') {
        // End if there's text
        throw false;
      }
    }
    else if(node.tagName === 'BR') {
      // Ignore <br />
    }
    else if(node.tagName === 'A') {
      // Check if the link has text
      const linkText = node.textContent.trim();
      
      if(!linkText) {
        // End if there's a link without text
        throw false;
      }
      else if(!(
        linkText.startsWith('#') || linkText.startsWith('@')
      )) {
        // End if there's a link that's not a mention or an hashtag
        throw false;
      }
      else {
        // This is an entity
        count++;
      }
    } else if(node.tagName === 'SPAN') {
      // If this is a span, we might need to go deeper
      count += _countEntities(node)
    } else {
      // There's something else here we should not touch
      throw false;
    }
  }
  
  return count
}

function _enhanceContent(content, opts = {}) {
  const { emojis, returnDOM, postEnhanceDOM = () => {} } = opts;
  let enhancedContent = content;
  // const dom = document.createElement('div');
  // dom.innerHTML = enhancedContent;
  const dom = createDOM(enhancedContent, returnDOM);
  const hasLink = LINK_REGEX.test(enhancedContent);
  const hasCodeBlock = enhancedContent.includes('```');

  if (hasLink) {
    // Add target="_blank" to all links with no target="_blank"
    // E.g. `note` in `account`
    const noTargetBlankLinks = dom.querySelectorAll('a:not([target="_blank"])');
    for (const link of noTargetBlankLinks) {
      link.setAttribute('target', '_blank');
    }

    // Remove all classes except `u-url`, `mention`, `hashtag`
    const links = dom.querySelectorAll('a[class]');
    for (const link of links) {
      for (const c of link.classList) {
        if (!whitelistLinkClasses.includes(c)) {
          link.classList.remove(c);
        }
      }
    }
  }

  // Add 'has-url-text' to all links that contains a url
  if (hasLink) {
    const links = dom.querySelectorAll('a[href]');
    for (const link of links) {
      if (HTTP_LINK_REGEX.test(link.textContent.trim())) {
        link.classList.add('has-url-text');
        shortenLink(link);
      }
    }
  }

  // Spanify un-spanned mentions
  if (hasLink) {
    const links = dom.querySelectorAll('a[href]');
    const usernames = [];
    for (const link of links) {
      const text = link.innerText.trim();
      const hasChildren = link.querySelector('*');
      // If text looks like @username@domain, then it's a mention
      if (MENTION_REGEX.test(text)) {
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
      if (HASHTAG_REGEX.test(text)) {
        if (!hasChildren) link.innerHTML = `#<span>${text.slice(1)}</span>`;
        link.classList.add('mention', 'hashtag');
      }
    }
  }

  // EMOJIS
  // ======
  // Convert :shortcode: to <img />
  let textNodes;
  if (enhancedContent.includes(':')) {
    textNodes = extractTextNodes(dom);
    for (const node of textNodes) {
      let html = escapeHTML(node.nodeValue);
      if (emojis) {
        html = emojifyText(html, emojis);
      }
      fauxDiv.innerHTML = html;
      node.replaceWith(...fauxDiv.childNodes);
    }
  }

  // CODE BLOCKS
  // ===========
  // Convert ```code``` to <pre><code>code</code></pre>
  if (hasCodeBlock) {
    const blocks = [...dom.querySelectorAll('p')].filter((p) =>
      CODE_BLOCK_REGEX.test(p.innerText.trim()),
    );
    for (const block of blocks) {
      const pre = document.createElement('pre');
      // Replace <br /> with newlines
      for (const br of block.querySelectorAll('br')) {
        br.replaceWith('\n');
      }
      pre.innerHTML = `<code>${block.innerHTML.trim()}</code>`;
      block.replaceWith(pre);
    }
  }

  // Convert multi-paragraph code blocks to <pre><code>code</code></pre>
  if (hasCodeBlock) {
    const paragraphs = [...dom.querySelectorAll('p')];
    // Filter out paragraphs with ``` in beginning only
    const codeBlocks = paragraphs.filter((p) =>
      CODE_BLOCK_START_REGEX.test(p.innerText),
    );
    // For each codeBlocks, get all paragraphs until the last paragraph with ``` at the end only
    for (const block of codeBlocks) {
      const nextParagraphs = [block];
      let hasCodeBlock = false;
      let currentBlock = block;
      while (currentBlock.nextElementSibling) {
        const next = currentBlock.nextElementSibling;
        if (next && next.tagName === 'P') {
          if (CODE_BLOCK_END_REGEX.test(next.innerText)) {
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
        for (const p of nextParagraphs) {
          // Replace <br /> with newlines
          for (const br of p.querySelectorAll('br')) {
            br.replaceWith('\n');
          }
        }
        const codeText = nextParagraphs.map((p) => p.innerHTML).join('\n\n');
        pre.innerHTML = `<code tabindex="0">${codeText}</code>`;
        block.replaceWith(pre);
        for (const p of nextParagraphs) {
          p.remove();
        }
      }
    }
  }

  // INLINE CODE
  // ===========
  // Convert `code` to <code>code</code>
  if (enhancedContent.includes('`')) {
    textNodes = extractTextNodes(dom);
    for (const node of textNodes) {
      let html = escapeHTML(node.nodeValue);
      if (INLINE_CODE_REGEX.test(html)) {
        html = html.replaceAll(/(`[^]+?`)/g, '<code>$1</code>');
      }
      fauxDiv.innerHTML = html;
      // const nodes = [...fauxDiv.childNodes];
      node.replaceWith(...fauxDiv.childNodes);
    }
  }

  // TWITTER USERNAMES
  // =================
  // Convert @username@twitter.com to <a href="https://twitter.com/username">@username@twitter.com</a>
  if (TWITTER_DOMAIN_REGEX.test(enhancedContent)) {
    textNodes = extractTextNodes(dom, {
      rejectFilter: ['A'],
    });
    for (const node of textNodes) {
      let html = escapeHTML(node.nodeValue);
      if (TWITTER_MENTION_REGEX.test(html)) {
        html = html.replaceAll(
          TWITTER_MENTION_CAPTURE_REGEX,
          '<a href="https://twitter.com/$2" rel="nofollow noopener noreferrer" target="_blank">$1</a>',
        );
      }
      fauxDiv.innerHTML = html;
      // const nodes = [...fauxDiv.childNodes];
      node.replaceWith(...fauxDiv.childNodes);
    }
  }

  // ENTITY STUFFING
  // ================
  // Get the <p> that contains a lot of hashtags or mentions, add a class to it
  if (enhancedContent.includes('#') || enhancedContent.includes('@')) {
    let prevIndex = null;
    const stuffedParagraphs = [...dom.querySelectorAll('p')].filter(
      (p, index) => {
        let entitiesCount = 0;
        
        try {
          entitiesCount = _countEntities(p)
        } catch(e) {
          if(e === false) {
            return false
          }
          throw e;
        }
        
        // Only consider "stuffing" if:
        // - there are more than 3 entities
        // - there are more than 1 entity in adjacent paragraphs
        if (entitiesCount > 3) {
          prevIndex = index;
          return true;
        }
        if (entitiesCount > 1 && prevIndex && index === prevIndex + 1) {
          prevIndex = index;
          return true;
        }
      },
    );
    if (stuffedParagraphs?.length) {
      for (const p of stuffedParagraphs) {
        p.classList.add('entity-stuffing');
        p.title = p.innerText;
      }
    }
  }

  // ADD ASPECT RATIO TO ALL IMAGES
  if (enhancedContent.includes('<img')) {
    const imgs = dom.querySelectorAll('img');
    for (let i = 0; i < imgs.length; i++) {
      const img = imgs[i];
      const width = img.getAttribute('width') || img.naturalWidth;
      const height = img.getAttribute('height') || img.naturalHeight;
      if (width && height) {
        img.style.setProperty('--original-aspect-ratio', `${width}/${height}`);
      }
    }
  }

  if (postEnhanceDOM) {
    queueMicrotask(() => postEnhanceDOM(dom));
    // postEnhanceDOM(dom); // mutate dom
  }

  return returnDOM ? dom : dom.innerHTML;
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

const URL_PREFIX_REGEX = /^(https?:\/\/(www\.)?|xmpp:)/;
const URL_DISPLAY_LENGTH = 30;
// Similar to https://github.com/mastodon/mastodon/blob/1666b1955992e16f4605b414c6563ca25b3a3f18/app/lib/text_formatter.rb#L54-L69
function shortenLink(link) {
  if (!link || link.querySelector?.('*')) {
    return;
  }
  try {
    const url = link.innerText.trim();
    const prefix = (url.match(URL_PREFIX_REGEX) || [])[0] || '';
    if (!prefix) return;
    const displayURL = url.slice(
      prefix.length,
      prefix.length + URL_DISPLAY_LENGTH,
    );
    const suffix = url.slice(prefix.length + URL_DISPLAY_LENGTH);
    const cutoff = url.slice(prefix.length).length > URL_DISPLAY_LENGTH;
    link.innerHTML = `<span class="invisible">${prefix}</span><span class=${
      cutoff ? 'ellipsis' : ''
    }>${displayURL}</span><span class="invisible">${suffix}</span>`;
  } catch (e) {}
}

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
