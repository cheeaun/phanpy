import mem from 'mem';

const root = document.documentElement;
const defaultBoundingBoxPadding = 8;
function _safeBoundingBoxPadding() {
  // Get safe area inset variables from root
  const style = getComputedStyle(root);
  const safeAreaInsetTop = style.getPropertyValue('--sai-top');
  const safeAreaInsetRight = style.getPropertyValue('--sai-right');
  const safeAreaInsetBottom = style.getPropertyValue('--sai-bottom');
  const safeAreaInsetLeft = style.getPropertyValue('--sai-left');
  const str = [
    safeAreaInsetTop,
    safeAreaInsetRight,
    safeAreaInsetBottom,
    safeAreaInsetLeft,
  ]
    .map((v) => parseInt(v, 10) || defaultBoundingBoxPadding)
    .join(' ');
  // console.log(str);
  return str;
}
const safeBoundingBoxPadding = mem(_safeBoundingBoxPadding, {
  maxAge: 10000, // 10 seconds
});

export default safeBoundingBoxPadding;
