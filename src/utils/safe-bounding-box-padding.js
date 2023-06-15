import mem from 'mem';

const root = document.documentElement;
const style = getComputedStyle(root);
const defaultBoundingBoxPadding = 8;
function _safeBoundingBoxPadding(paddings = []) {
  // paddings = [top, right, bottom, left]
  // Get safe area inset variables from root
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
    .map(
      (v, i) =>
        (parseInt(v, 10) || defaultBoundingBoxPadding) + (paddings[i] || 0),
    )
    .join(' ');
  // console.log(str);
  return str;
}
const safeBoundingBoxPadding = mem(_safeBoundingBoxPadding, {
  maxAge: 10000, // 10 seconds
});

export default safeBoundingBoxPadding;
