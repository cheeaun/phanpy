import { useLayoutEffect, useRef, useState } from 'preact/hooks';

const IntersectionView = ({ children, root = null, fallback = null }) => {
  const ref = useRef();
  const [show, setShow] = useState(false);
  useLayoutEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setShow(true);
          observer.unobserve(ref.current);
        }
      },
      {
        root,
        rootMargin: `${screen.height}px`,
      },
    );
    if (ref.current) observer.observe(ref.current);
    return () => {
      if (ref.current) observer.unobserve(ref.current);
    };
  }, []);

  return show ? children : <div ref={ref}>{fallback}</div>;
};

export default IntersectionView;
