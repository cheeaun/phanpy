import { useCallback, useRef } from 'preact/hooks';

export default function useDebouncedCallback(
  callback,
  delay,
  dependencies = [],
) {
  const timeout = useRef();

  const comboDeps = dependencies
    ? [callback, delay, ...dependencies]
    : [callback, delay];

  return useCallback((...args) => {
    if (timeout.current != null) {
      clearTimeout(timeout.current);
    }

    timeout.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, comboDeps);
}
