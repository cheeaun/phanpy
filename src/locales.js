export const DEFAULT_LANG = 'en';

const locales = [
  DEFAULT_LANG,
  'zh-CN',
  'eu-ES',
  'es-ES',
  'fi-FI',
  'gl-ES',
  'de-DE',
];
if (import.meta.env.DEV) {
  locales.push('pseudo-LOCALE');
}
export const LOCALES = locales;
