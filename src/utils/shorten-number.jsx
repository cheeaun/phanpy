export default function shortenNumber(num) {
  return Intl.NumberFormat('en-US', {
    notation: 'compact',
  }).format(num);
}
