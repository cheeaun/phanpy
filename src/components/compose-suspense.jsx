import { shouldPolyfill } from '@formatjs/intl-segmenter/should-polyfill';
import { useEffect, useState } from 'preact/hooks';

import Loader from './loader';

const supportsIntlSegmenter = !shouldPolyfill();

function importIntlSegmenter() {
  if (!supportsIntlSegmenter) {
    return import('@formatjs/intl-segmenter/polyfill-force').catch(() => {});
  }
}

function importCompose() {
  return import('./compose');
}

export async function preload() {
  try {
    await importIntlSegmenter();
    importCompose();
  } catch (e) {
    console.error(e);
  }
}

export default function ComposeSuspense(props) {
  const [Compose, setCompose] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        if (supportsIntlSegmenter) {
          const component = await importCompose();
          setCompose(component);
        } else {
          await importIntlSegmenter();
          const component = await importCompose();
          setCompose(component);
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  return Compose?.default ? <Compose.default {...props} /> : <Loader />;
}
