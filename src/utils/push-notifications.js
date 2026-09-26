// Utils for push notifications
import { api } from './api';
import store from './store';
import {
  getAccountNS,
  getAccounts,
  getCurrentAccount,
  getCurrentAccountNS,
  getVapidKey,
} from './store-utils';

// Browser subscription: a PushSubscription
// {
//   endpoint,
//   keys: { auth, p256dh },
//   options: { applicationServerKey, userVisibleOnly },
// }
//
// Back-end subscription: a WebPushSubscription
// {
//   id,
//   endpoint,
//   serverKey,
//   alerts: { ... },
//   policy: "all" | "followed" | "follower" | "none",
// }
//
// Create/update params: { subscription, data: { alerts, policy } }

// Back-end CRUD
// =============

function createBackendPushSubscription(params, account) {
  const { masto } = api({ account });
  return masto.v1.push.subscription.create(params);
}

function fetchBackendPushSubscription() {
  const { masto } = api();
  return masto.v1.push.subscription.fetch();
}

function updateBackendPushSubscription(params) {
  const { masto } = api();
  return masto.v1.push.subscription.update(params);
}

function removeBackendPushSubscription() {
  const { masto } = api();
  return masto.v1.push.subscription.remove();
}

// Front-end
// =========

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

export function getRegistration() {
  // return navigator.serviceWorker.ready;
  return navigator.serviceWorker.getRegistration();
}

async function getSubscription() {
  const registration = await getRegistration();
  const subscription = registration
    ? await registration.pushManager.getSubscription()
    : undefined;
  return { registration, subscription };
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

function isNotFoundError(err) {
  return err?.statusCode === 404;
}

// Returns null if unknown
function matchesServerKey(subscription) {
  const vapidKey = getVapidKey();
  const { applicationServerKey } = subscription?.options || {};
  if (!vapidKey || !applicationServerKey) return null;
  return (
    urlBase64ToUint8Array(vapidKey).toString() ===
    new Uint8Array(applicationServerKey).toString()
  );
}

// Needs user gesture on some browsers
async function ensureBrowserSubscription(registration, subscription) {
  if (subscription) {
    if (matchesServerKey(subscription) !== false) return subscription;
    const unsubscribed = await subscription.unsubscribe();
    if (!unsubscribed) {
      throw new Error('Failed to unsubscribe old subscription');
    }
  }
  const vapidKey = getVapidKey();
  if (!vapidKey) throw new Error('No server key found');
  return await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });
}

// Push settings
// =============
// Saved per account, to restore subscriptions when browser or server loses them
// { [accountNS]: { endpoint, data: { alerts, policy } } }

const PUSH_SETTINGS_KEY = 'pushSubscriptionSettings';

function getAllPushSettings() {
  return store.local.getJSON(PUSH_SETTINGS_KEY) || {};
}

function getPushSettings(account = getCurrentAccount()) {
  return getAllPushSettings()[getAccountNS(account)] || null;
}

function savePushSettings(backendSubscription, account = getCurrentAccount()) {
  const { endpoint, alerts, policy } = backendSubscription;
  const allSettings = getAllPushSettings();
  allSettings[getAccountNS(account)] = { endpoint, data: { alerts, policy } };
  store.local.setJSON(PUSH_SETTINGS_KEY, allSettings);
}

function removePushSettings(account = getCurrentAccount()) {
  const allSettings = getAllPushSettings();
  delete allSettings[getAccountNS(account)];
  store.local.setJSON(PUSH_SETTINGS_KEY, allSettings);
}

// Browser only has one subscription, shared by all accounts
function isUsedByOtherAccount(endpoint, account = getCurrentAccount()) {
  const excludeNS = getAccountNS(account);
  return getAccounts().some(
    (a) =>
      getAccountNS(a) !== excludeNS &&
      getPushSettings(a)?.endpoint === endpoint,
  );
}

// Used by another account from another instance
function isTakenByOtherAccount(subscription) {
  return (
    !!subscription &&
    matchesServerKey(subscription) === false &&
    isUsedByOtherAccount(subscription.endpoint)
  );
}

// Front-end <-> back-end
// ======================

let initializing = null;
export function initSubscription() {
  initializing ??= syncSubscription().finally(() => {
    initializing = null;
  });
  return initializing;
}

async function syncSubscription() {
  const noSubscription = { subscription: null, backendSubscription: null };
  if (!isPushSupported()) return noSubscription;
  const { registration, subscription } = await getSubscription();
  // Can't tell if browser subscription is gone
  if (!registration) return noSubscription;
  if (!subscription && !getPushSettings()) return noSubscription;

  let backendSubscription = null;
  try {
    backendSubscription = await fetchBackendPushSubscription();
  } catch (err) {
    if (!isNotFoundError(err)) throw err;
  }
  console.log('INIT subscription', {
    subscription,
    backendSubscription,
  });

  if (backendSubscription) savePushSettings(backendSubscription);

  if (subscription) {
    const sameKey = matchesServerKey(subscription) !== false;

    if (backendSubscription) {
      const sameEndpoint =
        backendSubscription.endpoint === subscription.endpoint;
      if (sameEndpoint && sameKey) {
        return { subscription, backendSubscription };
      }
      console.warn('🔔 Subscription changed, repairing', {
        sameEndpoint,
        sameKey,
        endpoint1: backendSubscription.endpoint,
        endpoint2: subscription.endpoint,
      });
      return await tryRepairSubscription({ subscription, backendSubscription });
    }

    const settings = getPushSettings();
    if (!settings) return { subscription, backendSubscription };

    if (sameKey) {
      console.warn('🔔 Backend subscription missing, re-creating');
      backendSubscription = await createBackendPushSubscription({
        subscription,
        data: settings.data,
      });
      savePushSettings(backendSubscription);
      return { subscription, backendSubscription };
    }

    console.warn('🔔 Subscription key changed, repairing');
    return await tryRepairSubscription({ subscription, backendSubscription });
  }

  if (backendSubscription) {
    console.warn('🔔 Browser subscription missing, repairing');
    const repaired = await tryRepairSubscription(null);
    if (repaired) return repaired;
    const { subscription: currentSubscription } = await getSubscription();
    if (currentSubscription) {
      return { subscription: currentSubscription, backendSubscription };
    }
    // Stale, nothing can receive it
    await removeBackendPushSubscription().catch(() => {});
    removePushSettings();
  }

  return noSubscription;
}

let repairing = null;
function repairSubscription() {
  repairing ??= (async () => {
    const settings = getPushSettings();
    if (!settings) throw new Error('No saved push settings');
    const { registration, subscription } = await getSubscription();
    if (!registration) throw new Error('No service worker registration');
    if (isTakenByOtherAccount(subscription)) {
      throw new Error('Browser subscription is used by another account');
    }
    const newSubscription = await ensureBrowserSubscription(
      registration,
      subscription,
    );
    // Replaces existing back-end subscription
    const backendSubscription = await createBackendPushSubscription({
      subscription: newSubscription,
      data: settings.data,
    });
    savePushSettings(backendSubscription);
    return { subscription: newSubscription, backendSubscription };
  })().finally(() => {
    repairing = null;
  });
  return repairing;
}

function tryRepairSubscription(fallback) {
  return repairSubscription().catch((err) => {
    console.warn('🔔 Failed to repair subscription', err);
    return fallback;
  });
}

export async function handlePushSubscriptionChange({
  oldEndpoint,
  newSubscription,
}) {
  if (!isPushSupported()) return;
  const currentNS = getCurrentAccountNS();
  // Without old endpoint, only current account is known
  const accounts = getAccounts().filter((account) => {
    const settings = getPushSettings(account);
    if (!settings) return false;
    return oldEndpoint
      ? settings.endpoint === oldEndpoint
      : getAccountNS(account) === currentNS;
  });
  const currentAccount = accounts.find((a) => getAccountNS(a) === currentNS);

  let subscription = newSubscription;
  if (!subscription) {
    // Re-subscribe with current account's key
    if (!currentAccount) return;
    ({ subscription } = await repairSubscription());
  }

  for (const account of accounts) {
    if (!newSubscription) {
      if (account === currentAccount) continue; // Already repaired
      // Other instances have different keys
      if (account.instanceURL !== currentAccount.instanceURL) continue;
    }
    try {
      const backendSubscription = await createBackendPushSubscription(
        { subscription, data: getPushSettings(account).data },
        account,
      );
      savePushSettings(backendSubscription, account);
    } catch (err) {
      console.warn('🔔 Failed to restore subscription', account.info.id, err);
    }
  }
}

export async function updateSubscription({ data }) {
  console.log('🔔 Updating subscription', data);
  if (!isPushSupported()) return;
  const { registration, subscription: currentSubscription } =
    await getSubscription();
  if (!registration) throw new Error('No service worker registration');

  if (isTakenByOtherAccount(currentSubscription)) {
    console.warn('🔔 Taking over browser subscription from another account');
  }
  const subscription = await ensureBrowserSubscription(
    registration,
    currentSubscription,
  );

  let backendSubscription = null;
  if (subscription === currentSubscription) {
    try {
      backendSubscription = await updateBackendPushSubscription({ data });
    } catch (err) {
      if (!isNotFoundError(err)) throw err;
    }
  }
  backendSubscription ??= await createBackendPushSubscription({
    subscription,
    data,
  });
  savePushSettings(backendSubscription);

  return { subscription, backendSubscription };
}

export async function removeSubscription() {
  if (!isPushSupported()) return;
  const { subscription } = await getSubscription();
  try {
    await removeBackendPushSubscription();
  } catch (err) {
    if (!isNotFoundError(err)) throw err;
  }
  removePushSettings();
  if (subscription && !isUsedByOtherAccount(subscription.endpoint)) {
    await subscription.unsubscribe().catch((err) => {
      console.warn('🔔 Failed to unsubscribe browser subscription', err);
    });
  }
}

// For removed or logged out account
export async function removeAccountPushSettings(account) {
  const settings = getPushSettings(account);
  if (!settings) return;
  removePushSettings(account);
  if (!isPushSupported()) return;
  const { subscription } = await getSubscription();
  if (
    subscription?.endpoint === settings.endpoint &&
    !isUsedByOtherAccount(subscription.endpoint, account)
  ) {
    await subscription.unsubscribe().catch((err) => {
      console.warn('🔔 Failed to unsubscribe browser subscription', err);
    });
  }
}
