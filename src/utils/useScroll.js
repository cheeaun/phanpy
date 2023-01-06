import { useEffect, useState } from 'preact/hooks';

export default function useScroll({
  scrollableElement = window,
  distanceFromTop = 0,
  distanceFromBottom = 0,
  scrollThreshold = 10,
} = {}) {
  const [scrollDirection, setScrollDirection] = useState(null);
  const [reachTop, setReachTop] = useState(false);
  const [nearReachTop, setNearReachTop] = useState(false);
  const [nearReachBottom, setNearReachBottom] = useState(false);

  useEffect(() => {
    let previousScrollTop = scrollableElement.scrollTop;

    function onScroll() {
      const { scrollTop, scrollHeight, clientHeight } = scrollableElement;
      const scrollDistance = Math.abs(scrollTop - previousScrollTop);
      const distanceFromTopPx =
        scrollHeight * Math.min(1, Math.max(0, distanceFromTop));
      const distanceFromBottomPx =
        scrollHeight * Math.min(1, Math.max(0, distanceFromBottom));

      if (scrollDistance >= scrollThreshold) {
        setScrollDirection(previousScrollTop < scrollTop ? 'down' : 'up');
        previousScrollTop = scrollTop;
      }

      setReachTop(scrollTop === 0);
      setNearReachTop(scrollTop <= distanceFromTopPx);
      setNearReachBottom(
        scrollTop + clientHeight >= scrollHeight - distanceFromBottomPx,
      );
    }

    scrollableElement.addEventListener('scroll', onScroll, { passive: true });

    return () => scrollableElement.removeEventListener('scroll', onScroll);
  }, [scrollableElement, distanceFromTop, distanceFromBottom, scrollThreshold]);

  return { scrollDirection, reachTop, nearReachTop, nearReachBottom };
}
