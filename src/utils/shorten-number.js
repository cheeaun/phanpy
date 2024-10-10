import { i18n } from '@lingui/core';
import { t } from '@lingui/macro';

import states from '../utils/states';

export default function shortenNumber(num) {
  const numberlessMode = states.settings.numberlessMode;
  if (numberlessMode && num > 1) return t`Several`;

  try {
    return i18n.number(num, {
      notation: 'compact',
      roundingMode: 'floor',
    });
  } catch (e) {
    return num;
  }
}
