import { i18n } from '@lingui/core';

import NF from './nf';

export default function shortenNumber(num) {
  try {
    return NF(i18n.locale, {
      notation: 'compact',
      roundingMode: 'floor',
    }).format(num);
  } catch (e) {
    return num;
  }
}
