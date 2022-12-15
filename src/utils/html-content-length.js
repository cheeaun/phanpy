const div = document.createElement('div');
export default (html) => {
  div.innerHTML = html;
  return div.innerText.length;
};
