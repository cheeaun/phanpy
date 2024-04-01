import { shouldPolyfill } from '@formatjs/intl-segmenter/should-polyfill';
import { Suspense } from 'preact/compat';
import { useEffect, useState } from 'preact/hooks';

import Loader from './loader';

const supportsIntlSegmenter = !shouldPolyfill();

export default function IntlSegmenterSuspense({ children }) {
  if (supportsIntlSegmenter) {
    return <Suspense fallback={<Loader />}>{children}</Suspense>;
  }

  const [polyfillLoaded, setPolyfillLoaded] = useState(false);
  useEffect(() => {
    (async () => {
      await import('@formatjs/intl-segmenter/polyfill-force');
      setPolyfillLoaded(true);
    })();
  }, []);

  return polyfillLoaded ? (
    <Suspense fallback={<Loader />}>{children}</Suspense>
  ) : (
    <Loader />
  );
}
