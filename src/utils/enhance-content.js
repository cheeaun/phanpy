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

  if (postEnhanceDOM) {
    postEnhanceDOM(dom); // mutate dom
  }

  enhancedContent = dom.innerHTML;

  return enhancedContent;
};
