import { getAPIVersions } from './store-utils';

export function supportsNativeQuote() {
  return getAPIVersions()?.mastodon >= 7;
}
