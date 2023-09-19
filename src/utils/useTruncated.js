import { useRef } from 'preact/hooks';
import useResizeObserver from 'use-resize-observer';

export default function useTruncated({ className = 'truncated' } = {}) {
  const ref = useRef();
  useResizeObserver({
    ref,
    box: 'border-box',
    onResize: ({ height }) => {
      if (ref.current) {
        const { scrollHeight } = ref.current;
        ref.current.classList.toggle(className, scrollHeight > height);
      }
    },
  });
  return ref;
}
