import { useEffect } from 'preact/hooks';

export default function usePageVisibility(fn = () => {}, deps = []) {
  useEffect(() => {
    const handleVisibilityChange = () => {
      const hidden = document.hidden || document.visibilityState === 'hidden';
      console.log('👀 Page visibility changed', hidden);
      fn(!hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fn, ...deps]);
}
