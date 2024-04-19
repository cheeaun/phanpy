// Twitter-style relative time component
// Seconds = 1s
// Minutes = 1m
// Hours = 1h
// Days = 1d
// After 7 days, use DD/MM/YYYY or MM/DD/YYYY
import dayjs from 'dayjs';
import dayjsTwitter from 'dayjs-twitter';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useEffect, useMemo, useReducer } from 'preact/hooks';

dayjs.extend(dayjsTwitter);
dayjs.extend(localizedFormat);
dayjs.extend(relativeTime);

const dtf = new Intl.DateTimeFormat();

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
      if (dayDiff <= 1 || now.year() === date.year()) {
        str = date.twitter();
      } else {
        str = dtf.format(date.toDate());
      }
    }
    if (!str) str = date.fromNow();
    return [str, date.toISOString(), date.format('LLLL')];
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
