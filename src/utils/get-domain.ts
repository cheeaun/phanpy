import mem from './mem';
import { toUnicode } from 'punycode/';

function getDomain(url: string): string {
  try {
    const parsedUrl = URL.parse(url);

    if (parsedUrl === null) {
      throw new TypeError('Invalid URL');
    }

    return toUnicode(
      parsedUrl.hostname.replace(/^www\./u, '').replace(/\/$/u, ''),
    );
  } catch {
    // Just give up
    return '';
  }
}

// Memoized version of getDomain for better performance
export default mem(getDomain);
