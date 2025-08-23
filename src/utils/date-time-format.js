import localeMatch from './locale-match.js';
import mem from './mem.js';

function initLocales() {
  const newLocales = [...navigator.languages];
  try {
    const dtfLocale = new Intl.DateTimeFormat().resolvedOptions().locale;
    if (!newLocales.includes(dtfLocale)) {
      newLocales.push(dtfLocale);
    }
  } catch {}
  return newLocales;
}

let locales = initLocales();

// For testing: refresh locales from current navigator state
export function refreshLocales() {
  locales = initLocales();
}

const createLocale = mem((language, options = {}) => {
  try {
    return new Intl.Locale(language, options);
  } catch {
    // Fallback to simple string splitting
    // May not work properly due to how complicated this is
    if (!language) return null;

    // https://www.w3.org/International/articles/language-tags/
    // Parts: language-extlang-script-region-variant-extension-privateuse
    const [langPart, ...parts] = language.split('-', 4);
    const regionPart = parts.pop() || null;
    const fallbackLocale = {
      language: langPart,
      region: regionPart,
      ...options,
      toString: () => {
        const lang = fallbackLocale.language;
        const middle = parts.length > 0 ? `-${parts.join('-')}-` : '-';
        const reg = fallbackLocale.region;
        return reg ? `${lang}${middle}${reg}` : lang;
      },
    };
    return fallbackLocale;
  }
});

const _DateTimeFormat = (locale, opts) => {
  const options = opts;

  const appLocale = createLocale(locale);

  // Find first user locale with a region
  let userRegion = null;
  for (const loc of locales) {
    const region = createLocale(loc)?.region;
    if (region) {
      userRegion = region;
      break;
    }
  }

  const userRegionLocale =
    userRegion && appLocale && appLocale.region !== userRegion
      ? createLocale(appLocale.language, {
          ...appLocale,
          region: userRegion,
        })?.toString()
      : null;

  const matchedLocale = localeMatch(
    [userRegionLocale, locale, locale?.replace(/-[a-z]+$/i, '')],
    locales,
    locale,
  );

  try {
    return new Intl.DateTimeFormat(matchedLocale, options);
  } catch {
    return new Intl.DateTimeFormat(undefined, options);
  }
};

const DateTimeFormat = mem(_DateTimeFormat);

export default DateTimeFormat;
