import { proxy } from 'valtio';
import { subscribeKey } from 'valtio/utils';

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
  notificationsLast: store.account.get('notificationsLast') || null, // Last item in 'notifications' list
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
  showDrafts: false,
  showMediaModal: false,
  // Settings
  settings: {
    boostsCarousel: store.account.get('settings-boostCarousel') ?? true,
  },
});

export default states;

subscribeKey(states, 'notificationsLast', (v) => {
  console.log('CHANGE', v);
  store.account.set('notificationsLast', states.notificationsLast);
});
subscribeKey(states, 'settings-boostCarousel', (v) => {
  store.account.set('settings-boostCarousel', !!v);
});

export function hideAllModals() {
  states.showCompose = false;
  states.showSettings = false;
  states.showAccount = false;
  states.showDrafts = false;
  states.showMediaModal = false;
}

export function saveStatus(status, opts) {
  const { override, skipThreading } = Object.assign(
    { override: true, skipThreading: false },
    opts,
  );
  if (!status) return;
  if (!override && states.statuses[status.id]) return;
  states.statuses[status.id] = status;
  if (status.reblog) {
    states.statuses[status.reblog.id] = status.reblog;
  }

  // THREAD TRAVERSER
  if (!skipThreading) {
    requestAnimationFrame(() => {
      threadifyStatus(status);
      if (status.reblog) {
        threadifyStatus(status.reblog);
      }
    });
  }
}

export function threadifyStatus(status) {
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
      saveStatus(prevStatus, { skipThreading: true });
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
