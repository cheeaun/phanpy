import { proxy } from 'valtio';

export default proxy({
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
