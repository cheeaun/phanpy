import translationTargetLanguages from '../data/lingva-target-languages';

import localeMatch from './locale-match';
import states from './states';

const locales = [
  new Intl.DateTimeFormat().resolvedOptions().locale,
  ...navigator.languages,
];

const localeTargetLanguages = localeMatch(
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
  return localeTargetLanguages;
}

export default getTranslateTargetLanguage;
