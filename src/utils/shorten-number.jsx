const { locale } = Intl.NumberFormat().resolvedOptions();

export default function shortenNumber(num) {
  return Intl.NumberFormat(locale, {
    notation: 'compact',
  }).format(num);
}
