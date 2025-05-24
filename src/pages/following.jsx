import { useLingui } from '@lingui/react/macro';
import { useEffect, useRef } from 'preact/hooks';
import { useSnapshot } from 'valtio';

import Timeline from '../components/timeline';
import { api } from '../utils/api';
import { filteredItems } from '../utils/filters';
import states, { getStatus, saveStatus } from '../utils/states';
import supports from '../utils/supports';
import {
  assignFollowedTags,
  clearFollowedTagsState,
  dedupeBoosts,
} from '../utils/timeline-utils';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

function Following({ title, path, id, ...props }) {
  const { t } = useLingui();
  useTitle(
    title ||
      t({
        id: 'following.title',
        message: 'Following',
      }),
    path || '/following',
  );
  const { masto, streaming, instance } = api();
  const snapStates = useSnapshot(states);
  const homeIterable = useRef();
  const homeIterator = useRef();
  const latestItem = useRef();
  __BENCHMARK.end('time-to-following');

  console.debug('RENDER Following', title, id);
  const supportsPixelfed = supports('@pixelfed/home-include-reblogs');

  async function fetchHome(firstLoad) {
    if (firstLoad || !homeIterator.current) {
      __BENCHMARK.start('fetch-home-first');
      homeIterable.current = masto.v1.timelines.home.list({ limit: LIMIT });
      homeIterator.current = homeIterable.current.values();
    }
    if (supportsPixelfed && homeIterable.current?.params) {
      if (typeof homeIterable.current.params === 'string') {
        homeIterable.current.params += '&include_reblogs=true';
      } else {
        homeIterable.current.params.include_reblogs = true;
      }
    }
    const results = await homeIterator.current.next();
    let { value } = results;
    if (value?.length) {
      let latestItemChanged = false;
      if (firstLoad) {
        if (value[0].id !== latestItem.current) {
          latestItemChanged = true;
        }
        latestItem.current = value[0].id;
        console.log('First load', latestItem.current);
      }

      // value = filteredItems(value, 'home');
      value.forEach((item) => {
        saveStatus(item, instance);
      });
      value = dedupeBoosts(value, instance);
      if (firstLoad && latestItemChanged) clearFollowedTagsState();
      assignFollowedTags(value, instance);

      // ENFORCE sort by datetime (Latest first)
      value.sort((a, b) => {
        const aDate = new Date(a.createdAt);
        const bDate = new Date(b.createdAt);
        return bDate - aDate;
      });
    }
    __BENCHMARK.end('fetch-home-first');
    return {
      ...results,
      value,
    };
  }

  async function checkForUpdates() {
    try {
      const opts = {
        limit: 5,
        since_id: latestItem.current,
      };
      if (supports('@pixelfed/home-include-reblogs')) {
        opts.include_reblogs = true;
      }
      const results = await masto.v1.timelines.home.list(opts).next();
      let { value } = results;
      console.log('checkForUpdates', latestItem.current, value);
      const valueContainsLatestItem = value[0]?.id === latestItem.current; // since_id might not be supported
      if (value?.length && !valueContainsLatestItem) {
        latestItem.current = value[0].id;
        value = dedupeBoosts(value, instance);
        value = filteredItems(value, 'home');
        if (value.some((item) => !item.reblog)) {
          return true;
        }
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  useEffect(() => {
    let sub;
    (async () => {
      if (streaming) {
        sub = streaming.user.subscribe();
        console.log('🎏 Streaming user', sub);
        for await (const entry of sub) {
          if (!sub) break;
          if (entry.event === 'status.update') {
            const status = entry.payload;
            console.log(`🔄 Status ${status.id} updated`);
            saveStatus(status, instance);
          } else if (entry.event === 'delete') {
            const statusID = entry.payload;
            console.log(`❌ Status ${statusID} deleted`);
            // delete states.statuses[statusID];
            const s = getStatus(statusID, instance);
            if (s) s._deleted = true;
          }
        }
        console.log('💥 Streaming user loop STOPPED');
      }
    })();
    return () => {
      sub?.unsubscribe?.();
      sub = null;
    };
  }, [streaming]);

  return (
    <Timeline
      title={title || t({ id: 'following.title', message: 'Following' })}
      id={id || 'following'}
      emptyText={t`Nothing to see here.`}
      errorText={t`Unable to load posts.`}
      instance={instance}
      fetchItems={fetchHome}
      checkForUpdates={checkForUpdates}
      useItemID
      boostsCarousel={snapStates.settings.boostsCarousel}
      {...props}
      // allowFilters
      filterContext="home"
      showFollowedTags
      showReplyParent
    />
  );
}

export default Following;
