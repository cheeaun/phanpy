import punycode from 'punycode/';

import mem from './mem';

function getDomain(url) {
  try {
    return punycode.toUnicode(
      URL.parse(url)
        .hostname.replace(/^www\./, '')
        .replace(/\/$/, ''),
    );
  } catch (e) {
    return ''; // just give up
  }
}

// Memoized version of getDomain for better performance
export default mem(getDomain);
