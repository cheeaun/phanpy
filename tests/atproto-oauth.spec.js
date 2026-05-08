import { expect, test } from '@playwright/test';

import {
  ATPROTO_OAUTH_CLIENT_METADATA,
  ATPROTO_OAUTH_SCOPE,
  getAtprotoOAuthClientOptions,
} from '../src/utils/atproto-oauth.js';

test.describe('ATProto OAuth', () => {
  test('serves client metadata matching the embedded production client', async ({
    page,
  }) => {
    const res = await page.goto('/oauth-client-metadata.json');
    expect(res.ok()).toBe(true);
    const metadata = await res.json();

    expect(metadata).toEqual(ATPROTO_OAUTH_CLIENT_METADATA);
    expect(metadata.scope).toBe(ATPROTO_OAUTH_SCOPE);
    expect(metadata.redirect_uris).toContain('https://bluepy.mosphere.at/');
    expect(metadata.dpop_bound_access_tokens).toBe(true);
    expect(metadata.token_endpoint_auth_method).toBe('none');
  });

  test('uses loopback metadata in local development', () => {
    const options = getAtprotoOAuthClientOptions('http://127.0.0.1:5173');

    expect(options.clientMetadata).toBeUndefined();
    expect(options.handleResolver).toBe('https://bsky.social');
    expect(options.responseMode).toBe('query');
  });

  test('starts OAuth login from the login page', async ({ page }) => {
    await page.addInitScript(() => {
      window.__BLUEPY_OAUTH_TEST_CLIENT__ = {
        init: async () => undefined,
        signIn: async (input, options) => {
          window.__BLUEPY_OAUTH_ARGS__ = { input, options };
        },
      };
    });

    await page.goto('/#/login');
    await page.getByLabel('Handle or PDS URL').fill('alice.mosphere.at');
    await page.getByRole('button', { name: 'Continue with OAuth' }).click();

    await expect
      .poll(() => page.evaluate(() => window.__BLUEPY_OAUTH_ARGS__))
      .toEqual({
        input: 'alice.mosphere.at',
        options: { scope: ATPROTO_OAUTH_SCOPE },
      });
  });

  test('keeps app-password login available as a fallback', async ({ page }) => {
    await page.addInitScript(() => {
      window.__BLUEPY_OAUTH_TEST_CLIENT__ = {
        init: async () => undefined,
        signIn: async () => {},
      };
    });
    await page.goto('/#/login');

    await expect(
      page.getByRole('button', { name: 'Continue with OAuth' }),
    ).toBeVisible();
    await page.getByText('Use app password').click();
    await expect(page.getByLabel('App password')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Continue with app password' }),
    ).toBeVisible();
  });

  test('stores an account after an OAuth callback', async ({ page }) => {
    await page.addInitScript(() => {
      const did = 'did:plc:oauthalice';
      const profile = {
        did,
        handle: 'oauthalice.test',
        displayName: 'OAuth Alice',
        avatar: 'https://example.com/avatar.jpg',
        followersCount: 3,
        followsCount: 2,
        postsCount: 1,
      };
      const session = {
        sub: did,
        did,
        fetchHandler: async (url) => {
          if (String(url).includes('app.bsky.actor.getProfile')) {
            return Response.json(profile);
          }
          return Response.json({});
        },
      };
      window.__BLUEPY_OAUTH_TEST_CLIENT__ = {
        init: async () => ({ session, state: 'login' }),
        restore: async () => session,
      };
    });

    await page.goto('/?code=oauth-test&state=login&iss=https%3A%2F%2Fpds.test');

    await expect
      .poll(() =>
        page.evaluate(() => {
          const accounts = JSON.parse(localStorage.getItem('accounts') || '[]');
          return accounts[0];
        }),
      )
      .toMatchObject({
        instanceURL: 'bsky.social',
        atproto: true,
        info: {
          id: 'did:plc:oauthalice',
          username: 'oauthalice.test',
          displayName: 'OAuth Alice',
          followersCount: 3,
          followingCount: 2,
          statusesCount: 1,
        },
      });

    const accessToken = await page.evaluate(() => {
      const accounts = JSON.parse(localStorage.getItem('accounts') || '[]');
      return JSON.parse(accounts[0].accessToken);
    });
    expect(accessToken).toEqual({
      type: 'atproto-oauth',
      sub: 'did:plc:oauthalice',
    });
  });
});
