export default function formatDuration(
  time: number | null | undefined,
): string | undefined {
  if (time === null || time === undefined || time === 0 || Number.isNaN(time)) {
    return undefined;
  }

  const hours = Math.floor(time / 3600);
  const minutes = Math.floor((time % 3600) / 60);
  const seconds = Math.round(time % 60);

  if (hours === 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;
}
