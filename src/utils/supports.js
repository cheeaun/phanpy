import { satisfies } from 'compare-versions';

import features from '../data/features.json';

import { getCurrentInstance, getCurrentNodeInfo } from './store-utils';

// Non-semver(?) UA string detection
const containPixelfed = /pixelfed/i;
const notContainPixelfed = /^(?!.*pixelfed).*$/i;
const containPleroma = /pleroma/i;
const containAkkoma = /akkoma/i;
const containGTS = /gotosocial/i;
const containChuckya = /chuckya/i;
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
  '@chuckya/bubble-timeline': containChuckya,
};
const advertisedFeatures = {
  '@akkoma/bubble-timeline': 'bubble_timeline',
};

const supportsCache = {};

function supports(feature) {
  try {
    let instanceData = getCurrentInstance();
    let version = instanceData.version;
    let domain = instanceData.domain;
    let pleroma = instanceData?.pleroma;

    let softwareName = getCurrentNodeInfo()?.software?.name || 'mastodon';

    if (softwareName === 'hometown') {
      // Hometown is a Mastodon fork and inherits its features
      softwareName = 'mastodon';
    }

    const key = `${domain}-${feature}`;
    if (supportsCache[key]) return supportsCache[key];

    if (platformFeatures[feature]) {
      return (supportsCache[key] = platformFeatures[feature].test(version));
    }

    // Advertised features
    if (pleroma) {
      return (supportsCache[key] = pleroma.metadata.features.includes(
        advertisedFeatures[feature],
      ));
    }

    const range = features[feature];
    if (!range) return false;

    // '@mastodon/blah' => 'mastodon'
    const featureSoftware = feature.match(/^@([a-z]+)\//)[1];

    const doesSoftwareMatch = featureSoftware === softwareName.toLowerCase();
    return (supportsCache[key] =
      doesSoftwareMatch &&
      satisfies(version, range, {
        includePrerelease: true,
        loose: true,
      }));
  } catch (e) {
    return false;
  }
}

export default supports;
