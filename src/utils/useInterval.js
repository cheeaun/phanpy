import { useEffect, useRef } from 'preact/hooks';

function useInterval(fn, delay, deps, immediate) {
  const savedCallback = useRef(fn);
  useEffect(() => {
    savedCallback.current = fn;
  }, [fn, deps]);

  useEffect(() => {
    if (!immediate || delay === null || delay === false) return;
    savedCallback.current();
  }, [immediate]);

  useEffect(() => {
    if (delay === null || delay === false) return;
    const tick = () => savedCallback.current();
    const id = setInterval(tick, delay);
    return () => clearInterval(id);
  }, [delay]);
}

export default useInterval;
