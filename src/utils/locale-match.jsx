import { match } from '@formatjs/intl-localematcher';

function localeMatch(...args) {
  // Wrap in try/catch because localeMatcher throws on invalid locales
  try {
    return match(...args);
  } catch (e) {
    return false;
  }
}

export default localeMatch;
