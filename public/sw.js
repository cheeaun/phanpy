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
        maxEntries: 100,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
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
// - /api/v1/instance
// - /api/v1/custom_emojis
// - /api/v1/preferences
// - /api/v1/lists/:id
const apiExtendedRoute = new RegExpRoute(
  /^https?:\/\/[^\/]+\/api\/v\d+\/(instance|custom_emojis|preferences|lists\/\d+)/,
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
