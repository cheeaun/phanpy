import mem from './mem';

const IntlDN = new Intl.DisplayNames(undefined, {
  type: 'language',
});

function _localeCode2Text(code) {
  try {
    return IntlDN.of(code);
  } catch (e) {
    console.error(e);
    return null;
  }
}

export default mem(_localeCode2Text);
