import mem from './mem';

function getRelativeTimeLocale(locale: unknown): string | undefined {
  if (typeof locale !== 'string') {
    return undefined;
  }
  if (locale === '') {
    return undefined;
  }
  return locale;
}

const relativeTimeFormat = mem(
  (locale: unknown) => new Intl.RelativeTimeFormat(getRelativeTimeLocale(locale)),
);

export default relativeTimeFormat;
