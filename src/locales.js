export const DEFAULT_LANG = 'en';

const locales = [DEFAULT_LANG];
if (import.meta.env.DEV) {
  locales.push('pseudo-LOCALE');
}
export const LOCALES = locales;
