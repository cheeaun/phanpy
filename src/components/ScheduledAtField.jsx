import { useEffect, useState } from 'preact/hooks';

export const MIN_SCHEDULED_AT = 6 * 60 * 1000; // 6 mins
const MAX_SCHEDULED_AT = 90 * 24 * 60 * 60 * 1000; // 90 days

export default function ScheduledAtField({ scheduledAt, setScheduledAt }) {
  if (!scheduledAt || !(scheduledAt instanceof Date)) {
    console.warn('scheduledAt is not a Date:', scheduledAt);
    return;
  }
  const [minStr, setMinStr] = useState();
  const [maxStr, setMaxStr] = useState();
  const timezoneOffset = scheduledAt.getTimezoneOffset();

  useEffect(() => {
    function updateMinStr() {
      const min = new Date(Date.now() + MIN_SCHEDULED_AT);
      const str = new Date(min.getTime() - timezoneOffset * 60000)
        .toISOString()
        .slice(0, 16);
      setMinStr(str);
    }
    updateMinStr();

    function updateMaxStr() {
      const max = new Date(Date.now() + MAX_SCHEDULED_AT);
      const str = new Date(max.getTime() - timezoneOffset * 60000)
        .toISOString()
        .slice(0, 16);
      setMaxStr(str);
    }
    updateMaxStr();

    // Update every 10s
    const intervalId = setInterval(() => {
      updateMinStr();
      updateMaxStr();
    }, 1000 * 10);
    return () => clearInterval(intervalId);
  }, []);

  const defaultValue = scheduledAt
    ? new Date(scheduledAt.getTime() - scheduledAt.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : null;

  return (
    <input
      type="datetime-local"
      name="scheduledAt"
      defaultValue={defaultValue}
      min={minStr}
      max={maxStr}
      required
      onChange={(e) => {
        setScheduledAt(new Date(e.target.value));
      }}
    />
  );
}

export function getLocalTimezoneName() {
  const date = new Date();
  const formatter = new Intl.DateTimeFormat(undefined, {
    timeZoneName: 'long',
  });
  const parts = formatter.formatToParts(date);
  const timezoneName = parts.find(
    (part) => part.type === 'timeZoneName',
  )?.value;
  return timezoneName;
}
