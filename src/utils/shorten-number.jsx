import { i18n } from '@lingui/core';

export default function shortenNumber(num) {
  return i18n.number(num, {
    notation: 'compact',
    roundingMode: 'floor',
  });
}
