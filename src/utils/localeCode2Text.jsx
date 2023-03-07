export default function localeCode2Text(code) {
  return new Intl.DisplayNames(navigator.languages, {
    type: 'language',
  }).of(code);
}
