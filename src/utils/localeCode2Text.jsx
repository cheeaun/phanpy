export default function localeCode2Text(code) {
  try {
    return new Intl.DisplayNames(navigator.languages, {
      type: 'language',
    }).of(code);
  } catch (e) {
    console.error(e);
    return null;
  }
}
