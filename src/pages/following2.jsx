import { useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'preact/hooks';

import Timeline2 from '../components/timeline2';
import { api } from '../utils/api';
import { filteredItems } from '../utils/filters';
import { getStatus, saveStatus } from '../utils/states';
import supports from '../utils/supports';
import { assignFollowedTags, dedupeBoosts } from '../utils/timeline-utils';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

function Following2({ title, path, id, ...props }) {
  const { t } = useLingui();
  useTitle(
    title ||
      t({
        id: 'following.title',
        message: 'Following',
      }),
    path || '/_following2',
  );
  const { masto, streaming, instance, client } = api();
  const [streamingClient, setStreamingClient] = useState(streaming);

  // Streaming only happens after instance is initialized
  useEffect(() => {
    if (!streaming && client?.onStreamingReady) {
      client.onStreamingReady((streamingClient) => {
        setStreamingClient(streamingClient);
      });
    }
  }, [client]);
  __BENCHMARK.end('time-to-following');

  console.debug('RENDER Following2', title, id);
  const supportsPixelfed = supports('@pixelfed/home-include-reblogs');

  async function fetchHome({ max_id, min_id } = {}) {
    __BENCHMARK.start('fetch-home');

    const opts = {
      limit: LIMIT,
    };
    if (max_id) opts.max_id = max_id;
    if (min_id) opts.min_id = min_id;
    if (supportsPixelfed) {
      opts.include_reblogs = true;
    }

    const results = await masto.v1.timelines.home.list(opts).values().next();
    let { value } = results;

    const originalValue = [...(value || [])];
    if (value?.length) {
      // value = filteredItems(value, 'home');
      value.forEach((item) => {
        saveStatus(item, instance);
      });
      // value = dedupeBoosts(value, instance);
      setTimeout(() => {
        assignFollowedTags(value, instance);
      }, 100);

      // ENFORCE sort by datetime (Latest first)
      value.sort((a, b) => {
        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      });
    }

    __BENCHMARK.end('fetch-home');
    return {
      ...results,
      value,
      originalValue,
    };
  }

  async function checkForUpdates({ minID }) {
    try {
      const opts = {
        limit: 5,
        since_id: minID,
      };
      if (supportsPixelfed) {
        opts.include_reblogs = true;
      }
      const results = await masto.v1.timelines.home.list(opts).values().next();
      let { value } = results;
      if (value?.length) {
        value = dedupeBoosts(value, instance);
        value = filteredItems(value, 'home');
        return value.length > 0;
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  useEffect(() => {
    let sub;
    (async () => {
      if (streamingClient) {
        sub = streamingClient.user.subscribe();
        console.log('🎏 Streaming user (Following2)', sub);
        for await (const entry of sub) {
          if (!sub) break;
          if (entry.event === 'status.update') {
            const status = entry.payload;
            console.log(`🔄 Status ${status.id} updated`);
            saveStatus(status, instance);
          } else if (entry.event === 'delete') {
            const statusID = entry.payload;
            console.log(`❌ Status ${statusID} deleted`);
            const s = getStatus(statusID, instance);
            if (s) s._deleted = true;
          }
        }
        console.log('💥 Streaming user loop STOPPED (Following2)');
      }
    })();
    return () => {
      sub?.unsubscribe?.();
      sub = null;
    };
  }, [streamingClient]);

  return (
    <Timeline2
      title={title || t({ id: 'following.title', message: 'Following' })}
      id={id || 'following2'}
      emptyText={t`Nothing to see here.`}
      errorText={t`Unable to load posts.`}
      instance={instance}
      fetchItems={fetchHome}
      checkForUpdates={checkForUpdates}
      useItemID
      {...props}
      filterContext="home"
      showFollowedTags
      showReplyParent
    />
  );
}

export default Following2;
