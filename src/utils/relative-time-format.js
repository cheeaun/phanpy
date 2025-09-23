import mem from './mem.js';

export default mem(
  (locale) => new Intl.RelativeTimeFormat(locale || undefined),
);
