import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { useThrottledCallback } from 'use-debounce';

export default function useScrollFn(
  {
    scrollableRef,
    distanceFromStart = 1, // ratio of clientHeight/clientWidth
    distanceFromEnd = 1, // ratio of clientHeight/clientWidth
    scrollThresholdStart = 10,
    scrollThresholdEnd = 10,
    direction = 'vertical',
    distanceFromStartPx: _distanceFromStartPx,
    distanceFromEndPx: _distanceFromEndPx,
    init,
  } = {},
  callback,
  deps,
) {
  if (!callback) return;
  const [scrollDirection, setScrollDirection] = useState(null);
  const [reachStart, setReachStart] = useState(false);
  const [reachEnd, setReachEnd] = useState(false);
  const [nearReachStart, setNearReachStart] = useState(false);
  const [nearReachEnd, setNearReachEnd] = useState(false);
  const isVertical = direction === 'vertical';
  const previousScrollStart = useRef(null);

  const onScroll = useThrottledCallback(() => {
    const scrollableElement = scrollableRef.current;
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
    const scrollDistance = Math.abs(scrollStart - previousScrollStart.current);
    const distanceFromStartPx =
      _distanceFromStartPx ||
      Math.min(
        clientDimension * distanceFromStart,
        scrollDimension,
        scrollStart,
      );
    const distanceFromEndPx =
      _distanceFromEndPx ||
      Math.min(
        clientDimension * distanceFromEnd,
        scrollDimension,
        scrollDimension - scrollStart - clientDimension,
      );

    if (
      scrollDistance >=
      (previousScrollStart.current < scrollStart
        ? scrollThresholdEnd
        : scrollThresholdStart)
    ) {
      setScrollDirection(
        previousScrollStart.current < scrollStart ? 'end' : 'start',
      );
      previousScrollStart.current = scrollStart;
    }

    setReachStart(scrollStart <= 0);
    setReachEnd(scrollStart + clientDimension >= scrollDimension);
    setNearReachStart(scrollStart <= distanceFromStartPx);
    setNearReachEnd(
      scrollStart + clientDimension >= scrollDimension - distanceFromEndPx,
    );
  }, 500);

  useLayoutEffect(() => {
    const scrollableElement = scrollableRef.current;
    if (!scrollableElement) return {};
    previousScrollStart.current =
      scrollableElement[isVertical ? 'scrollTop' : 'scrollLeft'];

    scrollableElement.addEventListener('scroll', onScroll, { passive: true });

    return () => scrollableElement.removeEventListener('scroll', onScroll);
  }, [
    distanceFromStart,
    distanceFromEnd,
    scrollThresholdStart,
    scrollThresholdEnd,
  ]);

  useEffect(() => {
    callback({
      scrollDirection,
      reachStart,
      reachEnd,
      nearReachStart,
      nearReachEnd,
    });
  }, [
    scrollDirection,
    reachStart,
    reachEnd,
    nearReachStart,
    nearReachEnd,
    ...deps,
  ]);

  useEffect(() => {
    if (init && scrollableRef.current) {
      queueMicrotask(() => {
        scrollableRef.current.dispatchEvent(new Event('scroll'));
      });
    }
  }, [init]);

  // return {
  //   scrollDirection,
  //   reachStart,
  //   reachEnd,
  //   nearReachStart,
  //   nearReachEnd,
  //   init: () => {
  //     if (scrollableRef.current) {
  //       scrollableRef.current.dispatchEvent(new Event('scroll'));
  //     }
  //   },
  // };
}
