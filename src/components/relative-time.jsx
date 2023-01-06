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
import { useEffect, useState } from 'preact/hooks';

dayjs.extend(dayjsTwitter);
dayjs.extend(localizedFormat);
dayjs.extend(relativeTime);

const dtf = new Intl.DateTimeFormat();

export default function RelativeTime({ datetime, format }) {
  if (!datetime) return null;
  const date = dayjs(datetime);
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    let timer, raf;
    const update = () => {
      raf = requestAnimationFrame(() => {
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
        } else {
          str = date.fromNow();
        }
        setDateStr(str);

        timer = setTimeout(update, 30_000);
      });
    };
    raf = requestAnimationFrame(update);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [date]);

  return (
    <time datetime={date.toISOString()} title={date.format('LLLL')}>
      {dateStr}
    </time>
  );
}
