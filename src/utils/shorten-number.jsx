const { locale } = Intl.NumberFormat().resolvedOptions();
const shortenNumber = Intl.NumberFormat(locale, {
  notation: 'compact',
  roundingMode: 'floor',
}).format;
export default shortenNumber;
