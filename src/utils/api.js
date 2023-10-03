import { createClient } from 'masto';

import store from './store';
import {
  getAccount,
  getAccountByAccessToken,
  getCurrentAccount,
  saveAccount,
} from './store-utils';

// Default *fallback* instance
const DEFAULT_INSTANCE = 'mastodon.social';

// Per-instance masto instance
// Useful when only one account is logged in
// I'm not sure if I'll ever allow multiple logged-in accounts but oh well...
// E.g. apis['mastodon.social']
const apis = {};

// Per-account masto instance
// Note: There can be many accounts per instance
// Useful when multiple accounts are logged in or when certain actions require a specific account
// Just in case if I need this one day.
// E.g. accountApis['mastodon.social']['ACCESS_TOKEN']
const accountApis = {};
window.__ACCOUNT_APIS__ = accountApis;

// Current account masto instance
let currentAccountApi;

export function initClient({ instance, accessToken }) {
  if (/^https?:\/\//.test(instance)) {
    instance = instance
      .replace(/^https?:\/\//, '')
      .replace(/\/+$/, '')
      .toLowerCase();
  }
  const url = instance ? `https://${instance}` : `https://${DEFAULT_INSTANCE}`;

  const client = createClient({
    url,
    accessToken, // Can be null
    disableVersionCheck: true, // Allow non-Mastodon instances
    timeout: 30_000, // Unfortunatly this is global instead of per-request
  });
  client.__instance__ = instance;

  apis[instance] = client;
  if (!accountApis[instance]) accountApis[instance] = {};
  if (accessToken) accountApis[instance][accessToken] = client;

  return client;
}

// Get the instance information
// The config is needed for composing
export async function initInstance(client, instance) {
  const masto = client;
  // Request v2, fallback to v1 if fail
  let info;
  try {
    info = await masto.v2.instance.fetch();
  } catch (e) {}
  if (!info) {
    try {
      info = await masto.v1.instances.fetch();
    } catch (e) {}
  }
  if (!info) return;
  console.log(info);
  const {
    // v1
    uri,
    urls: { streamingApi } = {},
    // v2
    domain,
    configuration: { urls: { streaming } = {} } = {},
  } = info;
  const instances = store.local.getJSON('instances') || {};
  if (uri || domain) {
    instances[
      (domain || uri)
        .replace(/^https?:\/\//, '')
        .replace(/\/+$/, '')
        .toLowerCase()
    ] = info;
  }
  if (instance) {
    instances[instance.toLowerCase()] = info;
  }
  store.local.setJSON('instances', instances);
  // This is a weird place to put this but here's updating the masto instance with the streaming API URL set in the configuration
  // Reason: Streaming WebSocket URL may change, unlike the standard API REST URLs
  if (streamingApi || streaming) {
    console.log('🎏 Streaming API URL:', streaming || streamingApi);
    masto.config.props.streamingApiUrl = streaming || streamingApi;
  }
}

// Get the account information and store it
export async function initAccount(client, instance, accessToken, vapidKey) {
  const masto = client;
  const mastoAccount = await masto.v1.accounts.verifyCredentials();

  store.session.set('currentAccount', mastoAccount.id);

  saveAccount({
    info: mastoAccount,
    instanceURL: instance.toLowerCase(),
    accessToken,
    vapidKey,
  });
}

// Get preferences
export async function initPreferences(client) {
  try {
    const masto = client;
    const preferences = await masto.v1.preferences.fetch();
    store.account.set('preferences', preferences);
  } catch (e) {
    // silently fail
    console.error(e);
  }
}

// Get the masto instance
// If accountID is provided, get the masto instance for that account
export function api({ instance, accessToken, accountID, account } = {}) {
  // Always lowercase and trim the instance
  if (instance) {
    instance = instance.toLowerCase().trim();
  }

  // If instance and accessToken are provided, get the masto instance for that account
  if (instance && accessToken) {
    return {
      masto:
        accountApis[instance]?.[accessToken] ||
        initClient({ instance, accessToken }),
      authenticated: true,
      instance,
    };
  }

  if (accessToken) {
    // If only accessToken is provided, get the masto instance for that accessToken
    console.log('X 1', accountApis);
    for (const instance in accountApis) {
      if (accountApis[instance][accessToken]) {
        console.log('X 2', accountApis, instance, accessToken);
        return {
          masto: accountApis[instance][accessToken],
          authenticated: true,
          instance,
        };
      } else {
        console.log('X 3', accountApis, instance, accessToken);
        const account = getAccountByAccessToken(accessToken);
        if (account) {
          const accessToken = account.accessToken;
          const instance = account.instanceURL.toLowerCase().trim();
          return {
            masto: initClient({ instance, accessToken }),
            authenticated: true,
            instance,
          };
        } else {
          throw new Error(`Access token not found`);
        }
      }
    }
  }

  // If account is provided, get the masto instance for that account
  if (account || accountID) {
    account = account || getAccount(accountID);
    if (account) {
      const accessToken = account.accessToken;
      const instance = account.instanceURL.toLowerCase().trim();
      return {
        masto:
          accountApis[instance]?.[accessToken] ||
          initClient({ instance, accessToken }),
        authenticated: true,
        instance,
      };
    } else {
      throw new Error(`Account ${accountID} not found`);
    }
  }

  // If only instance is provided, get the masto instance for that instance
  if (instance) {
    const masto = apis[instance] || initClient({ instance });
    return {
      masto,
      authenticated: !!masto.config.props.accessToken,
      instance,
    };
  }

  // If no instance is provided, get the masto instance for the current account
  if (currentAccountApi) {
    return {
      masto: currentAccountApi,
      authenticated: true,
      instance: currentAccountApi.__instance__,
    };
  }
  const currentAccount = getCurrentAccount();
  if (currentAccount) {
    const { accessToken, instanceURL: instance } = currentAccount;
    currentAccountApi =
      accountApis[instance]?.[accessToken] ||
      initClient({ instance, accessToken });
    return {
      masto: currentAccountApi,
      authenticated: true,
      instance,
    };
  }

  // If no instance is provided and no account is logged in, get the masto instance for DEFAULT_INSTANCE
  return {
    masto: apis[DEFAULT_INSTANCE] || initClient({ instance: DEFAULT_INSTANCE }),
    authenticated: false,
    instance: DEFAULT_INSTANCE,
  };
}

window.__API__ = {
  currentAccountApi,
  apis,
  accountApis,
};
