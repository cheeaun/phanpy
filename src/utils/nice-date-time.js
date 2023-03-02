function niceDateTime(date, { hideTime } = {}) {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  const currentYear = new Date().getFullYear();
  const locale = new Intl.DateTimeFormat().resolvedOptions().locale;
  const dateText = Intl.DateTimeFormat(locale, {
    // Show year if not current year
    year: date.getFullYear() === currentYear ? undefined : 'numeric',
    month: 'short',
    day: 'numeric',
    // Hide time if requested
    hour: hideTime ? undefined : 'numeric',
    minute: hideTime ? undefined : 'numeric',
  }).format(date);
  return dateText;
}

export default niceDateTime;
