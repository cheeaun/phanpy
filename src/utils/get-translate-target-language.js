import languages from '../data/translang-languages';

import localeMatch from './locale-match';
import states from './states';

const translationTargetLanguages = Object.entries(languages.tl).map(
  ([code, { name }]) => ({
    code,
    name,
  }),
);

const locales = [...navigator.languages];
try {
  const dtfLocale = new Intl.DateTimeFormat().resolvedOptions().locale;
  if (!locales.includes(dtfLocale)) {
    locales.unshift(dtfLocale);
  }
} catch {}

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
