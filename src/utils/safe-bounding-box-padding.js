const root = document.documentElement;
const style = getComputedStyle(root);
const defaultBoundingBoxPadding = 8;

let safeAreaInsets = [0, 0, 0, 0];
function getSafeAreaInsets() {
  // Get safe area inset variables from root
  const safeAreaInsetTop = style.getPropertyValue('--sai-top');
  const safeAreaInsetRight = style.getPropertyValue('--sai-right');
  const safeAreaInsetBottom = style.getPropertyValue('--sai-bottom');
  const safeAreaInsetLeft = style.getPropertyValue('--sai-left');
  safeAreaInsets = [
    // top, right, bottom, left (clockwise)
    Math.max(0, parseInt(safeAreaInsetTop, 10)),
    Math.max(0, parseInt(safeAreaInsetRight, 10)),
    Math.max(0, parseInt(safeAreaInsetBottom, 10)),
    Math.max(0, parseInt(safeAreaInsetLeft, 10)),
  ];
}
requestAnimationFrame(getSafeAreaInsets);

function safeBoundingBoxPadding(paddings = []) {
  const str = safeAreaInsets
    .map((v, i) => (v || defaultBoundingBoxPadding) + (paddings[i] || 0))
    .join(' ');
  // console.log(str);
  return str;
}

// Update safe area insets when orientation or resize
if (CSS.supports('top: env(safe-area-inset-top)')) {
  window.addEventListener('resize', getSafeAreaInsets, { passive: true });
}

export default safeBoundingBoxPadding;
