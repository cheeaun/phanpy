import { useEffect, useState } from 'preact/hooks';

export default function useScroll({
  scrollableElement,
  distanceFromStart = 1, // ratio of clientHeight/clientWidth
  distanceFromEnd = 1, // ratio of clientHeight/clientWidth
  scrollThresholdStart = 10,
  scrollThresholdEnd = 10,
  direction = 'vertical',
} = {}) {
  const [scrollDirection, setScrollDirection] = useState(null);
  const [reachStart, setReachStart] = useState(false);
  const [reachEnd, setReachEnd] = useState(false);
  const [nearReachStart, setNearReachStart] = useState(false);
  const [nearReachEnd, setNearReachEnd] = useState(false);
  const isVertical = direction === 'vertical';

  if (!scrollableElement) {
    // Better be explicit instead of auto-assign to window
    return {};
  }

  useEffect(() => {
    let previousScrollStart = isVertical
      ? scrollableElement.scrollTop
      : scrollableElement.scrollLeft;

    function onScroll() {
      const {
        scrollTop,
        scrollLeft,
        scrollHeight,
        scrollWidth,
        clientHeight,
        clientWidth,
      } = scrollableElement;
      const scrollStart = isVertical ? scrollTop : scrollLeft;
      const scrollDimension = isVertical ? scrollHeight : scrollWidth;
      const clientDimension = isVertical ? clientHeight : clientWidth;
      const scrollDistance = Math.abs(scrollStart - previousScrollStart);
      const distanceFromStartPx = clientDimension * distanceFromStart;
      const distanceFromEndPx = clientDimension * distanceFromEnd;

      if (
        scrollDistance >=
        (previousScrollStart < scrollStart
          ? scrollThresholdEnd
          : scrollThresholdStart)
      ) {
        setScrollDirection(previousScrollStart < scrollStart ? 'end' : 'start');
        previousScrollStart = scrollStart;
      }

      setReachStart(scrollStart === 0);
      setReachEnd(scrollStart + clientDimension >= scrollDimension);
      setNearReachStart(scrollStart <= distanceFromStartPx);
      setNearReachEnd(
        scrollStart + clientDimension >= scrollDimension - distanceFromEndPx,
      );
    }

    scrollableElement.addEventListener('scroll', onScroll, { passive: true });

    return () => scrollableElement.removeEventListener('scroll', onScroll);
  }, [
    scrollableElement,
    distanceFromStart,
    distanceFromEnd,
    scrollThresholdStart,
    scrollThresholdEnd,
  ]);

  return {
    scrollDirection,
    reachStart,
    reachEnd,
    nearReachStart,
    nearReachEnd,
    init: () => {
      if (scrollableElement) {
        scrollableElement.dispatchEvent(new Event('scroll'));
      }
    },
  };
}
