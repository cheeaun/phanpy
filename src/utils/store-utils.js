import store from './store';

export function getAccount(id) {
  const accounts = store.local.getJSON('accounts') || [];
  if (!id) return accounts[0];
  return accounts.find((a) => a.info.id === id) || accounts[0];
}

export function getAccountByAccessToken(accessToken) {
  const accounts = store.local.getJSON('accounts') || [];
  return accounts.find((a) => a.accessToken === accessToken);
}

export function getAccountByInstance(instance) {
  const accounts = store.local.getJSON('accounts') || [];
  return accounts.find((a) => a.instanceURL === instance);
}

const standaloneMQ = window.matchMedia('(display-mode: standalone)');

export function getCurrentAccountID() {
  try {
    const id = store.session.get('currentAccount');
    if (id) return id;
  } catch (e) {}
  if (standaloneMQ.matches) {
    try {
      const id = store.local.get('currentAccount');
      if (id) return id;
    } catch (e) {}
  }
  return null;
}

export function setCurrentAccountID(id) {
  try {
    store.session.set('currentAccount', id);
  } catch (e) {}
  if (standaloneMQ.matches) {
    try {
      store.local.set('currentAccount', id);
    } catch (e) {}
  }
}

export function getCurrentAccount() {
  if (!window.__IGNORE_GET_ACCOUNT_ERROR__) {
    // Track down getCurrentAccount() calls before account-based states are initialized
    console.error('getCurrentAccount() called before states are initialized');
    if (import.meta.env.DEV) console.trace();
  }
  const currentAccount = getCurrentAccountID();
  const account = getAccount(currentAccount);
  return account;
}

export function getCurrentAccountNS() {
  const account = getCurrentAccount();
  const {
    instanceURL,
    info: { id },
  } = account;
  return `${id}@${instanceURL}`;
}

export function saveAccount(account) {
  const accounts = store.local.getJSON('accounts') || [];
  const acc = accounts.find((a) => a.info.id === account.info.id);
  if (acc) {
    acc.info = account.info;
    acc.instanceURL = account.instanceURL;
    acc.accessToken = account.accessToken;
    acc.vapidKey = account.vapidKey;
  } else {
    accounts.push(account);
  }
  store.local.setJSON('accounts', accounts);
  setCurrentAccountID(account.info.id);
}

export function updateAccount(accountInfo) {
  // Only update if displayName or avatar or avatar_static is different
  const accounts = store.local.getJSON('accounts') || [];
  const acc = accounts.find((a) => a.info.id === accountInfo.id);
  if (acc) {
    if (
      acc.info.displayName !== accountInfo.displayName ||
      acc.info.avatar !== accountInfo.avatar ||
      acc.info.avatar_static !== accountInfo.avatar_static
    ) {
      acc.info = {
        ...acc.info,
        ...accountInfo,
      };
      store.local.setJSON('accounts', accounts);
    }
  }
}

let currentInstance = null;
export function getCurrentInstance() {
  if (currentInstance) return currentInstance;
  try {
    const account = getCurrentAccount();
    const instances = store.local.getJSON('instances');
    const instance = account.instanceURL.toLowerCase();
    return (currentInstance = instances[instance]);
  } catch (e) {
    console.error(e);
    // alert(`Failed to load instance configuration. Please try again.\n\n${e}`);
    // Temporary fix for corrupted data
    // store.local.del('instances');
    // location.reload();
    return {};
  }
}

// Massage these instance configurations to match the Mastodon API
// - Pleroma
function getInstanceConfiguration(instance) {
  const {
    configuration,
    maxMediaAttachments,
    maxTootChars,
    pleroma,
    pollLimits,
  } = instance;

  const statuses = configuration?.statuses || {};
  if (maxMediaAttachments) {
    statuses.maxMediaAttachments ??= maxMediaAttachments;
  }
  if (maxTootChars) {
    statuses.maxCharacters ??= maxTootChars;
  }

  const polls = configuration?.polls || {};
  if (pollLimits) {
    polls.maxCharactersPerOption ??= pollLimits.maxOptionChars;
    polls.maxExpiration ??= pollLimits.maxExpiration;
    polls.maxOptions ??= pollLimits.maxOptions;
    polls.minExpiration ??= pollLimits.minExpiration;
  }

  return {
    ...configuration,
    statuses,
    polls,
  };
}

export function getCurrentInstanceConfiguration() {
  const instance = getCurrentInstance();
  return getInstanceConfiguration(instance);
}

export function isMediaFirstInstance() {
  const instance = getCurrentInstance();
  return /pixelfed/i.test(instance?.version);
}
