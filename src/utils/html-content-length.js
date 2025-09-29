const template = document.createElement('template');
export default function htmlContentLength(html) {
  if (!html) return 0;
  template.innerHTML = html;
  // .invisible spans for links
  // e.g. <span class="invisible">https://</span>mastodon.social
  const invisibleElements = template.content.querySelectorAll('.invisible');
  for (let i = 0; i < invisibleElements.length; i++) {
    invisibleElements[i].remove();
  }
  // Collect innerText from all child nodes since DocumentFragment doesn't have innerText
  let textContent = '';
  for (let i = 0; i < template.content.childNodes.length; i++) {
    const n = template.content.childNodes[i];
    textContent += n.innerText || n.textContent || '';
  }
  return textContent.length;
}
