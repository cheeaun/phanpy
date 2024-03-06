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

function initDB(dbName, storeName) {
  const store = createStore(dbName, storeName);
  return {
    set: (key, val) => set(key, val, store),
    get: (key) => get(key, store),
    getMany: (keys) => getMany(keys, store),
    del: (key) => del(key, store),
    delMany: (keys) => delMany(keys, store),
    clear: () => clear(store),
    keys: () => keys(store),
  };
}

export default {
  drafts: initDB('drafts-db', 'drafts-store'),
  catchup: initDB('catchup-db', 'catchup-store'),
};
