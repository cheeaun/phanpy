/*
  Rendered but hidden. Only show when visible
*/
import { useEffect, useRef, useState } from 'preact/hooks';
import { useInView } from 'react-intersection-observer';

// The sticky header, usually at the top
const TOP = 48;

const shazamIDs = {};

export default function LazyShazam({ id, children }) {
  const containerRef = useRef();
  const hasID = !!shazamIDs[id];
  const [visible, setVisible] = useState(false);
  const [visibleStart, setVisibleStart] = useState(hasID || false);

  const { ref } = useInView({
    root: null,
    rootMargin: `-${TOP}px 0px 0px 0px`,
    trackVisibility: true,
    delay: 1000,
    onChange: (inView) => {
      if (inView) {
        setVisible(true);
        if (id) shazamIDs[id] = true;
      }
    },
    triggerOnce: true,
    skip: visibleStart || visible,
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.bottom > TOP) {
      if (rect.top < window.innerHeight) {
        setVisible(true);
      } else {
        setVisibleStart(true);
      }
      if (id) shazamIDs[id] = true;
    }
  }, []);

  if (visibleStart) return children;

  return (
    <div
      ref={containerRef}
      class="shazam-container no-animation"
      hidden={!visible}
    >
      <div ref={ref} class="shazam-container-inner">
        {children}
      </div>
    </div>
  );
}
