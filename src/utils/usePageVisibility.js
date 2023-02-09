import { useEffect, useRef } from 'preact/hooks';

export default function usePageVisibility(fn = () => {}, deps = []) {
  const savedCallback = useRef(fn, deps);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const hidden = document.hidden || document.visibilityState === 'hidden';
      console.log('👀 Page visibility changed', hidden ? 'hidden' : 'visible');
      savedCallback.current(!hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);
}
