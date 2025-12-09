/*
  Rendered but hidden. Only show when visible
*/
import { useCallback, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { useOnInView } from 'react-intersection-observer';

// The sticky header, usually at the top
const TOP = 48;

const shazamIDs = {};

export default function LazyShazam({ id, children }) {
  const containerRef = useRef();
  const [visibleStart, setVisibleStart] = useState(!!shazamIDs[id]);

  const onInView = useCallback(
    (inView) => {
      if (inView && containerRef.current) {
        containerRef.current.hidden = false;
        if (id) shazamIDs[id] = true;
      }
    },
    [id],
  );

  const ref = useOnInView(onInView, {
    rootMargin: `-${TOP}px 0px 0px 0px`,
    trackVisibility: true,
    delay: 1000,
    triggerOnce: true,
    skip: visibleStart,
  });

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.bottom > TOP) {
      if (rect.top < window.innerHeight) {
        containerRef.current.hidden = false;
      } else {
        setVisibleStart(true);
      }
      if (id) shazamIDs[id] = true;
    }
  }, []);

  if (visibleStart) return children;

  return (
    <div ref={containerRef} class="shazam-container no-animation" hidden>
      <div ref={ref} class="shazam-container-inner">
        {children}
      </div>
    </div>
  );
}
