import mem from './mem';

const NF = mem((locale, options) => {
  try {
    return new Intl.NumberFormat(locale || undefined, options);
  } catch (e) {
    return new Intl.NumberFormat(undefined, options);
  }
});

export default NF;
