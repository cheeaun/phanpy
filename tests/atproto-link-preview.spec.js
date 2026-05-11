import { expect, test } from '@playwright/test';

test.describe('ATProto composer link preview', () => {
  test('shows and removes cardyb previews while composing', async ({
    page,
  }) => {
    await page.route('https://cardyb.bsky.app/v1/extract**', async (route) => {
      await route.fulfill({
        json: {
          url: 'https://example.com/story',
          title: 'Example Story',
          description: 'A preview from cardyb.',
          image: 'https://example.com/card.jpg',
        },
      });
    });

    await page.addInitScript(() => {
      const did = 'did:plc:composer';
      const account = {
        info: {
          id: did,
          username: 'composer.test',
          acct: 'composer.test',
          displayName: 'Composer',
          avatarStatic: '',
        },
        instanceURL: 'bsky.social',
        accessToken: JSON.stringify({ type: 'atproto-oauth', sub: did }),
        atproto: true,
        createdAt: Date.now(),
      };
      localStorage.setItem('accounts', JSON.stringify([account]));
      window.__BLUEPY_OAUTH_TEST_CLIENT__ = {
        restore: async () => ({
          sub: did,
          did,
          fetchHandler: async (url) => {
            const urlString = typeof url === 'string' ? url : url.url;
            if (urlString.includes('app.bsky.actor.getProfile')) {
              return Response.json({
                did,
                handle: 'composer.test',
                displayName: 'Composer',
              });
            }
            if (urlString.includes('app.bsky.feed.getTimeline')) {
              return Response.json({ feed: [] });
            }
            if (urlString.includes('app.bsky.actor.getPreferences')) {
              return Response.json({ preferences: [] });
            }
            return Response.json({});
          },
        }),
      };
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Compose' }).click();
    const textarea = page.getByPlaceholder('What are you doing?');
    await textarea.click();
    await textarea.pressSequentially('check https://example.com/story');

    await expect(page.locator('.compose-link-preview')).toContainText(
      'Example Story',
    );
    await page.locator('.compose-link-preview button').click();
    await expect(page.locator('.compose-link-preview')).toHaveCount(0);
  });
});
