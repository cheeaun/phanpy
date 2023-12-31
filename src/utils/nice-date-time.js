import mem from './mem';

const { locale } = new Intl.DateTimeFormat().resolvedOptions();

const _DateTimeFormat = (opts) => {
  const { dateYear, hideTime, formatOpts } = opts || {};
  const currentYear = new Date().getFullYear();
  return Intl.DateTimeFormat(locale, {
    // Show year if not current year
    year: dateYear === currentYear ? undefined : 'numeric',
    month: 'short',
    day: 'numeric',
    // Hide time if requested
    hour: hideTime ? undefined : 'numeric',
    minute: hideTime ? undefined : 'numeric',
    ...formatOpts,
  });
};
const DateTimeFormat = mem(_DateTimeFormat);

function niceDateTime(date, dtfOpts) {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  const DTF = DateTimeFormat({
    dateYear: date.getFullYear(),
    ...dtfOpts,
  });
  const dateText = DTF.format(date);
  return dateText;
}

export default niceDateTime;
