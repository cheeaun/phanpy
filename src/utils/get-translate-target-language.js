import languages from '../data/translang-languages';

import { getDtfLocale } from './dtf-locale';
import localeMatch from './locale-match';
import states from './states';

const translationTargetLanguages = Object.entries(languages.tl).map(
  ([code, { name }]) => ({
    code,
    name,
  }),
);

const locales = [...navigator.languages];
const dtfLocale = getDtfLocale();
if (dtfLocale && !locales.includes(dtfLocale)) {
  locales.unshift(dtfLocale);
}

const localeTargetLanguages = () =>
  localeMatch(
    locales,
    translationTargetLanguages.map((l) => l.code.replace('_', '-')), // The underscore will fail Intl.Locale inside `match`
    'en',
  );

function getTranslateTargetLanguage(fromSettings = false) {
  if (fromSettings) {
    const { contentTranslationTargetLanguage } = states.settings;
    if (contentTranslationTargetLanguage) {
      return contentTranslationTargetLanguage;
    }
  }
  return localeTargetLanguages();
}

export default getTranslateTargetLanguage;
