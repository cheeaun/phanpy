import { proxy, subscribe } from 'valtio';
import { subscribeKey } from 'valtio/utils';

import { api } from './api';
import store from './store';

const states = proxy({
  // history: [],
  prevLocation: null,
  currentLocation: null,
  statuses: {},
  statusThreadNumber: {},
  home: [],
  // specialHome: [],
  homeNew: [],
  homeLast: null, // Last item in 'home' list
  homeLastFetchTime: null,
  notifications: [],
  notificationsLast: store.account.get('notificationsLast') || null, // Last read notification
  notificationsNew: [],
  notificationsShowNew: false,
  notificationsLastFetchTime: null,
  accounts: {},
  reloadStatusPage: 0,
  spoilers: {},
  scrollPositions: {},
  // Modals
  showCompose: false,
  showSettings: false,
  showAccount: false,
  showDrafts: false,
  showMediaModal: false,
  showShortcutsSettings: false,
  // Shortcuts
  shortcuts: store.account.get('shortcuts') ?? [],
  // Settings
  settings: {
    boostsCarousel: store.account.get('settings-boostsCarousel') ?? true,
  },
});

export default states;

subscribeKey(states, 'notificationsLast', (v) => {
  console.log('CHANGE', v);
  store.account.set('notificationsLast', states.notificationsLast);
});
subscribeKey(states, 'settings-boostsCarousel', (v) => {
  store.account.set('settings-boostsCarousel', !!v);
});
subscribe(states, (v) => {
  const [action, path, value] = v[0];
  if (path?.[0] === 'shortcuts') {
    store.account.set('shortcuts', states.shortcuts);
  }
});

export function hideAllModals() {
  states.showCompose = false;
  states.showSettings = false;
  states.showAccount = false;
  states.showDrafts = false;
  states.showMediaModal = false;
}

export function statusKey(id, instance) {
  return instance ? `${instance}/${id}` : id;
}

export function getStatus(statusID, instance) {
  if (instance) {
    const key = statusKey(statusID, instance);
    return states.statuses[key];
  }
  return states.statuses[statusID];
}

export function saveStatus(status, instance, opts) {
  if (typeof instance === 'object') {
    opts = instance;
    instance = null;
  }
  const { override, skipThreading } = Object.assign(
    { override: true, skipThreading: false },
    opts,
  );
  if (!status) return;
  if (!override && getStatus(status.id)) return;
  const key = statusKey(status.id, instance);
  states.statuses[key] = status;
  if (status.reblog) {
    const key = statusKey(status.reblog.id, instance);
    states.statuses[key] = status.reblog;
  }

  // THREAD TRAVERSER
  if (!skipThreading) {
    requestAnimationFrame(() => {
      threadifyStatus(status, instance);
      if (status.reblog) {
        threadifyStatus(status.reblog);
      }
    });
  }
}

export function threadifyStatus(status, propInstance) {
  const { masto, instance } = api({ instance: propInstance });
  // Return all statuses in the thread, via inReplyToId, if inReplyToAccountId === account.id
  let fetchIndex = 0;
  async function traverse(status, index = 0) {
    const { inReplyToId, inReplyToAccountId } = status;
    if (!inReplyToId || inReplyToAccountId !== status.account.id) {
      return [status];
    }
    if (inReplyToId && inReplyToAccountId !== status.account.id) {
      throw 'Not a thread';
      // Possibly thread of replies by multiple people?
    }
    let prevStatus = states.statuses[inReplyToId];
    if (!prevStatus) {
      if (fetchIndex++ > 3) throw 'Too many fetches for thread'; // Some people revive old threads
      await new Promise((r) => setTimeout(r, 500 * fetchIndex)); // Be nice to rate limits
      prevStatus = await masto.v1.statuses.fetch(inReplyToId);
      saveStatus(prevStatus, instance, { skipThreading: true });
    }
    // Prepend so that first status in thread will be index 0
    return [...(await traverse(prevStatus, ++index)), status];
  }
  return traverse(status)
    .then((statuses) => {
      if (statuses.length > 1) {
        console.debug('THREAD', statuses);
        statuses.forEach((status, index) => {
          states.statusThreadNumber[status.id] = index + 1;
        });
      }
    })
    .catch((e) => {
      console.error(e, status);
    });
}
