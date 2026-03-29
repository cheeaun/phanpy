import { useLayoutEffect, useRef } from 'preact/hooks';
import { useOnInView } from 'react-intersection-observer';

// The sticky header, usually at the top
const TOP = 48;

export default function LazyRender({
  as: Root = 'div',
  id,
  class: className,
  children,
  ...props
}) {
  const rootRef = useRef(null);

  const observerRef = useOnInView(
    (inView) => {
      if (inView && rootRef.current) {
        console.log('💥', {
          id,
          root: rootRef.current,
        });
        rootRef.current.classList.remove('hidden');
      }
    },
    {
      rootMargin: `-${TOP}px 0px 0px 0px`,
      triggerOnce: true,
    },
  );

  useLayoutEffect(() => {
    if (!rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    if (rect.bottom <= TOP) {
      const childElementCount = rootRef.current.childElementCount;
      const hasChildren = childElementCount > 0;
      if (hasChildren) {
        // Don't need to observe if has children
        observerRef(null);
        // Debugging
        if (import.meta.env.DEV) {
          rootRef.current.dataset.rectBottom = rect.bottom;
          rootRef.current.dataset.childElementCount = childElementCount;
        }
      } else {
        rootRef.current.classList.add('hidden');
      }
    }
  }, []);

  return (
    <Root
      {...props}
      ref={(node) => {
        rootRef.current = node;
        observerRef(node);
      }}
      class={`lazy-render ${className || ''}`}
    >
      {children}
    </Root>
  );
}
