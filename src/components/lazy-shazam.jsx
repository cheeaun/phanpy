/*
  Rendered but hidden. Only show when visible
*/
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { useInView } from 'react-intersection-observer';

export default function LazyShazam({ children }) {
  const containerRef = useRef();
  const [visible, setVisible] = useState(false);
  const [visibleStart, setVisibleStart] = useState(false);

  const { ref } = useInView({
    root: null,
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

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.bottom > 0) {
      setVisibleStart(true);
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
