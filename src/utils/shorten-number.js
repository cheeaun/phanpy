import { i18n } from '@lingui/core';
import { t } from '@lingui/macro';

import store from '../utils/store';

export default function shortenNumber(num) {
  const numberlessMode = store.account.get('settings-numberlessMode');
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
