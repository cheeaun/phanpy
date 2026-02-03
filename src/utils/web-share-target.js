import { createStore, del, get, set } from 'idb-keyval';

const WEB_SHARE_TARGET_DB_NAME = 'web-share-target-db';
const WEB_SHARE_TARGET_STORE_NAME = 'web-share-target-store';
const WEB_SHARE_TARGET_KEY = 'sharedData';
export const WEB_SHARE_TARGET_PATH = '/share';

const webShareTargetStore = createStore(
  WEB_SHARE_TARGET_DB_NAME,
  WEB_SHARE_TARGET_STORE_NAME,
);

export const webShareTarget = {
  get: (key = WEB_SHARE_TARGET_KEY) => get(key, webShareTargetStore),
  set: (val, key = WEB_SHARE_TARGET_KEY) => set(key, val, webShareTargetStore),
  del: (key = WEB_SHARE_TARGET_KEY) => del(key, webShareTargetStore),
  close() {
    try {
      webShareTargetStore('readonly', (store) => {
        store.transaction.db.close();
      });
    } catch (error) {
      console.error('[Web Share Target] Error closing database:', error);
    }
  },
  process(data) {
    if (!data) return null;

    const textParts = [];
    if (data.title) textParts.push(data.title);
    if (data.text) textParts.push(data.text);
    if (data.url) textParts.push(data.url);

    return {
      initialText: textParts.join('\n\n'),
      files: data.files || [],
    };
  },
};
