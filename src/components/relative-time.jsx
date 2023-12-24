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

dayjs.extend(dayjsTwitter);
dayjs.extend(localizedFormat);
dayjs.extend(relativeTime);

const dtf = new Intl.DateTimeFormat();

export default function RelativeTime({ datetime, format }) {
  if (!datetime) return null;
  const date = dayjs(datetime);
  let dateStr;
  if (format === 'micro') {
    // If date <= 1 day ago or day is within this year
    const now = dayjs();
    const dayDiff = now.diff(date, 'day');
    if (dayDiff <= 1 || now.year() === date.year()) {
      dateStr = date.twitter();
    } else {
      dateStr = dtf.format(date.toDate());
    }
  } else {
    dateStr = date.fromNow();
  }

  return (
    <time datetime={date.toISOString()} title={date.format('LLLL')}>
      {dateStr}
    </time>
  );
}
