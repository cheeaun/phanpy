import emojifyText from './emojify-text';

export default (content, { emojis }) => {
  // 1. Emojis
  let enhancedContent = content;

  if (emojis) {
    enhancedContent = emojifyText(enhancedContent, emojis);
  }

  // 2. Code blocks
  const dom = document.createElement('div');
  dom.innerHTML = enhancedContent;
  // Check for <p> with markdown-like content "```"
  const blocks = Array.from(dom.querySelectorAll('p')).filter((p) =>
    /^```[^]+```$/g.test(p.innerText.trim()),
  );
  blocks.forEach((block) => {
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    const breaks = block.querySelectorAll('br');
    Array.from(breaks).forEach((br) => br.replaceWith('\n'));
    code.innerHTML = block.innerText
      .trim()
      // .replace(/^```/g, '')
      // .replace(/```$/g, '')
      .replace(/^[\n\r]+/, '');
    pre.appendChild(code);
    block.replaceWith(pre);
  });
  enhancedContent = dom.innerHTML;

  return enhancedContent;
};
