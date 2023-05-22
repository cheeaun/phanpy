import translationTargetLanguages from '../data/lingva-target-languages';

import localeMatch from './locale-match';
import states from './states';

function getTranslateTargetLanguage(fromSettings = false) {
  if (fromSettings) {
    const { contentTranslationTargetLanguage } = states.settings;
    if (contentTranslationTargetLanguage) {
      return contentTranslationTargetLanguage;
    }
  }
  return localeMatch(
    [
      new Intl.DateTimeFormat().resolvedOptions().locale,
      ...navigator.languages,
    ],
    translationTargetLanguages.map((l) => l.code.replace('_', '-')), // The underscore will fail Intl.Locale inside `match`
    'en',
  );
}

export default getTranslateTargetLanguage;
