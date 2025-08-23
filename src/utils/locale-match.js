import { match } from '@formatjs/intl-localematcher';

import mem from './mem';

function _localeMatch(...args) {
  // Wrap in try/catch because localeMatcher throws on invalid locales
  try {
    return match(...args);
  } catch (e) {
    const defaultLocale = args[2];
    return defaultLocale || false;
  }
}
if (typeof window !== 'undefined') {
  window._localeMatch = _localeMatch; // For debugging
}
const localeMatch = mem(_localeMatch);

export default localeMatch;
