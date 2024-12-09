import { i18n } from '@lingui/core';

export default function shortenNumber(num) {
  try {
    return i18n.number(num, {
      notation: 'compact',
      roundingMode: 'floor',
    });
  } catch (e) {
    return num;
  }
}
