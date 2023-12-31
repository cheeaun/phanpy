import pThrottle from 'p-throttle';
import { snapshot } from 'valtio/vanilla';

import { api } from './api';
import states, { saveStatus } from './states';

export const throttle = pThrottle({
  limit: 1,
  interval: 1000,
});

const denylistDomains = /(twitter|github)\.com/i;
const failedUnfurls = {};
function _unfurlMastodonLink(instance, url) {
  const snapStates = snapshot(states);
  if (denylistDomains.test(url)) {
    return;
  }
  if (failedUnfurls[url]) {
    return;
  }
  const instanceRegex = new RegExp(instance + '/');
  if (instanceRegex.test(snapStates.unfurledLinks[url]?.url)) {
    return Promise.resolve(snapStates.unfurledLinks[url]);
  }
  console.debug('🦦 Unfurling URL', url);

  let remoteInstanceFetch;
  let theURL = url;

  // https://elk.zone/domain.com/@stest/123 -> https://domain.com/@stest/123
  if (/\/\/elk\.[^\/]+\/[^\/]+\.[^\/]+/i.test(theURL)) {
    theURL = theURL.replace(/elk\.[^\/]+\//i, '');
  }

  // https://trunks.social/status/domain.com/@stest/123 -> https://domain.com/@stest/123
  if (/\/\/trunks\.[^\/]+\/status\/[^\/]+\.[^\/]+/i.test(theURL)) {
    theURL = theURL.replace(/trunks\.[^\/]+\/status\//i, '');
  }

  // https://phanpy.social/#/domain.com/s/123 -> https://domain.com/statuses/123
  if (/\/#\/[^\/]+\.[^\/]+\/s\/.+/i.test(theURL)) {
    const urlAfterHash = theURL.split('/#/')[1];
    const finalURL = urlAfterHash.replace(/\/s\//i, '/@fakeUsername/');
    theURL = `https://${finalURL}`;
  }

  let urlObj;
  try {
    urlObj = new URL(theURL);
  } catch (e) {
    return;
  }
  const domain = urlObj.hostname;
  const path = urlObj.pathname;
  // Regex /:username/:id, where username = @username or @username@domain, id = number
  const statusRegex = /\/@([^@\/]+)@?([^\/]+)?\/(\d+)$/i;
  const statusMatch = statusRegex.exec(path);
  if (statusMatch) {
    const id = statusMatch[3];
    const { masto } = api({ instance: domain });
    remoteInstanceFetch = masto.v1.statuses
      .$select(id)
      .fetch()
      .then((status) => {
        if (status?.id) {
          return {
            status,
            instance: domain,
          };
        } else {
          throw new Error('No results');
        }
      });
  }

  const { masto } = api({ instance });
  const mastoSearchFetch = masto.v2.search
    .fetch({
      q: theURL,
      type: 'statuses',
      resolve: true,
      limit: 1,
    })
    .then((results) => {
      if (results.statuses.length > 0) {
        const status = results.statuses[0];
        return {
          status,
          instance,
        };
      } else {
        throw new Error('No results');
      }
    });

  function handleFulfill(result) {
    const { status, instance } = result;
    const { id } = status;
    const selfURL = `/${instance}/s/${id}`;
    console.debug('🦦 Unfurled URL', url, id, selfURL);
    const data = {
      id,
      instance,
      url: selfURL,
    };
    states.unfurledLinks[url] = data;
    saveStatus(status, instance, {
      skipThreading: true,
    });
    return data;
  }
  function handleCatch(e) {
    failedUnfurls[url] = true;
  }

  if (remoteInstanceFetch) {
    // return Promise.any([remoteInstanceFetch, mastoSearchFetch])
    //   .then(handleFulfill)
    //   .catch(handleCatch);
    // If mastoSearchFetch is fulfilled within 3s, return it, else return remoteInstanceFetch
    const finalPromise = Promise.race([
      mastoSearchFetch,
      new Promise((resolve, reject) => setTimeout(reject, 3000)),
    ]).catch(() => {
      // If remoteInstanceFetch is fullfilled, return it, else return mastoSearchFetch
      return remoteInstanceFetch.catch(() => mastoSearchFetch);
    });
    return finalPromise.then(handleFulfill).catch(handleCatch);
  } else {
    return mastoSearchFetch.then(handleFulfill).catch(handleCatch);
  }
}

const unfurlMastodonLink = throttle(_unfurlMastodonLink);
export default unfurlMastodonLink;
