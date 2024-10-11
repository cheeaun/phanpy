import { satisfies } from 'compare-versions';

import features from '../data/features.json';

import { getCurrentInstance } from './store-utils';

// Non-semver(?) UA string detection
const containPixelfed = /pixelfed/i;
const notContainPixelfed = /^(?!.*pixelfed).*$/i;
const containPleroma = /pleroma/i;
const containAkkoma = /akkoma/i;
const containGlitch = /glitch|chuckya/i;
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
  '@pixelfed/global-feed': containPixelfed,
  '@pleroma/local-visibility-post': containPleroma,
  '@akkoma/local-visibility-post': containAkkoma,
};
const supportsCache = {};

function supports(feature) {
  try {
    const { version, domain } = getCurrentInstance();
    const key = `${domain}-${feature}`;
    if (supportsCache[key]) {
      console.debug(
        'SUPPORTS [cached]',
        key,
        platformFeatures[feature].test(version),
      );
      return supportsCache[key];
    }

    if (platformFeatures[feature]) {
      platformFeatures[feature].test(version);
      console.debug(
        'SUPPORTS [new]',
        key,
        platformFeatures[feature].test(version),
      );
      return (supportsCache[key] = feature);
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
