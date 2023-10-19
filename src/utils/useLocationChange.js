import { useEffect, useRef } from 'preact/hooks';
import { useLocation } from 'react-router-dom';

// Hook that runs a callback when the location changes
// Won't run on the first render

export default function useLocationChange(fn) {
  if (!fn) return;
  const location = useLocation();
  const currentLocationRef = useRef(location.pathname);
  useEffect(() => {
    // console.log('location', {
    //   current: currentLocationRef.current,
    //   next: location.pathname,
    // });
    if (
      currentLocationRef.current &&
      location.pathname !== currentLocationRef.current
    ) {
      fn?.();
    }
  }, [location.pathname, fn]);
}
