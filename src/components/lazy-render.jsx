import { Children } from 'preact/compat';
import { useRef, useMemo } from 'preact/hooks';
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

  const hasChildren = useMemo(
    () => Children.toArray(children).filter((child) => !!child).length > 0,
    [children],
  );

  const observerRef = useOnInView(
    (inView, entry) => {
      if (!rootRef.current) return;
      const node = rootRef.current;
      if (inView) {
        console.log('💥', { id, root: node });
        node.classList.remove('hidden');
      } else if (entry.boundingClientRect.bottom <= TOP) {
        // Element is above the fold (already scrolled past)
        if (hasChildren && renderIfHasChildren) {
          // Don't need to observe if has children
          observerRef(null);
          // Debugging
          if (import.meta.env.DEV) {
            node.dataset.rectBottom = entry.boundingClientRect.bottom;
          }
        } else {
          node.classList.add('hidden');
        }
      }
    },
    {
      rootMargin: `-${TOP}px 0px 0px 0px`,
      triggerOnce: true,
      skip: !hasChildren,
    },
  );

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
