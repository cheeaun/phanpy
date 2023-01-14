import { useEffect, useState } from 'preact/hooks';

export default function useScroll({
  scrollableElement,
  distanceFromStart = 0,
  distanceFromEnd = 0,
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
    console.warn('Scrollable element is not defined');
    scrollableElement = window;
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
      const distanceFromStartPx =
        scrollDimension * Math.min(1, Math.max(0, distanceFromStart));
      const distanceFromEndPx =
        scrollDimension * Math.min(1, Math.max(0, distanceFromEnd));

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
    scrollableElement.dispatchEvent(new Event('scroll'));

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
  };
}
