import { expect, test } from '@playwright/test';

test.describe('ATProto mention autocomplete', () => {
  test('inserts Bluesky mention autocomplete selections in the composer', async ({
    page,
  }) => {
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
            if (urlString.includes('app.bsky.actor.searchActors')) {
              return Response.json({
                actors: [
                  {
                    did: 'did:plc:alice',
                    handle: 'alice.test',
                    displayName: 'Alice Mention',
                    avatar: 'https://example.com/avatar.png',
                  },
                ],
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
    await textarea.pressSequentially('@ali');
    await page
      .locator('.mention-autocomplete [role="option"]')
      .filter({
        hasText: 'Alice Mention',
      })
      .click();

    await expect(textarea).toHaveValue('@alice.test ');
  });
});
