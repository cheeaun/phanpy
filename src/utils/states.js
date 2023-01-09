import { proxy } from 'valtio';

const states = proxy({
  history: [],
  statuses: {},
  home: [],
  homeNew: [],
  homeLastFetchTime: null,
  notifications: [],
  notificationsNew: [],
  notificationsLastFetchTime: null,
  accounts: {},
  reloadStatusPage: 0,
  spoilers: {},
  scrollPositions: {},
  // Modals
  showCompose: false,
  showSettings: false,
  showAccount: false,
  composeCharacterCount: 0,
});
export default states;

export function saveStatus(status, opts) {
  const { override } = Object.assign({ override: true }, opts);
  if (!status) return;
  if (!override && states.statuses[status.id]) return;
  states.statuses[status.id] = status;
  if (status.reblog) {
    states.statuses[status.reblog.id] = status.reblog;
  }
}
