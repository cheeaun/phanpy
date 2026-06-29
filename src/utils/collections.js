import { getAPIVersions } from './store-utils';

export const COLLECTIONS_LIMIT = 80;

export function isSupported() {
  return getAPIVersions()?.mastodon >= 10;
}
