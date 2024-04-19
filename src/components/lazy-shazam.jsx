/*
  Rendered but hidden. Only show when visible
*/
import { useEffect, useRef, useState } from 'preact/hooks';
import { useInView } from 'react-intersection-observer';

// The sticky header, usually at the top
const TOP = 48;

export default function LazyShazam({ children }) {
  const containerRef = useRef();
  const [visible, setVisible] = useState(false);
  const [visibleStart, setVisibleStart] = useState(false);

  const { ref } = useInView({
    root: null,
    rootMargin: `-${TOP}px 0px 0px 0px`,
    trackVisibility: true,
    delay: 1000,
    onChange: (inView) => {
      if (inView) {
        setVisible(true);
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
