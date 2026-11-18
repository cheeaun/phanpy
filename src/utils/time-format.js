import store from './store';

export default function getHourCycle() {
  const timeFormat = store.local.get('timeFormat');
  return timeFormat === 'h12' || timeFormat === 'h23' ? timeFormat : null;
}
