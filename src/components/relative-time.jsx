import { i18n } from '@lingui/core';
import { t } from '@lingui/core/macro';
import { useEffect, useMemo, useReducer } from 'preact/hooks';

import localeMatch from '../utils/locale-match';
import mem from '../utils/mem';

function isValidDate(value) {
  if (value instanceof Date) {
    return !isNaN(value.getTime());
  } else {
    const date = new Date(value);
    return !isNaN(date.getTime());
  }
}

const resolvedLocale = mem(
  () => new Intl.DateTimeFormat().resolvedOptions().locale,
);
const DTF = mem((locale, opts = {}) => {
  const regionlessLocale = locale.replace(/-[a-z]+$/i, '');
  const lang = localeMatch([regionlessLocale], [resolvedLocale()], locale);
  try {
    return new Intl.DateTimeFormat(lang, opts);
  } catch (e) {}
  try {
    return new Intl.DateTimeFormat(locale, opts);
  } catch (e) {}
  return new Intl.DateTimeFormat(undefined, opts);
});
const RTF = mem((locale) => new Intl.RelativeTimeFormat(locale || undefined));

const minute = 60;
const hour = 60 * minute;
const day = 24 * hour;

const rtfFromNow = (date) => {
  // date = Date object
  const rtf = RTF(i18n.locale);
  const seconds = (date.getTime() - Date.now()) / 1000;
  const absSeconds = Math.abs(seconds);
  if (absSeconds < minute) {
    return rtf.format(Math.floor(seconds), 'second');
  } else if (absSeconds < hour) {
    return rtf.format(Math.floor(seconds / minute), 'minute');
  } else if (absSeconds < day) {
    return rtf.format(Math.floor(seconds / hour), 'hour');
  } else if (absSeconds < 30 * day) {
    return rtf.format(Math.floor(seconds / day), 'day');
  } else {
    return rtf.format(Math.floor(seconds / day / 30), 'month');
  }
};

const twitterFromNow = (date) => {
  // date = Date object
  const seconds = (Date.now() - date.getTime()) / 1000;
  if (seconds < minute) {
    return t({
      comment: 'Relative time in seconds, as short as possible',
      message: `${seconds < 1 ? 1 : Math.floor(seconds)}s`,
    });
  } else if (seconds < hour) {
    return t({
      comment: 'Relative time in minutes, as short as possible',
      message: `${Math.floor(seconds / minute)}m`,
    });
  } else {
    return t({
      comment: 'Relative time in hours, as short as possible',
      message: `${Math.floor(seconds / hour)}h`,
    });
  }
};

export default function RelativeTime({ datetime, format }) {
  if (!datetime) return null;
  const [renderCount, rerender] = useReducer((x) => x + 1, 0);
  const date = useMemo(() => new Date(datetime), [datetime]);
  const [dateStr, dt, title] = useMemo(() => {
    if (!isValidDate(date))
      return ['' + (typeof datetime === 'string' ? datetime : ''), '', ''];
    let str;
    if (format === 'micro') {
      // If date <= 1 day ago or day is within this year
      const now = new Date();
      const dayDiff = (now.getTime() - date.getTime()) / 1000 / day;
      if (dayDiff <= 1) {
        str = twitterFromNow(date);
      } else {
        const sameYear = now.getFullYear() === date.getFullYear();
        if (sameYear) {
          str = DTF(i18n.locale, {
            year: undefined,
            month: 'short',
            day: 'numeric',
          }).format(date);
        } else {
          str = DTF(i18n.locale, {
            dateStyle: 'short',
          }).format(date);
        }
      }
    }
    if (!str) str = rtfFromNow(date);
    return [str, date.toISOString(), date.toLocaleString()];
  }, [date, format, renderCount]);

  useEffect(() => {
    if (!isValidDate(date)) return;
    let timeout;
    let raf;
    function rafRerender() {
      raf = requestAnimationFrame(() => {
        rerender();
        scheduleRerender();
      });
    }
    function scheduleRerender() {
      // If less than 1 minute, rerender every 10s
      // If less than 1 hour rerender every 1m
      // Else, don't need to rerender
      const seconds = (Date.now() - date.getTime()) / 1000;
      if (seconds < minute) {
        timeout = setTimeout(rafRerender, 10_000);
      } else if (seconds < hour) {
        timeout = setTimeout(rafRerender, 60_000);
      }
    }
    scheduleRerender();
    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <time datetime={dt} title={title}>
      {dateStr}
    </time>
  );
}
