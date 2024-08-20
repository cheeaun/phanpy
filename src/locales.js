import catalogs from './data/catalogs.json';

export const DEFAULT_LANG = 'en';
export const CATALOGS = catalogs;

// Get locales that's >= X% translated
const PERCENTAGE_THRESHOLD = 50;

const locales = [
  DEFAULT_LANG,
  ...catalogs
    .filter(({ completion }) => completion >= PERCENTAGE_THRESHOLD)
    .map(({ code }) => code),
];
if (import.meta.env.DEV) {
  locales.push('pseudo-LOCALE');
}
export const LOCALES = locales;
