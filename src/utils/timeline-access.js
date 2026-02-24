import { api } from './api';
import store from './store';

// Mock data to test timeline access controls
const MOCK_INSTANCES = {
  'disabled.example.com': 'disabled',
  'authenticated.example.com': 'authenticated',
};

async function getInstanceInfo(masto, instance) {
  const instances = store.local.getJSON('instances') || {};
  let instanceInfo = instances[instance?.toLowerCase()];

  const timelinesAccess = instanceInfo?.configuration?.timelinesAccess;
  if (!timelinesAccess) {
    const freshInfo = await masto.v2.instance.fetch().catch(() => null);
    if (freshInfo) {
      instanceInfo = freshInfo;
      instances[instance?.toLowerCase()] = freshInfo;
      store.local.setJSON('instances', instances);
    }
  }

  return instanceInfo;
}

// Check timeline access
// - feed: liveFeeds, hashtagFeeds, trendingLinkFeeds
// - feedType: local, remote
// - feeds: array of {feed, feedType} for batch checking
// - instance: optional, defaults to current instance from api()
export async function checkTimelineAccess({ feed, feedType, feeds, instance }) {
  const { masto, instance: currentInstance } = api({ instance });
  const instanceName = instance || currentInstance;

  try {
    const mockInstance = MOCK_INSTANCES[instanceName?.toLowerCase()];

    // Batch check
    if (feeds) {
      if (mockInstance) {
        const result = {};
        feeds.forEach(({ feed: f, feedType: ft }) => {
          result[`${f}_${ft}`] = mockInstance;
        });
        return result;
      }

      const instanceInfo = await getInstanceInfo(masto, instanceName);
      const result = {};
      feeds.forEach(({ feed: f, feedType: ft }) => {
        result[`${f}_${ft}`] =
          instanceInfo?.configuration?.timelinesAccess?.[f]?.[ft] || 'public';
      });
      return result;
    }

    // Single check
    if (mockInstance) return mockInstance;

    const instanceInfo = await getInstanceInfo(masto, instanceName);
    const accessLevel =
      instanceInfo?.configuration?.timelinesAccess?.[feed]?.[feedType];
    return accessLevel || 'public';
  } catch (e) {
    return feeds ? {} : 'public';
  }
}
