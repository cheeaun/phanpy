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
) {
  if (!callback) return;
  const isVertical = direction === 'vertical';
  const previousScrollStart = useRef(null);
  const scrollDirection = useRef(null);

  const onScroll = useThrottledCallback(
    () => {
      let reachStart = false;
      let reachEnd = false;
      let nearReachStart = false;
      let nearReachEnd = false;

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
      const scrollDelta = scrollStart - previousScrollStart.current;
      const isScrollingForward = scrollDelta > 0;
      const threshold = isScrollingForward
        ? scrollThresholdEnd
        : scrollThresholdStart;
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

      if (Math.abs(scrollDelta) >= threshold) {
        scrollDirection.current = isScrollingForward ? 'end' : 'start';
        previousScrollStart.current = scrollStart;
      }

      reachStart = scrollStart <= 0;
      reachEnd = scrollStart + clientDimension >= scrollDimension;
      nearReachStart = scrollStart <= distanceFromStartPx;
      nearReachEnd =
        scrollStart + clientDimension >= scrollDimension - distanceFromEndPx;

      callback({
        scrollDirection: scrollDirection.current,
        reachStart,
        reachEnd,
        nearReachStart,
        nearReachEnd,
      });
    },
    500,
    {
      leading: false,
    },
  );

  useLayoutEffect(() => {
    const scrollableElement = scrollableRef.current;
    if (scrollableElement) {
      previousScrollStart.current =
        scrollableElement[isVertical ? 'scrollTop' : 'scrollLeft'];
      scrollableElement.addEventListener('scroll', onScroll, { passive: true });
    }
    return () => {
      if (scrollableElement) {
        scrollableElement.removeEventListener('scroll', onScroll);
      }
    };
  }, []);

  useEffect(() => {
    if (init && scrollableRef.current) {
      queueMicrotask(() => {
        scrollableRef.current.dispatchEvent(new Event('scroll'));
      });
    }
  }, [init]);

  return {
    resetScrollDirection: () => {
      scrollDirection.current = null;
    },
  };
}
