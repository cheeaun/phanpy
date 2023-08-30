import mem from 'mem';
import { proxy, subscribe } from 'valtio';
import { subscribeKey } from 'valtio/utils';

import { api } from './api';
import store from './store';

const states = proxy({
  appVersion: {},
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
  unfurledLinks: {},
  statusQuotes: {},
  accounts: {},
  // Modals
  showCompose: false,
  showSettings: false,
  showAccount: false,
  showAccounts: false,
  showDrafts: false,
  showMediaModal: false,
  showShortcutsSettings: false,
  // Shortcuts
  shortcuts: store.account.get('shortcuts') ?? [],
  // Settings
  settings: {
    autoRefresh: store.account.get('settings-autoRefresh') ?? false,
    shortcutsViewMode: store.account.get('settings-shortcutsViewMode') ?? null,
    shortcutsColumnsMode:
      store.account.get('settings-shortcutsColumnsMode') ?? false,
    boostsCarousel: store.account.get('settings-boostsCarousel') ?? true,
    contentTranslation:
      store.account.get('settings-contentTranslation') ?? true,
    contentTranslationTargetLanguage:
      store.account.get('settings-contentTranslationTargetLanguage') || null,
    contentTranslationHideLanguages:
      store.account.get('settings-contentTranslationHideLanguages') || [],
    contentTranslationAutoInline:
      store.account.get('settings-contentTranslationAutoInline') ?? false,
    cloakMode: store.account.get('settings-cloakMode') ?? false,
  },
});

export default states;

export function initStates() {
  // init all account based states
  // all keys that uses store.account.get() should be initialized here
  states.notificationsLast = store.account.get('notificationsLast') || null;
  states.shortcuts = store.account.get('shortcuts') ?? [];
  states.settings.autoRefresh =
    store.account.get('settings-autoRefresh') ?? false;
  states.settings.shortcutsViewMode =
    store.account.get('settings-shortcutsViewMode') ?? null;
  states.settings.shortcutsColumnsMode =
    store.account.get('settings-shortcutsColumnsMode') ?? false;
  states.settings.boostsCarousel =
    store.account.get('settings-boostsCarousel') ?? true;
  states.settings.contentTranslation =
    store.account.get('settings-contentTranslation') ?? true;
  states.settings.contentTranslationTargetLanguage =
    store.account.get('settings-contentTranslationTargetLanguage') || null;
  states.settings.contentTranslationHideLanguages =
    store.account.get('settings-contentTranslationHideLanguages') || [];
  states.settings.contentTranslationAutoInline =
    store.account.get('settings-contentTranslationAutoInline') ?? false;
  states.settings.cloakMode = store.account.get('settings-cloakMode') ?? false;
}

subscribeKey(states, 'notificationsLast', (v) => {
  console.log('CHANGE', v);
  store.account.set('notificationsLast', states.notificationsLast);
});
subscribe(states, (changes) => {
  console.debug('STATES change', changes);
  for (const [action, path, value, prevValue] of changes) {
    if (path.join('.') === 'settings.autoRefresh') {
      store.account.set('settings-autoRefresh', !!value);
    }
    if (path.join('.') === 'settings.boostsCarousel') {
      store.account.set('settings-boostsCarousel', !!value);
    }
    if (path.join('.') === 'settings.shortcutsColumnsMode') {
      store.account.set('settings-shortcutsColumnsMode', !!value);
    }
    if (path.join('.') === 'settings.shortcutsViewMode') {
      store.account.set('settings-shortcutsViewMode', value);
    }
    if (path.join('.') === 'settings.contentTranslation') {
      store.account.set('settings-contentTranslation', !!value);
    }
    if (path.join('.') === 'settings.contentTranslationAutoInline') {
      store.account.set('settings-contentTranslationAutoInline', !!value);
    }
    if (path.join('.') === 'settings.contentTranslationTargetLanguage') {
      console.log('SET', value);
      store.account.set('settings-contentTranslationTargetLanguage', value);
    }
    if (/^settings\.contentTranslationHideLanguages/i.test(path.join('.'))) {
      store.account.set(
        'settings-contentTranslationHideLanguages',
        states.settings.contentTranslationHideLanguages,
      );
    }
    if (path?.[0] === 'shortcuts') {
      store.account.set('shortcuts', states.shortcuts);
    }
    if (path.join('.') === 'settings.cloakMode') {
      store.account.set('settings-cloakMode', !!value);
    }
  }
});

export function hideAllModals() {
  states.showCompose = false;
  states.showSettings = false;
  states.showAccount = false;
  states.showAccounts = false;
  states.showDrafts = false;
  states.showMediaModal = false;
  states.showShortcutsSettings = false;
}

export function statusKey(id, instance) {
  if (!id) return;
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
  const oldStatus = getStatus(status.id, instance);
  if (!override && oldStatus) return;
  const key = statusKey(status.id, instance);
  if (oldStatus?._pinned) status._pinned = oldStatus._pinned;
  if (oldStatus?._filtered) status._filtered = oldStatus._filtered;
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
        threadifyStatus(status.reblog, instance);
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
    const key = statusKey(inReplyToId, instance);
    let prevStatus = states.statuses[key];
    if (!prevStatus) {
      if (fetchIndex++ > 3) throw 'Too many fetches for thread'; // Some people revive old threads
      await new Promise((r) => setTimeout(r, 500 * fetchIndex)); // Be nice to rate limits
      // prevStatus = await masto.v1.statuses.fetch(inReplyToId);
      prevStatus = await fetchStatus(inReplyToId, masto);
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
          const key = statusKey(status.id, instance);
          states.statusThreadNumber[key] = index + 1;
        });
      }
    })
    .catch((e) => {
      console.error(e, status);
    });
}

const fetchStatus = mem((statusID, masto) => {
  return masto.v1.statuses.fetch(statusID);
});
