export const DEFAULT_LANG = 'en';

const locales = [
  DEFAULT_LANG,
  'zh-CN', // Chinese (Simplified)
  'eu-ES', // Basque
  'es-ES', // Spanish
  'fi-FI', // Finnish
  'gl-ES', // Galician
  'de-DE', // German
  'ca-ES', // Catalan
  'fr-FR', // French
  'ko-KR', // Korean
];
if (import.meta.env.DEV) {
  locales.push('pseudo-LOCALE');
}
export const LOCALES = locales;
