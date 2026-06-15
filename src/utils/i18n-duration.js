import { i18n } from '@lingui/core';

import NF from './nf';

export default function i18nDuration(duration, unit) {
  return () =>
    NF(i18n.locale, {
      style: 'unit',
      unit,
      unitDisplay: 'long',
    }).format(duration);
}
