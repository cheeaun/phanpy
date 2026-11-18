import { getAPIVersions } from './store-utils';

export const COLLECTIONS_LIMIT = 80;

export function isSupported() {
  return getAPIVersions()?.mastodon >= 10;
}

export function canAccountBeAdded(account) {
  return ['automatic', 'manual'].includes(
    account?.featureApproval?.currentUser,
  );
}

export function canAccountBeAddedByFollowers(account) {
  const fa = account?.featureApproval;
  return (
    fa?.automatic?.includes('followers') || fa?.manual?.includes('followers')
  );
}
