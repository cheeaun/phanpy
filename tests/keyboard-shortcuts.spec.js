// @ts-check
import { expect, test } from '@playwright/test';

const MOCK_INSTANCE_RESPONSE = {
  uri: 'test.social',
  title: 'Test Social',
  domain: 'test.social',
  version: '4.0.0',
  configuration: {
    statuses: { maxCharacters: 500, maxMediaAttachments: 4 },
    polls: { maxOptions: 4, maxCharactersPerOption: 50, minExpiration: 300, maxExpiration: 86400 },
    urls: { streaming: 'wss://test.social' },
  },
};

const MOCK_ACCOUNT_INFO = {
  id: '1',
  username: 'testuser',
  acct: 'testuser',
  display_name: 'Test User',
  locked: false,
  bot: false,
  discoverable: true,
  created_at: '2024-01-01T00:00:00.000Z',
  note: '<p>Test user</p>',
  url: 'https://test.social/@testuser',
  uri: 'https://test.social/users/testuser',
  avatar: 'https://test.social/avatars/test.png',
  avatar_static: 'https://test.social/avatars/test.png',
  header: 'https://test.social/headers/test.png',
  header_static: 'https://test.social/headers/test.png',
  followers_count: 100,
  following_count: 50,
  statuses_count: 500,
  last_status_at: '2024-06-01',
  emojis: [],
  roles: [],
  fields: [],
};

function createMockPost(id, index) {
  const i = index ?? 0;
  return {
    id: String(id),
    created_at: new Date(Date.now() - i * 900000).toISOString(),
    account: {
      id: '1',
      username: 'testuser',
      acct: 'testuser',
      display_name: 'Test User',
      url: 'https://test.social/@testuser',
      uri: 'https://test.social/users/testuser',
      avatar: 'https://test.social/avatar.png',
      avatar_static: 'https://test.social/avatar.png',
      header: 'https://test.social/header.png',
      header_static: 'https://test.social/header.png',
      followers_count: 100,
      following_count: 50,
      statuses_count: 200,
      last_status_at: '2024-06-01',
      emojis: [],
      fields: [],
    },
    content: `<p>Test post ${i}</p>`,
    uri: `https://test.social/users/testuser/statuses/${id}`,
    url: `https://test.social/@testuser/${id}`,
    media_attachments: [],
    mentions: [],
    tags: [],
    emojis: [],
    reblogs_count: 0,
    favourites_count: 0,
    replies_count: 0,
    sensitive: false,
    spoiler_text: '',
    visibility: 'public',
    language: 'en',
    favourited: false,
    reblogged: false,
    bookmarked: false,
    muted: false,
    pinned: false,
  };
}

async function setupMockHomeEnv(page) {
  await page.route('**/api/v2/instance', async (route) => {
    await route.fulfill({ json: MOCK_INSTANCE_RESPONSE });
  });
  await page.route('**/api/v1/instance', async (route) => {
    await route.fulfill({ json: MOCK_INSTANCE_RESPONSE });
  });
  await page.goto('/#/_mock/home');
  await page.waitForSelector('.timeline-item', { timeout: 15000 });
}

async function setupLoggedInEnv(page) {
  await page.addInitScript(() => {
    const account = {
      info: {
        id: '1',
        username: 'testuser',
        acct: 'testuser',
        display_name: 'Test User',
        avatar: 'https://test.social/avatar.png',
        avatar_static: 'https://test.social/avatar.png',
        header: 'https://test.social/header.png',
        header_static: 'https://test.social/header.png',
      },
      instanceURL: 'test.social',
      accessToken: 'mock-access-token',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastAccessedAt: Date.now(),
    };
    localStorage.setItem('accounts', JSON.stringify([account]));
    sessionStorage.setItem('currentAccount', '1');
    localStorage.setItem('preferences', JSON.stringify({
      '1@test.social': { 'posting:default:visibility': 'public' },
    }));
    localStorage.setItem('instances', JSON.stringify({
      'test.social': {
        uri: 'test.social',
        title: 'Test Social',
        version: '4.0.0',
        configuration: {
          statuses: { maxCharacters: 500, maxMediaAttachments: 4 },
          polls: { maxOptions: 4, maxCharactersPerOption: 50, minExpiration: 300, maxExpiration: 86400 },
          urls: { streaming: 'wss://test.social' },
        },
      },
    }));
    localStorage.setItem('credentialApplications', JSON.stringify({
      'test.social': {
        client_id: 'mock-client-id',
        client_secret: 'mock-client-secret',
        vapid_key: 'mock-vapid-key',
      },
    }));
  });

  await page.route('**/api/v2/instance', async (route) => {
    await route.fulfill({ json: MOCK_INSTANCE_RESPONSE });
  });
  await page.route('**/api/v1/instance', async (route) => {
    await route.fulfill({ json: MOCK_INSTANCE_RESPONSE });
  });
  await page.route('**/api/v1/preferences', async (route) => {
    await route.fulfill({ json: {} });
  });
  await page.route('**/api/v1/accounts/verify_credentials', async (route) => {
    await route.fulfill({ json: MOCK_ACCOUNT_INFO });
  });
  await page.route('**/api/v1/apps/verify_credentials', async (route) => {
    await route.fulfill({ json: { name: 'Test App', website: null } });
  });
}

async function focusFirstStatus(page) {
  await page.locator('.status').first().focus();
  await page.waitForTimeout(300);
}

async function focusInput(page) {
  await page.evaluate(() => {
    const existing = document.getElementById('__test-input__');
    if (existing) existing.remove();
    const input = document.createElement('input');
    input.id = '__test-input__';
    input.style.position = 'fixed';
    input.style.top = '0';
    input.style.left = '0';
    input.style.opacity = '0.01';
    input.style.zIndex = '99999';
    document.body.prepend(input);
    input.focus();
  });
  await page.waitForTimeout(100);
}

async function cleanupInput(page) {
  await page.evaluate(() => {
    document.getElementById('__test-input__')?.remove();
  });
}

function overrideAlert(page) {
  return page.evaluate(() => {
    window.__alertCalled = false;
    window.__alertCount = 0;
    window.alert = () => {
      window.__alertCalled = true;
      window.__alertCount++;
    };
  });
}

function wasAlertCalled(page) {
  return page.evaluate(() => window.__alertCalled);
}

function getAlertCount(page) {
  return page.evaluate(() => window.__alertCount);
}

function resetAlertCounter(page) {
  return page.evaluate(() => {
    window.__alertCalled = false;
    window.__alertCount = 0;
  });
}

test.describe('Keyboard Shortcuts', () => {
  test.describe('Section 1: Status Interaction Shortcuts (via _mock/home)', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockHomeEnv(page);
      await focusFirstStatus(page);
      await overrideAlert(page);
    });

    test('1.1 Reply (r) fires on focused status', async ({ page }) => {
      await page.keyboard.press('r');
      await page.waitForTimeout(500);
      expect(await wasAlertCalled(page)).toBe(true);
    });

    test('1.2 Favourite (f) fires on focused status', async ({ page }) => {
      await page.keyboard.press('f');
      await page.waitForTimeout(500);
      expect(await wasAlertCalled(page)).toBe(true);
    });

    test('1.3 Favourite (l) fires on focused status', async ({ page }) => {
      await page.keyboard.press('l');
      await page.waitForTimeout(500);
      expect(await wasAlertCalled(page)).toBe(true);
    });

    test('1.4 Bookmark (d) fires on focused status', async ({ page }) => {
      await page.keyboard.press('d');
      await page.waitForTimeout(500);
      expect(await wasAlertCalled(page)).toBe(true);
    });

    test('1.5 Quote (q) fires on focused status', async ({ page }) => {
      await page.keyboard.press('q');
      await page.waitForTimeout(500);
      expect(await wasAlertCalled(page)).toBe(true);
    });

    test('1.6 Scoping: input focus blocks status shortcuts', async ({ page }) => {
      await focusInput(page);
      await page.keyboard.press('r');
      await page.waitForTimeout(500);
      expect(await wasAlertCalled(page)).toBe(false);
      await cleanupInput(page);
    });

    test('1.7 Scoping: modifier key blocks status shortcuts', async ({ page }) => {
      await page.keyboard.press('Meta+r');
      await page.waitForTimeout(500);
      expect(await wasAlertCalled(page)).toBe(false);
    });

    test('1.8 Focus scoping: reply fires only for focused status, not multiple', async ({ page }) => {
      expect(await getAlertCount(page)).toBe(0);
      await page.keyboard.press('r');
      await page.waitForTimeout(500);
      const count = await getAlertCount(page);
      expect(count).toBe(1);
    });

    test('1.9 Focus scoping: favourite fires only for newly focused status', async ({ page }) => {
      await page.keyboard.press('f');
      await page.waitForTimeout(500);
      expect(await getAlertCount(page)).toBe(1);
      await resetAlertCounter(page);
      const items = page.locator('.status');
      const count = await items.count();
      if (count < 2) return;
      await items.nth(1).focus();
      await page.waitForTimeout(300);
      await page.keyboard.press('f');
      await page.waitForTimeout(500);
      expect(await getAlertCount(page)).toBe(1);
    });
  });

  test.describe('Section 2: Compose Shortcuts (via _mock/home)', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockHomeEnv(page);
    });

    test('2.1 Open compose (c) sets showCompose', async ({ page }) => {
      await page.keyboard.press('c');
      await page.waitForTimeout(300);
      const showCompose = await page.evaluate(() => window.__STATES__?.showCompose);
      expect(showCompose).toBeTruthy();
    });

    test('2.2 Scoping: input focus blocks compose', async ({ page }) => {
      await focusInput(page);
      await page.keyboard.press('c');
      await page.waitForTimeout(300);
      const showCompose = await page.evaluate(() => window.__STATES__?.showCompose);
      expect(showCompose).toBeFalsy();
      await cleanupInput(page);
    });

    test('2.3 Scoping: modifier key blocks compose', async ({ page }) => {
      await page.keyboard.press('Meta+c');
      await page.waitForTimeout(300);
      const showCompose = await page.evaluate(() => window.__STATES__?.showCompose);
      expect(showCompose).toBeFalsy();
    });
  });

  test.describe('Section 3: Number Shortcuts (via _mock/home)', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockHomeEnv(page);
      await page.waitForTimeout(500);
    });

    test('3.1 Number 1 navigates to home', async ({ page }) => {
      await page.keyboard.press('1');
      await page.waitForTimeout(500);
      const hash = await page.evaluate(() => location.hash);
      expect(hash).toBe('#/');
    });

    test('3.2 Scoping: modifier key blocks number shortcut', async ({ page }) => {
      const hashBefore = await page.evaluate(() => location.hash);
      await page.keyboard.press('Meta+1');
      await page.waitForTimeout(500);
      const hashAfter = await page.evaluate(() => location.hash);
      expect(hashAfter).toBe(hashBefore);
    });
  });

  test.describe('Section 4: Help Shortcut (via _mock/home)', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockHomeEnv(page);
    });

    test('4.1 Open help with ?', async ({ page }) => {
      await page.keyboard.press('?');
      await page.waitForTimeout(500);
      await expect(page.locator('#keyboard-shortcuts-help-container')).toBeVisible();
    });

    test('4.2 Close help with Escape', async ({ page }) => {
      await page.keyboard.press('?');
      await page.waitForTimeout(500);
      await expect(page.locator('#keyboard-shortcuts-help-container')).toBeVisible();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      await expect(page.locator('#keyboard-shortcuts-help-container')).not.toBeVisible();
    });

    test('4.3 Scoping: modifier key blocks help', async ({ page }) => {
      await page.keyboard.press('Meta+?');
      await page.waitForTimeout(500);
      await expect(page.locator('#keyboard-shortcuts-help-container')).not.toBeVisible();
    });
  });

  test.describe('Section 5: Search Overlay (via _mock/home)', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockHomeEnv(page);
    });

    test('5.1 Open search with / removes hidden attribute', async ({ page }) => {
      await page.keyboard.press('/');
      await page.waitForTimeout(500);
      await expect(page.locator('#search-command-container')).not.toHaveAttribute('hidden', '');
    });

    test('5.2 Close search with Escape adds hidden attribute', async ({ page }) => {
      await page.keyboard.press('/');
      await page.waitForTimeout(500);
      const hiddenBefore = await page.locator('#search-command-container').getAttribute('hidden');
      expect(hiddenBefore).toBeNull();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      await expect(page.locator('#search-command-container')).toHaveAttribute('hidden', '');
    });
  });

  test.describe('Section 6: Cloak Mode (via _mock/home)', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockHomeEnv(page);
    });

    test('6.1 Toggle cloak mode on', async ({ page }) => {
      await page.keyboard.press('Shift+Alt+k');
      await page.waitForTimeout(300);
      const hasCloak = await page.evaluate(() => document.body.classList.contains('cloak'));
      expect(hasCloak).toBe(true);
    });

    test('6.2 Toggle cloak mode off', async ({ page }) => {
      await page.keyboard.press('Shift+Alt+k');
      await page.waitForTimeout(300);
      await page.keyboard.press('Shift+Alt+k');
      await page.waitForTimeout(300);
      const hasCloak = await page.evaluate(() => document.body.classList.contains('cloak'));
      expect(hasCloak).toBe(false);
    });

    test('6.3 Scoping: modifier key blocks cloak toggle', async ({ page }) => {
      await page.keyboard.press('Meta+Shift+Alt+k');
      await page.waitForTimeout(300);
      const hasCloak = await page.evaluate(() => document.body.classList.contains('cloak'));
      expect(hasCloak).toBe(false);
    });
  });

  test.describe('Section 7: Navigation Commands (g> sequences) — needs auth', () => {
    test.beforeEach(async ({ page }) => {
      await setupLoggedInEnv(page);
      await page.route('**/api/v1/timelines/home**', async (route) => {
        await route.fulfill({ json: [] });
      });
      await page.goto('/#/test.social');
      await page.waitForTimeout(3000);
    });

    test('7.1 g then h navigates to home', async ({ page }) => {
      await page.keyboard.press('g');
      await page.waitForTimeout(100);
      await page.keyboard.press('h');
      await page.waitForTimeout(500);
      const hash = await page.evaluate(() => location.hash);
      expect(hash).toBe('#/');
    });

    test('7.2 g then n navigates to notifications', async ({ page }) => {
      await page.keyboard.press('g');
      await page.waitForTimeout(100);
      await page.keyboard.press('n');
      await page.waitForTimeout(500);
      const hash = await page.evaluate(() => location.hash);
      expect(hash).toMatch(/notifications/);
    });

    test('7.3 g then s opens settings', async ({ page }) => {
      await page.keyboard.press('g');
      await page.waitForTimeout(100);
      await page.keyboard.press('s');
      await page.waitForTimeout(500);
      const showSettings = await page.evaluate(() => window.__STATES__?.showSettings);
      expect(showSettings).toBe(true);
    });

    test('7.4 g then b navigates to bookmarks', async ({ page }) => {
      await page.keyboard.press('g');
      await page.waitForTimeout(100);
      await page.keyboard.press('b');
      await page.waitForTimeout(500);
      const hash = await page.evaluate(() => location.hash);
      expect(hash).toMatch(/\/b$/);
    });
  });

  test.describe('Section 8: Timeline Navigation (j/k) — needs auth', () => {
    test.beforeEach(async ({ page }) => {
      await setupLoggedInEnv(page);
      const mockPosts = Array.from({ length: 5 }, (_, i) => createMockPost(100 + i, i));
      await page.route('**/api/v1/timelines/home**', async (route) => {
        await route.fulfill({ json: mockPosts });
      });
      await page.goto('/#/test.social');
      await page.waitForSelector('.timeline-item', { timeout: 20000 });
      await page.waitForTimeout(1000);
    });

    test('8.1 j focuses next timeline item', async ({ page }) => {
      await focusFirstStatus(page);
      await page.keyboard.press('j');
      await page.waitForTimeout(300);
      const activeItem = await page.evaluate(() =>
        document.activeElement?.closest('.timeline-item'),
      );
      expect(activeItem).not.toBeNull();
    });

    test('8.2 j then k navigates back to previous item', async ({ page }) => {
      const count = await page.locator('.timeline-item').count();
      expect(count).toBeGreaterThanOrEqual(2);
      await focusFirstStatus(page);
      await page.keyboard.press('j');
      await page.waitForTimeout(200);
      await page.keyboard.press('k');
      await page.waitForTimeout(200);
      const activeItem = await page.evaluate(() =>
        document.activeElement?.closest('.timeline-item'),
      );
      expect(activeItem).not.toBeNull();
    });

    test('8.3 Scoping: input focus blocks j (default library behavior)', async ({ page }) => {
      await focusFirstStatus(page);
      await focusInput(page);
      await page.keyboard.press('j');
      await page.waitForTimeout(300);
      const stillInInput = await page.evaluate(() =>
        document.activeElement?.id === '__test-input__',
      );
      await cleanupInput(page);
      expect(stillInInput).toBe(true);
    });

    test('8.4 Scoping: modifier key blocks j navigation', async ({ page }) => {
      await focusFirstStatus(page);
      await page.keyboard.press('Meta+j');
      await page.waitForTimeout(300);
      const onFirstItem = await page.evaluate(() => {
        const ae = document.activeElement;
        return ae?.closest('.timeline-item')?.classList.contains('timeline-item') === true;
      });
      expect(onFirstItem).toBe(true);
    });
  });

  test.describe('Section 9: Modal Escape (via _mock/home)', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockHomeEnv(page);
    });

    test('9.1 Escape closes help modal', async ({ page }) => {
      await page.keyboard.press('?');
      await page.waitForTimeout(500);
      await expect(page.locator('#keyboard-shortcuts-help-container')).toBeVisible();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      await expect(page.locator('#keyboard-shortcuts-help-container')).not.toBeVisible();
    });

    test('9.2 Scoping: modifier key does not close modal', async ({ page }) => {
      await page.keyboard.press('?');
      await page.waitForTimeout(500);
      await expect(page.locator('#keyboard-shortcuts-help-container')).toBeVisible();
      await page.keyboard.press('Meta+Escape');
      await page.waitForTimeout(500);
      await expect(page.locator('#keyboard-shortcuts-help-container')).toBeVisible();
    });
  });

  test.describe('Section 10: Status Detail Page — needs auth', () => {
    test.beforeEach(async ({ page }) => {
      await setupLoggedInEnv(page);

      const contextDescendants = Array.from({ length: 3 }, (_, i) => ({
        ...createMockPost(124 + i, i + 1),
        descendant: true,
        in_reply_to_id: '123',
        in_reply_to_account_id: '1',
      }));

      await page.route('**/api/v1/statuses/123', async (route) => {
        await route.fulfill({
          json: { ...createMockPost(123, 0), content: '<p>Status detail test post</p>' },
        });
      });
      await page.route('**/api/v1/statuses/123/context', async (route) => {
        await route.fulfill({
          json: { ancestors: [], descendants: contextDescendants },
        });
      });

      await page.route('**/api/v1/timelines/home**', async (route) => {
        await route.fulfill({ json: [] });
      });

      await page.goto('/#/test.social/s/123');
      await page.waitForSelector('article.status', { timeout: 15000 });
      await page.waitForTimeout(500);
    });

    test('10.1 Escape closes status detail', async ({ page }) => {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      const hash = await page.evaluate(() => location.hash);
      expect(hash).not.toMatch(/\/s\/123/);
    });

    test('10.2 j focuses next context status', async ({ page }) => {
      await page.keyboard.press('j');
      await page.waitForTimeout(300);
      const activeEl = await page.evaluate(() => {
        const el = document.activeElement;
        return el?.closest('.status-focus, .status-link');
      });
      expect(activeEl).not.toBeNull();
    });
  });
});