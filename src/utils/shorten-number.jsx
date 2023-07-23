const { locale } = Intl.NumberFormat().resolvedOptions();
const shortenNumber = Intl.NumberFormat(locale, {
  notation: 'compact',
}).format;
export default shortenNumber;
