import { i18n } from '@lingui/core';

import DateTimeFormat from './date-time-format';
import getHourCycle from './time-format';

function niceDateTime(date, dtfOpts) {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }

  const { hideTime, formatOpts, forceOpts } = dtfOpts || {};
  const currentYear = new Date().getFullYear();
  let options = forceOpts || {
    // Show year if not current year
    year: date.getFullYear() === currentYear ? undefined : 'numeric',
    month: 'short',
    day: 'numeric',
    // Hide time if requested
    hour: hideTime ? undefined : 'numeric',
    minute: hideTime ? undefined : 'numeric',
    ...formatOpts,
  };

  const hourCycle = getHourCycle();
  const hasTime =
    !hideTime && !!(options.hour || options.minute || options.timeStyle);
  if (hourCycle && hasTime && !options.hour12 && !options.hourCycle) {
    options = { ...options, hourCycle };
  }

  const DTF = DateTimeFormat(i18n.locale, options);
  const dateText = DTF.format(date);
  return dateText;
}

export default niceDateTime;
