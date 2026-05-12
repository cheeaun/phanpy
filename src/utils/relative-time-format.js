import mem from './mem';

export default mem(
  (locale) => new Intl.RelativeTimeFormat(locale || undefined),
);
