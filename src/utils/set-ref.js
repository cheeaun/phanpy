// A ref from a hook can be a RefObject or a callback
// Libraries like react-hotkeys-hook have flipped between the two
export default function setRef(ref, node) {
  if (!ref) return;
  if (typeof ref === 'function') {
    ref(node);
  } else {
    ref.current = node;
  }
}
