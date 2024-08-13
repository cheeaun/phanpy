import { i18n } from '@lingui/core';

import mem from './mem';

// Some codes are not supported by Intl.DisplayNames
// These are mapped to other codes as fallback
const codeMappings = {
  'zh-YUE': 'YUE',
  zh_HANT: 'zh-Hant',
};

const IntlDN = mem(
  (locale) =>
    new Intl.DisplayNames(locale || undefined, {
      type: 'language',
    }),
);

function _localeCode2Text(code) {
  let locale;
  let fallback;
  if (typeof code === 'object') {
    ({ code, locale, fallback } = code);
  }
  try {
    const text = IntlDN(locale || i18n.locale).of(code);
    if (text !== code) return text;
    return fallback || '';
  } catch (e) {
    if (codeMappings[code]) {
      try {
        const text = IntlDN(locale || i18n.locale).of(codeMappings[code]);
        if (text !== codeMappings[code]) return text;
        return fallback || '';
      } catch (e) {}
    }
    console.warn(code, e);
    return fallback || '';
  }
}

export default mem(_localeCode2Text);
