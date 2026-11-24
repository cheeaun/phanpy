// @ts-check
import { expect, setupApp, test } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', { value: true });
    localStorage.setItem(
      'pwaLastPath',
      JSON.stringify({ path: '/bookmarks', lastAccessed: Date.now() }),
    );
  });
});

test('restores the saved PWA route on a normal launch', async ({ page }) => {
  await setupApp(page, { 'v1/bookmarks': [] });
  await expect(page).toHaveURL(/#\/bookmarks$/);
});

test('does not restore over a notification URL arriving during launch', async ({
  page,
}) => {
  await page.clock.install();
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      const value = getItem.call(this, key);
      if (this === localStorage && key === 'pwaLastPath') {
        Storage.prototype.getItem = getItem;
        // Deliver the deep link just after the app schedules restoration.
        queueMicrotask(() => {
          window.location.hash = '/notifications?id=123';
        });
      }
      return value;
    };
  });

  await setupApp(page, {
    'v1/notifications': [],
    'v1/notifications/123': (route) => route.fulfill({ status: 404 }),
  });
  await expect(page).toHaveURL(/#\/notifications$/);
  await page.clock.fastForward(300);
  await expect(page).toHaveURL(/#\/notifications$/);
});

test('consumes the notification parameters without leaving them in history', async ({
  page,
}) => {
  await setupApp(page, {
    'v1/bookmarks': [],
    'v1/notifications': [],
    'v1/notifications/123': (route) => route.fulfill({ status: 404 }),
  });
  await expect(page).toHaveURL(/#\/bookmarks$/);

  const request = page.waitForRequest('**/api/v1/notifications/123');
  await page.evaluate(() => {
    location.hash = `/notifications?id=123&access_token=${btoa('mock-access-token')}&filter=all`;
  });
  await request;
  await expect(page).toHaveURL(/#\/notifications\?filter=all$/);

  await page.goBack();
  await expect(page).toHaveURL(/#\/bookmarks$/);
});
