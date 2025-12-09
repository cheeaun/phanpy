import { useRef } from 'preact/hooks';

import useThrottledResizeObserver from './useThrottledResizeObserver';

export default function useTruncated({ className = 'truncated' } = {}) {
  const ref = useRef();
  const onResize = ({ height }) => {
    if (ref.current) {
      const { scrollHeight } = ref.current;
      let truncated = scrollHeight > height;
      if (truncated) {
        const { height: _height, maxHeight } = getComputedStyle(ref.current);
        const computedHeight = parseInt(maxHeight || _height, 10);
        truncated = scrollHeight > computedHeight;
      }
      ref.current.classList.toggle(className, truncated);
    }
  };
  useThrottledResizeObserver({
    ref,
    box: 'border-box',
    onResize,
  });
  return ref;
}
