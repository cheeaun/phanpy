import { BrowserOAuthClient } from '@atproto/oauth-client-browser';

import { Agent } from '@atproto/api';

import { BSKY_PDS } from './atproto-login-service';

export const ATPROTO_OAUTH_SCOPE = 'atproto transition:generic';
export const ATPROTO_OAUTH_CLIENT_ID =
  'https://bluepy.mosphere.at/oauth-client-metadata.json';

export const ATPROTO_OAUTH_CLIENT_METADATA = {
  client_id: ATPROTO_OAUTH_CLIENT_ID,
  client_name: 'Bluepy',
  client_uri: 'https://bluepy.mosphere.at/',
  logo_uri: 'https://bluepy.mosphere.at/logo-512.png',
  policy_uri:
    'https://github.com/aliceisjustplaying/bluepy/blob/bluesky/PRIVACY.MD',
  redirect_uris: ['https://bluepy.mosphere.at/'],
  scope: ATPROTO_OAUTH_SCOPE,
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  token_endpoint_auth_method: 'none',
  application_type: 'web',
  dpop_bound_access_tokens: true,
};

const oauthSessions = new Map();
let oauthClientPromise;
let oauthInitPromise;

function isLoopbackOrigin(origin = location.origin) {
  try {
    const { protocol, hostname } = new URL(origin);
    return (
      protocol === 'http:' &&
      (hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '[::1]')
    );
  } catch {
    return false;
  }
}

export function getAtprotoOAuthClientOptions(origin = location.origin) {
  return {
    handleResolver: BSKY_PDS,
    responseMode: 'query',
    clientMetadata: isLoopbackOrigin(origin)
      ? undefined
      : ATPROTO_OAUTH_CLIENT_METADATA,
  };
}

export function createAtprotoOAuthAccessToken(sub) {
  return JSON.stringify({
    type: 'atproto-oauth',
    sub,
  });
}

export function parseAtprotoOAuthAccessToken(accessToken) {
  if (!accessToken) return null;
  try {
    const data = JSON.parse(accessToken);
    return data?.type === 'atproto-oauth' && data?.sub ? data : null;
  } catch {
    return null;
  }
}

export async function getAtprotoOAuthClient() {
  if (window.__BLUEPY_OAUTH_TEST_CLIENT__) {
    return window.__BLUEPY_OAUTH_TEST_CLIENT__;
  }
  if (!oauthClientPromise) {
    oauthClientPromise = Promise.resolve(
      new BrowserOAuthClient(getAtprotoOAuthClientOptions()),
    );
  }
  return oauthClientPromise;
}

export async function initAtprotoOAuthClient() {
  const client = await getAtprotoOAuthClient();
  if (!client.init) return undefined;
  if (!oauthInitPromise) {
    oauthInitPromise = client.init().then((result) => {
      if (result?.session) {
        oauthSessions.set(result.session.sub, result.session);
      }
      return result;
    });
  }
  return oauthInitPromise;
}

export async function restoreAtprotoOAuthSession(sub, refresh) {
  if (!sub) return null;
  if (oauthSessions.has(sub)) return oauthSessions.get(sub);
  const client = await getAtprotoOAuthClient();
  const session = await client.restore(sub, refresh);
  oauthSessions.set(sub, session);
  return session;
}

export function getCachedAtprotoOAuthSession(sub) {
  return oauthSessions.get(sub) || null;
}

export function createAtprotoOAuthAgent(session) {
  if (!session) return null;
  return new Agent(session);
}

export async function startAtprotoOAuthLogin(input) {
  const client = await getAtprotoOAuthClient();
  return client.signIn(input, {
    scope: ATPROTO_OAUTH_SCOPE,
  });
}
