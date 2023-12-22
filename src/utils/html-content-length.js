const div = document.createElement('div');
export default function htmlContentLength(html) {
  if (!html) return 0;
  div.innerHTML = html;
  // .invisible spans for links
  // e.g. <span class="invisible">https://</span>mastodon.social
  div.querySelectorAll('.invisible').forEach((el) => {
    el.remove();
  });
  return div.innerText.length;
}
