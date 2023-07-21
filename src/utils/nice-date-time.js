const { locale } = new Intl.DateTimeFormat().resolvedOptions();

function niceDateTime(date, { hideTime, formatOpts } = {}) {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  const currentYear = new Date().getFullYear();
  const dateText = Intl.DateTimeFormat(locale, {
    // Show year if not current year
    year: date.getFullYear() === currentYear ? undefined : 'numeric',
    month: 'short',
    day: 'numeric',
    // Hide time if requested
    hour: hideTime ? undefined : 'numeric',
    minute: hideTime ? undefined : 'numeric',
    ...formatOpts,
  }).format(date);
  return dateText;
}

export default niceDateTime;
