import { satisfies } from 'compare-versions';

import { getCurrentInstance } from './store-utils';

const platformFeatures = {
  '@mastodon/edit-media-attributes': [['mastodon', '>=4.1']],
  '@mastodon/list-exclusive': [
    ['mastodon', '>=4.2'],
    ['gotosocial', '>=0.17'],
  ],
  '@mastodon/filtered-notifications': [['mastodon', '>=4.3']],
  '@mastodon/fetch-multiple-statuses': [['mastodon', '>=4.3']],
  '@mastodon/trending-link-posts': [['mastodon', '>=4.3']],
  '@mastodon/grouped-notifications': [['mastodon', '>=4.3']],
  '@mastodon/lists': [['!pixelfed']],
  '@mastodon/filters': [['!pixelfed']],
  '@mastodon/mentions': [['!pixelfed']],
  '@mastodon/trending-hashtags': [['!pixelfed']],
  '@mastodon/trending-links': [['!pixelfed']],
  '@mastodon/post-bookmark': [['!pixelfed']],
  '@mastodon/post-edit': [['!pixelfed']],
  '@mastodon/profile-edit': [['!pixelfed']],
  '@mastodon/profile-private-note': [['!pixelfed']],
  '@pixelfed/trending': [['pixelfed']],
  '@pixelfed/home-include-reblogs': [['pixelfed']],
  '@pixelfed/global-feed': [['pixelfed']],
  '@pleroma/local-visibility-post': [['pleroma']],
  '@akkoma/local-visibility-post': [['akkoma']],
};

const supportsCache = {};

function supports(feature) {
  const specs = platformFeatures[feature];
  if (!specs) return false;

  try {
    let { version, domain, nodeInfo } = getCurrentInstance();

    const key = `${domain}-${feature}`;
    if (supportsCache[key]) return supportsCache[key];

    let software = 'mastodon';
    if (
      nodeInfo && nodeInfo.software && typeof nodeInfo.software.version === 'string'
      && typeof nodeInfo.software.name === 'string'
    ) {
      software = nodeInfo.software.name.toLowerCase();
      version = nodeInfo.software.version;
    }

    const isSupported = specs.some((spec) => versionSatisfies(software, version, spec));
    return (supportsCache[key] = isSupported);
  } catch (e) {
    return false;
  }
}

function versionSatisfies(software, version, [softwareSpec, versionSpec]) {
  let softwareMatches;

  // Inverted spec, like !pixelfed
  if (softwareSpec.startsWith('!')) {
    softwareMatches = software !== softwareSpec.slice(1);
  } else {
    softwareMatches = (
      software === softwareSpec || (
        // Hometown inherits Mastodon features
        software === 'hometown' && softwareSpec === 'mastodon'
      )
    );
  }

  return softwareMatches && (
    versionSpec == null || satisfies(version, versionSpec, {
      includePrerelease: true,
      loose: true,
    })
  );
}

export default supports;
