import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { RegExpRoute, registerRoute, Route } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';

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

// Cache /instance because masto.js has to keep calling it while initializing
const apiExtendedRoute = new RegExpRoute(
  /^https?:\/\/[^\/]+\/api\/v\d+\/(instance|custom_emojis)/,
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

// Not caching API requests, doesn't seem to be necessary fo now
//
// const apiRoute = new RegExpRoute(
//   /^https?:\/\/[^\/]+\/api\//,
//   new StaleWhileRevalidate({
//     cacheName: 'api',
//     plugins: [
//       new ExpirationPlugin({
//         maxAgeSeconds: 60, // 1 minute
//       }),
//       new CacheableResponsePlugin({
//         statuses: [0, 200],
//       }),
//     ],
//   }),
// );
// registerRoute(apiRoute);
