import { useEffect } from 'preact/hooks';
import { useThrottledCallback } from 'use-debounce';
import { useResizeObserver } from 'use-resize-observer';

export default function useThrottledResizeObserver(opts = {}) {
  const onResize = useThrottledCallback(opts.onResize, 300);
  // Cancel pending trailing call on unmount to avoid firing with stale/undefined args.
  useEffect(() => () => onResize.cancel(), [onResize]);
  return useResizeObserver({
    ...opts,
    onResize,
  });
}
