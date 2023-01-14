import { proxy, subscribe } from 'valtio';

import store from './store';

const states = proxy({
  history: [],
  statuses: {},
  statusThreadNumber: {},
  home: [],
  specialHome: [],
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
  showDrafts: false,
  composeCharacterCount: 0,
  settings: {
    boostsCarousel: store.local.get('settings:boostsCarousel') === '1' || true,
  },
});
export default states;

subscribe(states.settings, () => {
  store.local.set(
    'settings:boostsCarousel',
    states.settings.boostsCarousel ? '1' : '0',
  );
});

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
