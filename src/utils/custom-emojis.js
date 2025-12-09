import Fuse from 'fuse.js';

import pmem from './pmem';

async function _getCustomEmojis(instance, masto) {
  const emojis = await masto.v1.customEmojis.list();
  const visibleEmojis = emojis.filter((e) => e.visibleInPicker);
  const searcher = new Fuse(visibleEmojis, {
    keys: ['shortcode'],
    findAllMatches: true,
  });
  return [visibleEmojis, searcher];
}

const getCustomEmojis = pmem(_getCustomEmojis, {
  // Limit by time to reduce memory usage
  // Cached by instance
  matchesArg: (cacheKeyArg, keyArg) => cacheKeyArg.instance === keyArg.instance,
  maxAge: 30 * 60 * 1000, // 30 minutes
});

export { getCustomEmojis, _getCustomEmojis };
export default getCustomEmojis;
