import { useCallback, useRef } from 'preact/hooks';

import useThrottledResizeObserver from './useThrottledResizeObserver';

export default function useTruncated({
  className = 'truncated',
  onTruncated,
} = {}) {
  const ref = useRef();
  const prevTruncatedRef = useRef();
  const onResize = useCallback(
    ({ height, width }) => {
      if (ref.current) {
        const { scrollHeight, scrollWidth } = ref.current;
        let truncated = scrollHeight > height || scrollWidth > width;
        if (truncated) {
          const {
            height: _height,
            maxHeight,
            width: _width,
            maxWidth,
          } = getComputedStyle(ref.current);
          const computedHeight =
            parseInt(maxHeight, 10) || parseInt(_height, 10);
          const computedWidth = parseInt(maxWidth, 10) || parseInt(_width, 10);
          truncated =
            scrollHeight > computedHeight || scrollWidth > computedWidth;
        }
        ref.current.classList.toggle(className, truncated);
        if (
          prevTruncatedRef.current !== truncated &&
          typeof onTruncated === 'function'
        ) {
          prevTruncatedRef.current = truncated;
          onTruncated(truncated);
        }
      }
    },
    [className, onTruncated],
  );
  useThrottledResizeObserver({
    ref,
    box: 'border-box',
    onResize,
  });
  return ref;
}
