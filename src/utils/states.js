import { deepEqual } from 'fast-equals';
import { proxy, subscribe } from 'valtio';
import { subscribeKey } from 'valtio/utils';

import { api } from './api';
import isMastodonLinkMaybe from './isMastodonLinkMaybe';
import pmem from './pmem';
import rateLimit from './ratelimit';
import store from './store';
import unfurlMastodonLink from './unfurl-link';

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
  notificationsLast: null, // Last read notification
  notificationsNew: [],
  notificationsShowNew: false,
  notificationsLastFetchTime: null,
  reloadStatusPage: 0,
  reloadGenericAccounts: {
    id: null,
    counter: 0,
  },
  reloadScheduledPosts: 0,
  spoilers: {},
  spoilersMedia: {},
  scrollPositions: {},
  unfurledLinks: {},
  statusQuotes: {},
  statusFollowedTags: {},
  statusReply: {},
  accounts: {},
  routeNotification: null,
  composerState: {},
  // Modals
  showCompose: false,
  showSettings: false,
  showAccount: false,
  showAccounts: false,
  showDrafts: false,
  showMediaModal: false,
  showShortcutsSettings: false,
  showKeyboardShortcutsHelp: false,
  showGenericAccounts: false,
  showMediaAlt: false,
  showEmbedModal: false,
  showReportModal: false,
  // Shortcuts
  shortcuts: [],
  // Settings
  settings: {
    autoRefresh: false,
    shortcutsViewMode: null,
    shortcutsColumnsMode: false,
    boostsCarousel: true,
    contentTranslation: true,
    contentTranslationTargetLanguage: null,
    contentTranslationHideLanguages: [],
    contentTranslationAutoInline: false,
    shortcutSettingsCloudImportExport: false,
    mediaAltGenerator: false,
    composerGIFPicker: false,
    cloakMode: false,
    groupedNotificationsAlpha: false,
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
  if (store.account.get('settings-shortcutsColumnsMode')) {
    states.settings.shortcutsColumnsMode = true;
  }
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
  states.settings.shortcutSettingsCloudImportExport =
    store.account.get('settings-shortcutSettingsCloudImportExport') ?? false;
  states.settings.mediaAltGenerator =
    store.account.get('settings-mediaAltGenerator') ?? false;
  states.settings.composerGIFPicker =
    store.account.get('settings-composerGIFPicker') ?? false;
  states.settings.cloakMode = store.account.get('settings-cloakMode') ?? false;
  states.settings.groupedNotificationsAlpha =
    store.account.get('settings-groupedNotificationsAlpha') ?? false;
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
    if (path.join('.') === 'settings.shortcutsViewMode') {
      store.account.set('settings-shortcutsViewMode', value);
    }
    if (path.join('.') === 'settings.contentTranslation') {
      store.account.set('settings-contentTranslation', !!value);
    }
    if (path.join('.') === 'settings.contentTranslationAutoInline') {
      store.account.set('settings-contentTranslationAutoInline', !!value);
    }
    if (path.join('.') === 'settings.shortcutSettingsCloudImportExport') {
      store.account.set('settings-shortcutSettingsCloudImportExport', !!value);
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
    if (path.join('.') === 'settings.mediaAltGenerator') {
      store.account.set('settings-mediaAltGenerator', !!value);
    }
    if (path.join('.') === 'settings.composerGIFPicker') {
      store.account.set('settings-composerGIFPicker', !!value);
    }
    if (path?.[0] === 'shortcuts') {
      store.account.set('shortcuts', states.shortcuts);
    }
    if (path.join('.') === 'settings.cloakMode') {
      store.account.set('settings-cloakMode', !!value);
    }
    if (path.join('.') === 'settings.groupedNotificationsAlpha') {
      store.account.set('settings-groupedNotificationsAlpha', !!value);
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
  states.showKeyboardShortcutsHelp = false;
  states.showGenericAccounts = false;
  states.showMediaAlt = false;
  states.showEmbedModal = false;
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
  const {
    override = true,
    skipThreading = false,
    skipUnfurling = false,
  } = opts || {};
  if (!status) return;
  const oldStatus = getStatus(status.id, instance);
  if (!override && oldStatus) return;
  if (deepEqual(status, oldStatus)) return;
  queueMicrotask(() => {
    const key = statusKey(status.id, instance);
    if (oldStatus?._pinned) status._pinned = oldStatus._pinned;
    // if (oldStatus?._filtered) status._filtered = oldStatus._filtered;
    states.statuses[key] = status;
    if (status.reblog?.id) {
      const srKey = statusKey(status.reblog.id, instance);
      states.statuses[srKey] = status.reblog;
    }
    if (status.quote?.id) {
      const sKey = statusKey(status.quote.id, instance);
      states.statuses[sKey] = status.quote;
      states.statusQuotes[key] = [
        {
          id: status.quote.id,
          instance,
        },
      ];
    }
  });

  // THREAD TRAVERSER
  if (!skipThreading) {
    queueMicrotask(() => {
      threadifyStatus(status.reblog || status, instance);
    });
  }

  // UNFURLER
  if (!skipUnfurling) {
    queueMicrotask(() => {
      unfurlStatus(status.reblog || status, instance);
    });
  }
}

function _threadifyStatus(status, propInstance) {
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
      // prevStatus = await masto.v1.statuses.$.select(inReplyToId).fetch();
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
export const threadifyStatus = rateLimit(_threadifyStatus, 100);

const fauxDiv = document.createElement('div');
export function unfurlStatus(status, instance) {
  const { instance: currentInstance } = api();
  const content = status?.content;
  const hasLink = /<a/i.test(content);
  if (hasLink) {
    const sKey = statusKey(status?.id, instance);
    fauxDiv.innerHTML = content;
    const links = fauxDiv.querySelectorAll(
      'a[href]:not(.u-url):not(.mention):not(.hashtag)',
    );
    [...links]
      .filter((a) => {
        const url = a.href;
        const isPostItself = url === status.url || url === status.uri;
        return !isPostItself && isMastodonLinkMaybe(url);
      })
      .forEach((a, i) => {
        unfurlMastodonLink(currentInstance, a.href).then((result) => {
          if (!result) return;
          if (!sKey) return;
          if (result?.id === status.id) {
            // Unfurled post is the post itself???
            // Scenario:
            // 1. Post with [URL]
            // 2. Unfurl [URL], API returns the same post that contains [URL]
            // 3. 💥 Recursive quote posts 💥
            // Note: Mastodon search doesn't return posts that contains [URL], it's actually used to *resolve* the URL
            // But some non-Mastodon servers, their search API will eventually search posts that contains [URL] and return them
            return;
          }
          if (!Array.isArray(states.statusQuotes[sKey])) {
            states.statusQuotes[sKey] = [];
          }
          if (!states.statusQuotes[sKey][i]) {
            states.statusQuotes[sKey].splice(i, 0, result);
          }
        });
      });
  }
}

const fetchStatus = pmem((statusID, masto) => {
  return masto.v1.statuses.$select(statusID).fetch();
});
