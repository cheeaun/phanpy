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
import { useMemo } from 'preact/hooks';

dayjs.extend(dayjsTwitter);
dayjs.extend(localizedFormat);
dayjs.extend(relativeTime);

const dtf = new Intl.DateTimeFormat();

export default function RelativeTime({ datetime, format }) {
  if (!datetime) return null;
  const date = useMemo(() => dayjs(datetime), [datetime]);
  const dateStr = useMemo(() => {
    if (format === 'micro') {
      // If date <= 1 day ago or day is within this year
      const now = dayjs();
      const dayDiff = now.diff(date, 'day');
      if (dayDiff <= 1 || now.year() === date.year()) {
        return date.twitter();
      } else {
        return dtf.format(date.toDate());
      }
    }
    return date.fromNow();
  }, [date, format]);
  const dt = useMemo(() => date.toISOString(), [date]);
  const title = useMemo(() => date.format('LLLL'), [date]);

  return (
    <time datetime={dt} title={title}>
      {dateStr}
    </time>
  );
}
