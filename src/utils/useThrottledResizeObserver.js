import { useThrottledCallback } from 'use-debounce';
import useResizeObserver from 'use-resize-observer';

export default function useThrottledResizeObserver(opts = {}) {
  const onResize = useThrottledCallback(opts.onResize, 300);
  return useResizeObserver({
    ...opts,
    onResize,
  });
}
