import {
  clear,
  createStore,
  del,
  delMany,
  get,
  getMany,
  keys,
  set,
} from 'idb-keyval';

const draftsStore = createStore('drafts-db', 'drafts-store');

// Add additonal `draftsStore` parameter to all methods

const drafts = {
  set: (key, val) => set(key, val, draftsStore),
  get: (key) => get(key, draftsStore),
  getMany: (keys) => getMany(keys, draftsStore),
  del: (key) => del(key, draftsStore),
  delMany: (keys) => delMany(keys, draftsStore),
  clear: () => clear(draftsStore),
  keys: () => keys(draftsStore),
};

export default {
  drafts,
};
