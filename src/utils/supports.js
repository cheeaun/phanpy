import { satisfies } from 'compare-versions';

import features from '../data/features.json';

import { getCurrentInstance } from './store-utils';

const supportsCache = {};

function supports(feature) {
  try {
    const { version, domain } = getCurrentInstance();
    const key = `${domain}-${feature}`;
    if (supportsCache[key]) return supportsCache[key];
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
