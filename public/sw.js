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

// Custom plugin to manage hashed assets
class AssetHashPlugin {
  constructor(options = {}) {
    this.maxHashes = options.maxHashes || 2;
    this.dbName = 'workbox-expiration';
    this.storeName = 'cache-entries';
  }

  // Extract base filename from a hashed URL
  // e.g., "main-abc123.js" -> "main"
  _getBaseName(url) {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop();

    // Match pattern: basename-hash.extension
    // Hash uses URL-safe base64 characters (A-Za-z0-9_-), typically 8+ chars
    const match = filename.match(/^(.+?)-[A-Za-z0-9_-]{8,}\.(js|css)$/);
    return match ? match[1] : null;
  }

  // Get timestamps for multiple URLs from Workbox's ExpirationPlugin IndexedDB
  async _getTimestampsFromDB(cacheName, urls) {
    try {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);

      // Batch read all timestamps in a single transaction
      const timestamps = await Promise.all(
        urls.map((url) => {
          // Workbox stores entries with key format: `${cacheName}|${url}`
          const key = `${cacheName}|${url}`;

          return new Promise((resolve) => {
            const request = store.get(key);
            request.onsuccess = () =>
              resolve(request.result?.timestamp || Date.now());
            request.onerror = () => resolve(Date.now());
          });
        }),
      );

      db.close();

      return timestamps;
    } catch (error) {
      console.warn(
        `[AssetHashPlugin] Error reading timestamps from IndexedDB:`,
        error,
      );
      // Return current time for all URLs as fallback
      return urls.map(() => Date.now());
    }
  }

  cacheDidUpdate({ cacheName, request }) {
    // Run cleanup asynchronously without blocking the cache operation
    this._cleanupOldHashes(cacheName, request.url);
  }

  async _cleanupOldHashes(cacheName, requestUrl) {
    try {
      const baseName = this._getBaseName(requestUrl);
      if (!baseName) return;

      const cache = await caches.open(cacheName);

      // Find all cached entries with the same base name
      const cachedRequests = await cache.keys();
      const matchingRequests = [];

      for (const cachedRequest of cachedRequests) {
        const cachedBaseName = this._getBaseName(cachedRequest.url);
        if (cachedBaseName === baseName) {
          const response = await cache.match(cachedRequest);
          if (response) {
            matchingRequests.push(cachedRequest);
          }
        }
      }

      if (matchingRequests.length <= this.maxHashes) return;

      // Batch read all timestamps in a single database transaction
      const urls = matchingRequests.map((req) => req.url);
      const timestamps = await this._getTimestampsFromDB(cacheName, urls);

      // Build matching entries with timestamps
      const matchingEntries = matchingRequests.map((req, index) => ({
        request: req,
        url: req.url,
        timestamp: timestamps[index],
      }));

      // Sort by timestamp (newest first)
      matchingEntries.sort((a, b) => b.timestamp - a.timestamp);

      // Keep only the maxHashes most recent, delete the rest
      const toDelete = matchingEntries.slice(this.maxHashes);

      for (const entry of toDelete) {
        await cache.delete(entry.request);
        console.log(`[AssetHashPlugin] Deleted old hash: ${entry.url}`);
      }
    } catch (error) {
      console.warn(`[AssetHashPlugin] Error during cleanup:`, error);
    }
  }
}

const expirationPluginOptions = {
  purgeOnQuotaError: true,
  // "CacheFirst image maxEntries not working" https://github.com/GoogleChrome/workbox/issues/2768#issuecomment-793109906
  matchOptions: {
    // https://developer.mozilla.org/en-US/docs/Web/API/Cache/delete#Parameters
    ignoreVary: true,
  },
};

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
        ...expirationPluginOptions,
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
  new StaleWhileRevalidate({
    cacheName: 'assets',
    plugins: [
      // Only enable AssetHashPlugin in production
      ...(import.meta.env.PROD
        ? [
            new AssetHashPlugin({
              maxHashes: 2, // Keep only 2 most recent hashes of each file
            }),
          ]
        : []),
      new ExpirationPlugin({
        maxEntries: 40,
        ...expirationPluginOptions,
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
        ...expirationPluginOptions,
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
        ...expirationPluginOptions,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  }),
);
registerRoute(apiExtendedRoute);

// Cache ActivityPub requests (Accept: application/activity+json)
const activityPubRoute = new Route(
  ({ request }) => {
    const acceptHeader = request.headers.get('accept');
    return acceptHeader?.includes('application/activity+json');
  },
  new StaleWhileRevalidate({
    cacheName: 'activity-json',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 60 * 60, // 1 hour
        ...expirationPluginOptions,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  }),
);
registerRoute(activityPubRoute);

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
        ...expirationPluginOptions,
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
