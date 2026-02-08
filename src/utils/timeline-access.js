import store from './store';

// Mock data to test timeline access controls
export const MOCK_INSTANCES = {
  'disabled.example.com': 'disabled',
  'authenticated.example.com': 'authenticated',
};

// feeds = liveFeeds, trendingFeed, hashtagFeed
// feedType = local, remote
export async function checkTimelineAccess(masto, instance, feeds, feedType) {
  try {
    const mockInstance = MOCK_INSTANCES[instance?.toLowerCase()];
    if (mockInstance) return mockInstance;

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

    const accessLevel =
      instanceInfo?.configuration?.timelinesAccess?.[feeds]?.[feedType];
    return accessLevel || 'public';
  } catch (e) {
    return 'public';
  }
}
