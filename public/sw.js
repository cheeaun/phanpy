import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import * as navigationPreload from 'workbox-navigation-preload';
import { RegExpRoute, registerRoute, Route } from 'workbox-routing';
import {
  CacheFirst,
  NetworkFirst,
  StaleWhileRevalidate,
} from 'workbox-strategies';

navigationPreload.enable();

self.__WB_DISABLE_DEV_LOGS = true;

const iconsRoute = new Route(
  ({ request, sameOrigin }) => {
    const isIcon = request.url.includes('/icons/');
    return sameOrigin && isIcon;
  },
  new CacheFirst({
    cacheName: 'icons',
    plugins: [
      new ExpirationPlugin({
        // Weirdly high maxEntries number, due to some old icons suddenly disappearing and not rendering
        // NOTE: Temporary fix
        maxEntries: 300,
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

const assetsRoute = new Route(
  ({ request, sameOrigin }) => {
    const isAsset =
      request.destination === 'style' || request.destination === 'script';
    const hasHash = /-[0-9a-z-]{4,}\./i.test(request.url);
    return sameOrigin && isAsset && hasHash;
  },
  new NetworkFirst({
    cacheName: 'assets',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 40,
        purgeOnQuotaError: true,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  }),
);
registerRoute(assetsRoute);

const imageRoute = new Route(
  ({ request, sameOrigin }) => {
    const isRemote = !sameOrigin;
    const isImage = request.destination === 'image';
    const isAvatar = request.url.includes('/avatars/');
    const isCustomEmoji = request.url.includes('/custom/_emojis');
    const isEmoji = request.url.includes('/emoji/');
    return isRemote && isImage && (isAvatar || isCustomEmoji || isEmoji);
  },
  new CacheFirst({
    cacheName: 'remote-images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 30,
        purgeOnQuotaError: true,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  }),
);
registerRoute(imageRoute);

// 1-day cache for
// - /api/v1/custom_emojis
// - /api/v1/lists/:id
// - /api/v1/announcements
const apiExtendedRoute = new RegExpRoute(
  /^https?:\/\/[^\/]+\/api\/v\d+\/(custom_emojis|lists\/\d+|announcements)$/,
  new StaleWhileRevalidate({
    cacheName: 'api-extended',
    plugins: [
      new ExpirationPlugin({
        maxAgeSeconds: 12 * 60 * 60, // 12 hours
        purgeOnQuotaError: true,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  }),
);
registerRoute(apiExtendedRoute);

// Note: expiration is not working as expected
// https://github.com/GoogleChrome/workbox/issues/3316
//
// const apiIntermediateRoute = new RegExpRoute(
//   // Matches:
//   // - trends/*
//   // - timelines/link
//   /^https?:\/\/[^\/]+\/api\/v\d+\/(trends|timelines\/link)/,
//   new StaleWhileRevalidate({
//     cacheName: 'api-intermediate',
//     plugins: [
//       new ExpirationPlugin({
//         maxAgeSeconds: 1 * 60, // 1min
//       }),
//       new CacheableResponsePlugin({
//         statuses: [0, 200],
//       }),
//     ],
//   }),
// );
// registerRoute(apiIntermediateRoute);

const apiRoute = new RegExpRoute(
  // Matches:
  // - statuses/:id/context - some contexts are really huge
  /^https?:\/\/[^\/]+\/api\/v\d+\/(statuses\/\d+\/context)/,
  new NetworkFirst({
    cacheName: 'api',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 5 * 60, // 5 minutes
        purgeOnQuotaError: true,
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
        badge: '/logo-badge-72.png',
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
  const url = `/#/notifications?id=${tag}&access_token=${btoa(access_token)}`;

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      console.log('NOTIFICATION CLICK clients 1', clients);
      if (clients.length && 'navigate' in clients[0]) {
        console.log('NOTIFICATION CLICK clients 2', clients);
        const bestClient =
          clients.find(
            (client) => client.focused || client.visibilityState === 'visible',
          ) || clients[0];
        console.log('NOTIFICATION CLICK navigate', url);
        if (bestClient) {
          console.log('NOTIFICATION CLICK postMessage', bestClient);
          bestClient.focus();
          bestClient.postMessage?.({
            type: 'notification',
            id: tag,
            accessToken: access_token,
          });
        } else {
          console.log('NOTIFICATION CLICK openWindow', url);
          await self.clients.openWindow(url);
        }
        // }
      } else {
        console.log('NOTIFICATION CLICK openWindow', url);
        await self.clients.openWindow(url);
      }
      await event.notification.close();
    })(),
  );
});
