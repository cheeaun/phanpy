import { proxy } from 'valtio';
import { proxyMap } from 'valtio/utils';

export default proxy({
  history: [],
  statuses: proxyMap([]),
  home: [],
  homeNew: [],
  homeLastFetchTime: null,
  notifications: [],
  notificationsNew: [],
  notificationsLastFetchTime: null,
  accounts: new WeakMap(),
  reloadStatusPage: 0,
  // Modals
  showCompose: false,
  showSettings: false,
  showAccount: false,
});
