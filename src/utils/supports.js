import { satisfies } from 'compare-versions';

import features from '../data/features.json';

import { getCurrentInstance } from './store-utils';

// Non-semver(?) UA string detection
const containPixelfed = /pixelfed/i;
const notContainPixelfed = /^(?!.*pixelfed).*$/i;
const platformFeatures = {
  '@mastodon/lists': notContainPixelfed,
  '@mastodon/filters': notContainPixelfed,
  '@mastodon/mentions': notContainPixelfed,
  '@mastodon/trending-hashtags': notContainPixelfed,
  '@mastodon/trending-links': notContainPixelfed,
  '@mastodon/post-bookmark': notContainPixelfed,
  '@mastodon/post-edit': notContainPixelfed,
  '@mastodon/profile-edit': notContainPixelfed,
  '@mastodon/profile-private-note': notContainPixelfed,
  '@pixelfed/trending': containPixelfed,
  '@pixelfed/home-include-reblogs': containPixelfed,
};
const supportsCache = {};

function supports(feature) {
  try {
    const { version, domain } = getCurrentInstance();
    const key = `${domain}-${feature}`;
    if (supportsCache[key]) return supportsCache[key];

    if (platformFeatures[feature]) {
      return (supportsCache[key] = platformFeatures[feature].test(version));
    }

    const range = features[feature];
    if (!range) return false;
    return (supportsCache[key] = satisfies(version, range, {
      includePrerelease: true,
      loose: true,
    }));
  } catch (e) {
    return false;
  }
}

export default supports;
