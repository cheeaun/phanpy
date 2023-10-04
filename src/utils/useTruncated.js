import { useRef } from 'preact/hooks';
import { useThrottledCallback } from 'use-debounce';
import useResizeObserver from 'use-resize-observer';

export default function useTruncated({ className = 'truncated' } = {}) {
  const ref = useRef();
  const onResize = useThrottledCallback(({ height }) => {
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
  }, 300);
  useResizeObserver({
    ref,
    box: 'border-box',
    onResize,
  });
  return ref;
}
