import { i18n } from '@lingui/core';
import { t, Trans } from '@lingui/macro';
import dayjs from 'dayjs';
import { useEffect, useMemo, useReducer } from 'preact/hooks';

import localeMatch from '../utils/locale-match';
import mem from '../utils/mem';

const resolvedLocale = new Intl.DateTimeFormat().resolvedOptions().locale;
const DTF = mem((locale, opts = {}) => {
  const lang = localeMatch([locale], [resolvedLocale]);
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
    return rtf.format(seconds, 'second');
  } else if (absSeconds < hour) {
    return rtf.format(Math.floor(seconds / minute), 'minute');
  } else if (absSeconds < day) {
    return rtf.format(Math.floor(seconds / hour), 'hour');
  } else {
    return rtf.format(Math.floor(seconds / day), 'day');
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
  const date = useMemo(() => dayjs(datetime), [datetime]);
  const [dateStr, dt, title] = useMemo(() => {
    if (!date.isValid()) return ['' + datetime, '', ''];
    let str;
    if (format === 'micro') {
      // If date <= 1 day ago or day is within this year
      const now = dayjs();
      const dayDiff = now.diff(date, 'day');
      if (dayDiff <= 1) {
        str = twitterFromNow(date.toDate());
      } else {
        const currentYear = now.year();
        const dateYear = date.year();
        if (dateYear === currentYear) {
          str = DTF(i18n.locale, {
            year: undefined,
            month: 'short',
            day: 'numeric',
          }).format(date.toDate());
        } else {
          str = DTF(i18n.locale, {
            dateStyle: 'short',
          }).format(date.toDate());
        }
      }
    }
    if (!str) str = rtfFromNow(date.toDate());
    return [str, date.toISOString(), date.toDate().toLocaleString()];
  }, [date, format, renderCount]);

  useEffect(() => {
    if (!date.isValid()) return;
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
      if (date.diff(dayjs(), 'minute', true) < 1) {
        timeout = setTimeout(rafRerender, 10_000);
      } else if (date.diff(dayjs(), 'hour', true) < 1) {
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
