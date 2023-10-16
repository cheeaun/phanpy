// Utils for push notifications
import { api } from './api';
import { getCurrentAccount } from './store-utils';

// Subscription is an object with the following structure:
// {
//   data: {
//     alerts: {
//       admin: {
//         report: boolean,
//         signUp: boolean,
//       },
//       favourite: boolean,
//       follow: boolean,
//       mention: boolean,
//       poll: boolean,
//       reblog: boolean,
//       status: boolean,
//       update: boolean,
//     }
//   },
//   policy: "all" | "followed" | "follower" | "none",
//   subscription: {
//     endpoint: string,
//     keys: {
//       auth: string,
//       p256dh: string,
//     },
//   },
// }

// Back-end CRUD
// =============

function createBackendPushSubscription(subscription) {
  const { masto } = api();
  return masto.v1.push.subscription.create(subscription);
}

function fetchBackendPushSubscription() {
  const { masto } = api();
  return masto.v1.push.subscription.fetch();
}

function updateBackendPushSubscription(subscription) {
  const { masto } = api();
  return masto.v1.push.subscription.update(subscription);
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

// Front-end <-> back-end
// ======================

export async function initSubscription() {
  if (!isPushSupported()) return;
  const { subscription } = await getSubscription();
  let backendSubscription = null;
  try {
    backendSubscription = await fetchBackendPushSubscription();
  } catch (err) {
    if (/(not found|unknown)/i.test(err.message)) {
      // No subscription found
    } else {
      // Other error
      throw err;
    }
  }
  console.log('INIT subscription', {
    subscription,
    backendSubscription,
  });

  // Check if the subscription changed
  if (backendSubscription && subscription) {
    const sameEndpoint = backendSubscription.endpoint === subscription.endpoint;
    const { vapidKey } = getCurrentAccount();
    const sameKey = backendSubscription.serverKey === vapidKey;
    if (!sameEndpoint) {
      throw new Error('Backend subscription endpoint changed');
    }
    if (sameKey) {
      // Subscription didn't change
    } else {
      // Subscription changed
      console.error('🔔 Subscription changed', {
        sameEndpoint,
        serverKey: backendSubscription.serverKey,
        vapIdKey: vapidKey,
        endpoint1: backendSubscription.endpoint,
        endpoint2: subscription.endpoint,
        sameKey,
        key1: backendSubscription.serverKey,
        key2: vapidKey,
      });
      throw new Error('Backend subscription key and vapid key changed');
      // Only unsubscribe from backend, not from browser
      // await removeBackendPushSubscription();
      // // Now let's resubscribe
      // // NOTE: I have no idea if this works
      // return await updateSubscription({
      //   data: backendSubscription.data,
      //   policy: backendSubscription.policy,
      // });
    }
  }

  if (subscription && !backendSubscription) {
    // check if account's vapidKey is same as subscription's applicationServerKey
    const { vapidKey } = getCurrentAccount();
    const { applicationServerKey } = subscription.options;
    const vapidKeyStr = urlBase64ToUint8Array(vapidKey).toString();
    const applicationServerKeyStr = new Uint8Array(
      applicationServerKey,
    ).toString();
    const sameKey = vapidKeyStr === applicationServerKeyStr;
    if (sameKey) {
      // Subscription didn't change
    } else {
      // Subscription changed
      console.error('🔔 Subscription changed', {
        vapidKeyStr,
        applicationServerKeyStr,
        sameKey,
      });
      // Unsubscribe since backend doesn't have a subscription
      await subscription.unsubscribe();
      throw new Error('Subscription key and vapid key changed');
    }
  }

  // Check if backend subscription returns 404
  // if (subscription && !backendSubscription) {
  //   // Re-subscribe to backend
  //   backendSubscription = await createBackendPushSubscription({
  //     subscription,
  //     data: {},
  //     policy: 'all',
  //   });
  // }

  return { subscription, backendSubscription };
}

export async function updateSubscription({ data, policy }) {
  console.log('🔔 Updating subscription', { data, policy });
  if (!isPushSupported()) return;
  let { registration, subscription } = await getSubscription();
  let backendSubscription = null;

  if (subscription) {
    try {
      backendSubscription = await updateBackendPushSubscription({
        data,
        policy,
      });
      // TODO: save subscription in user settings
    } catch (error) {
      // Backend doesn't have a subscription for this user
      // Create a new one
      backendSubscription = await createBackendPushSubscription({
        subscription,
        data,
        policy,
      });
      // TODO: save subscription in user settings
    }
  } else {
    // User is not subscribed
    const { vapidKey } = getCurrentAccount();
    if (!vapidKey) throw new Error('No server key found');
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
    backendSubscription = await createBackendPushSubscription({
      subscription,
      data,
      policy,
    });
    // TODO: save subscription in user settings
  }

  return { subscription, backendSubscription };
}

export async function removeSubscription() {
  if (!isPushSupported()) return;
  const { subscription } = await getSubscription();
  if (subscription) {
    await removeBackendPushSubscription();
    await subscription.unsubscribe();
  }
}
