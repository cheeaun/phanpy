// @ts-check
// The app talks straight to a Mastodon instance, so tests fake the session, the
// instance API and the streaming WebSocket. Import from here, not @playwright/test.
import { expect, test as base } from '@playwright/test';

/** @typedef {import('@playwright/test').Page} Page */
/** @typedef {Record<string, unknown | ((route: import('@playwright/test').Route) => unknown)>} ApiRoutes */

export const MOCK_INSTANCE = 'test.social';
export const MOCK_ACCOUNT_ID = '1';

export const MOCK_ACCOUNT = {
  id: MOCK_ACCOUNT_ID,
  username: 'testuser',
  acct: 'testuser',
  display_name: 'Test User',
  url: `https://${MOCK_INSTANCE}/@testuser`,
  uri: `https://${MOCK_INSTANCE}/users/testuser`,
  avatar: `https://${MOCK_INSTANCE}/avatar.png`,
  avatar_static: `https://${MOCK_INSTANCE}/avatar.png`,
  header: `https://${MOCK_INSTANCE}/header.png`,
  header_static: `https://${MOCK_INSTANCE}/header.png`,
  note: '<p>Test user</p>',
  locked: false,
  bot: false,
  discoverable: true,
  created_at: '2024-01-01T00:00:00.000Z',
  followers_count: 0,
  following_count: 0,
  statuses_count: 0,
  emojis: [],
  fields: [],
};

export const MOCK_INSTANCE_RESPONSE = {
  uri: MOCK_INSTANCE,
  title: 'Test Social',
  domain: MOCK_INSTANCE,
  version: '4.0.0',
  configuration: {
    statuses: { maxCharacters: 500, maxMediaAttachments: 4 },
    polls: {
      maxOptions: 4,
      maxCharactersPerOption: 50,
      minExpiration: 300,
      maxExpiration: 86400,
    },
    urls: { streaming: `wss://${MOCK_INSTANCE}` },
  },
};

/**
 * Status payload as returned by the API (snake_case; masto.js camelCases it).
 * @param {{
 *   id: string,
 *   spoilerText?: string,
 *   sensitive?: boolean,
 *   content?: string,
 *   account?: object,
 *   createdAt?: string,
 *   replyToId?: string,
 * }} options
 */
export function createStatus({
  id,
  spoilerText = '',
  sensitive,
  content = `<p>Post ${id}</p>`,
  account = MOCK_ACCOUNT,
  createdAt = '2024-01-01T00:00:00.000Z',
  replyToId = '',
}) {
  return {
    id,
    created_at: createdAt,
    edited_at: null,
    // Thread descendants need a parent, even for the hero's own replies
    in_reply_to_id: replyToId || null,
    in_reply_to_account_id: replyToId ? account.id : null,
    sensitive: sensitive ?? !!spoilerText,
    spoiler_text: spoilerText,
    visibility: 'public',
    language: 'en',
    uri: `https://${MOCK_INSTANCE}/users/testuser/statuses/${id}`,
    url: `https://${MOCK_INSTANCE}/@testuser/${id}`,
    replies_count: 0,
    reblogs_count: 0,
    favourites_count: 0,
    favourited: false,
    reblogged: false,
    muted: false,
    bookmarked: false,
    pinned: false,
    content,
    reblog: null,
    account,
    media_attachments: [],
    mentions: [],
    tags: [],
    emojis: [],
    card: null,
    poll: null,
    application: null,
    filtered: [],
  };
}

/**
 * Routes keyed by the path after `/api/` (`v1/statuses/1`); `*` suffix matches a
 * prefix, a function is a handler. Unmatched calls get `{}`.
 * @param {Page} page
 * @param {ApiRoutes} routes
 */
export async function mockApi(page, routes) {
  await page.route(`https://${MOCK_INSTANCE}/api/**`, async (route) => {
    const key = new URL(route.request().url()).pathname
      .replace(/^\/api\//, '')
      .replace(/\/$/, '');
    const match =
      routes[key] ??
      Object.entries(routes).find(
        ([pattern]) =>
          pattern.endsWith('*') && key.startsWith(pattern.slice(0, -1)),
      )?.[1];

    if (typeof match === 'function') {
      await match(route);
    } else {
      await route.fulfill({ json: match ?? {} });
    }
  });
}

/** @param {Page} page */

export async function seedLoggedInSession(page) {
  await page.addInitScript(
    ({ account, instance, instanceResponse }) => {
      localStorage.setItem(
        'accounts',
        JSON.stringify([
          {
            info: account,
            instanceURL: instance,
            accessToken: 'mock-access-token',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lastAccessedAt: Date.now(),
          },
        ]),
      );
      sessionStorage.setItem('currentAccount', account.id);
      localStorage.setItem(
        'instances',
        JSON.stringify({ [instance]: instanceResponse }),
      );
      localStorage.setItem(
        'credentialApplications',
        JSON.stringify({
          [instance]: {
            client_id: 'mock-client-id',
            client_secret: 'mock-client-secret',
            vapid_key: 'mock-vapid-key',
          },
        }),
      );
      // Account-namespaced stores are read without a null check
      for (const key of [
        'notificationsLast',
        'shortcuts',
        'preferences',
        'lists',
        'followedTags',
        'searchHistory',
        'boostedStatusIDs',
        'recentlyUsedCustomEmojis',
        'settings-autoHideBars',
        'settings-autoRefresh',
        'settings-boostsCarousel',
        'settings-cloakMode',
        'settings-composerGIFPicker',
        'settings-contentTranslation',
        'settings-contentTranslationAutoInline',
        'settings-contentTranslationHideLanguages',
        'settings-contentTranslationTargetLanguage',
        'settings-hideFederatedTimeline',
        'settings-hideLocalTimeline',
        'settings-hidePostMetrics',
        'settings-hideProfileMetrics',
        'settings-hideTrendingTimeline',
        'settings-lowercasePostText',
        'settings-mediaAltGenerator',
        'settings-paginatedTimeline',
        'settings-postUsernameOnly',
        'settings-shortcutsColumnsMode',
        'settings-shortcutsViewMode',
      ]) {
        if (localStorage.getItem(key) === null) {
          localStorage.setItem(key, '{}');
        }
      }
    },
    {
      account: MOCK_ACCOUNT,
      instance: MOCK_INSTANCE,
      instanceResponse: MOCK_INSTANCE_RESPONSE,
    },
  );
}

/** @param {Page} page */
export async function stubStreaming(page) {
  await page.addInitScript(() => {
    class StubWebSocket {
      /** @param {string} url */
      constructor(url) {
        this.url = url;
        this.readyState = 0;
      }
      send() {}
      close() {
        this.readyState = 3;
      }
      addEventListener() {}
      removeEventListener() {}
    }
    // @ts-expect-error Offline stub
    window.WebSocket = StubWebSocket;
  });
}

/**
 * Seed the session, install baseline mocks and boot at `path`; `routes` override
 * the defaults.
 * @param {Page} page
 * @param {ApiRoutes} [routes]
 * @param {string} [path]
 */
export async function setupApp(page, routes = {}, path = '/') {
  await stubStreaming(page);
  await seedLoggedInSession(page);
  await mockApi(page, {
    'v2/instance': MOCK_INSTANCE_RESPONSE,
    'v1/instance': MOCK_INSTANCE_RESPONSE,
    'v1/preferences': {},
    'v1/accounts/verify_credentials': MOCK_ACCOUNT,
    'v1/apps/verify_credentials': { name: 'Test App', website: null },
    'v1/timelines/*': [],
    'v1/following_relationships*': [],
    ...routes,
  });
  await page.goto(`/#${path}`);
  await page.waitForSelector('#app > *', { timeout: 20000 });
}

/**
 * Navigate to a status after boot; a deep-link `goto` resolves before the session
 * is restored.
 * @param {Page} page
 * @param {string} statusId
 * @param {string} [instance]
 */
export async function openStatus(page, statusId, instance = MOCK_INSTANCE) {
  await page.evaluate(
    ({ id, host }) => {
      location.hash = `#/${host}/s/${id}`;
    },
    { id: statusId, host: instance },
  );
}

export const test = base.extend({
  /** @type {[({ page: Page }, (page: Page) => Promise<void>) => Promise<void>, { scope: 'test' }]} */
  appPage: [
    async ({ page }, use) => {
      await setupApp(page);
      await use(page);
    },
    { scope: 'test' },
  ],
});

export { expect };
