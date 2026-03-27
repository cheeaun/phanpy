import { Children } from 'preact/compat';
import { useLayoutEffect, useRef, useMemo } from 'preact/hooks';
import { useOnInView } from 'react-intersection-observer';

// The sticky header, usually at the top
const TOP = 48;

export default function LazyRender({
  as: Root = 'div',
  id,
  class: className,
  children,
  renderIfHasChildren = true,
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

  const hasChildren = useMemo(
    () => Children.toArray(children).filter((child) => !!child).length > 0,
    [children],
  );

  useLayoutEffect(() => {
    if (!rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    if (rect.bottom <= TOP) {
      if (hasChildren && renderIfHasChildren) {
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
  }, [hasChildren, renderIfHasChildren]);

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
