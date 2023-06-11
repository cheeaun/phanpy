import { match } from '@formatjs/intl-localematcher';
import mem from 'mem';

function _localeMatch(...args) {
  // Wrap in try/catch because localeMatcher throws on invalid locales
  try {
    return match(...args);
  } catch (e) {
    return false;
  }
}
const localeMatch = mem(_localeMatch, {
  cacheKey: (args) => args.join(),
});

export default localeMatch;
