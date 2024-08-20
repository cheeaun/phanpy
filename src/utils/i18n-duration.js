import { i18n } from '@lingui/core';

export default function i18nDuration(duration, unit) {
  return () =>
    i18n.number(duration, {
      style: 'unit',
      unit,
      unitDisplay: 'long',
    });
}
