import { i18n } from '@lingui/core';

export default function shortenNumber(num: number): string | number {
  try {
    return i18n.number(num, {
      notation: 'compact',
      roundingMode: 'floor',
    });
  } catch {
    return num;
  }
}
