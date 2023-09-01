import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { RegExpRoute, registerRoute, Route } from 'workbox-routing';
import {
  CacheFirst,
  NetworkFirst,
  StaleWhileRevalidate,
} from 'workbox-strategies';

self.__WB_DISABLE_DEV_LOGS = true;

const imageRoute = new Route(
  ({ request, sameOrigin }) => {
    const isRemote = !sameOrigin;
    const isImage = request.destination === 'image';
    const isAvatar = request.url.includes('/avatars/');
    const isEmoji = request.url.includes('/emoji/');
    return isRemote && isImage && (isAvatar || isEmoji);
  },
  new CacheFirst({
    cacheName: 'remote-images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 3 * 24 * 60 * 60, // 3 days
        purgeOnQuotaError: true,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  }),
);
registerRoute(imageRoute);

const iconsRoute = new Route(
  ({ request, sameOrigin }) => {
    const isIcon = request.url.includes('/icons/');
    return sameOrigin && isIcon;
  },
  new CacheFirst({
    cacheName: 'icons',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 3 * 24 * 60 * 60, // 3 days
        purgeOnQuotaError: true,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  }),
);
registerRoute(iconsRoute);

// 1-day cache for
// - /api/v1/instance
// - /api/v1/custom_emojis
// - /api/v1/preferences
// - /api/v1/lists/:id
// - /api/v1/announcements
const apiExtendedRoute = new RegExpRoute(
  /^https?:\/\/[^\/]+\/api\/v\d+\/(instance|custom_emojis|preferences|lists\/\d+|announcements)$/,
  new StaleWhileRevalidate({
    cacheName: 'api-extended',
    plugins: [
      new ExpirationPlugin({
        maxAgeSeconds: 24 * 60 * 60, // 1 day
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  }),
);
registerRoute(apiExtendedRoute);

const apiRoute = new RegExpRoute(
  // Matches:
  // - statuses/:id/context - some contexts are really huge
  /^https?:\/\/[^\/]+\/api\/v\d+\/(statuses\/\d+\/context)/,
  new NetworkFirst({
    cacheName: 'api',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({
        maxAgeSeconds: 5 * 60, // 5 minutes
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  }),
);
registerRoute(apiRoute);

// PUSH NOTIFICATIONS
// ==================

self.addEventListener('push', (event) => {
  const { data } = event;
  if (data) {
    const payload = data.json();
    console.log('PUSH payload', payload);
    const {
      access_token,
      title,
      body,
      icon,
      notification_id,
      notification_type,
      preferred_locale,
    } = payload;

    if (!!navigator.setAppBadge) {
      if (notification_type === 'mention') {
        navigator.setAppBadge(1);
      }
    }

    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon,
        dir: 'auto',
        badge: '/logo-192.png',
        lang: preferred_locale,
        tag: notification_id,
        timestamp: Date.now(),
        data: {
          access_token,
          notification_type,
        },
      }),
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  const payload = event.notification;
  console.log('NOTIFICATION CLICK payload', payload);
  const { badge, body, data, dir, icon, lang, tag, timestamp, title } = payload;
  const { access_token, notification_type } = data;
  const actions = new Promise((resolve) => {
    event.notification.close();
    const url = `/#/notifications?id=${tag}&access_token=${btoa(access_token)}`;
    self.clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((clients) => {
        console.log('NOTIFICATION CLICK clients 1', clients);
        if (clients.length && 'navigate' in clients[0]) {
          console.log('NOTIFICATION CLICK clients 2', clients);
          const bestClient =
            clients.find(
              (client) =>
                client.focused || client.visibilityState === 'visible',
            ) || clients[0];
          console.log('NOTIFICATION CLICK navigate', url);
          // Check if URL is root / or /notifications
          // const clientURL = new URL(bestClient.url);
          // if (
          //   /^#\/?$/.test(clientURL.hash) ||
          //   /^#\/notifications/i.test(clientURL.hash)
          // ) {
          //   bestClient.navigate(url).then((client) => client?.focus());
          // } else {
          // User might be on a different page (e.g. composing a post), so don't navigate anywhere else
          if (bestClient) {
            console.log('NOTIFICATION CLICK postMessage', bestClient);
            bestClient.postMessage?.({
              type: 'notification',
              id: tag,
              accessToken: access_token,
            });
            bestClient.focus();
          } else {
            console.log('NOTIFICATION CLICK openWindow', url);
            self.clients.openWindow(url);
          }
          // }
        } else {
          console.log('NOTIFICATION CLICK openWindow', url);
          self.clients.openWindow(url);
        }
        resolve();
      });
  });
  event.waitUntil(actions);
});
