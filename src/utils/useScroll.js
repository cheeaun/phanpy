import { useEffect, useState } from 'preact/hooks';

export default function useScroll({
  scrollableElement = window,
  distanceFromTop = 0,
  distanceFromBottom = 0,
} = {}) {
  const [scrollDirection, setScrollDirection] = useState(null);
  const [reachTop, setReachTop] = useState(false);
  const [nearReachTop, setNearReachTop] = useState(false);
  const [nearReachBottom, setNearReachBottom] = useState(false);

  useEffect(() => {
    let previousScrollTop = scrollableElement.scrollTop;

    function onScroll() {
      const { scrollTop, scrollHeight, clientHeight } = scrollableElement;

      setScrollDirection(previousScrollTop < scrollTop ? 'down' : 'up');
      previousScrollTop = scrollTop;

      setReachTop(scrollTop === 0);
      setNearReachTop(scrollTop <= distanceFromTop);
      setNearReachBottom(
        scrollTop + clientHeight >= scrollHeight - distanceFromBottom,
      );
    }

    scrollableElement.addEventListener('scroll', onScroll, { passive: true });

    return () => scrollableElement.removeEventListener('scroll', onScroll);
  }, [scrollableElement, distanceFromTop, distanceFromBottom]);

  return { scrollDirection, reachTop, nearReachTop, nearReachBottom };
}
