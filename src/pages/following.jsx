import { useEffect, useRef } from 'preact/hooks';
import { useSnapshot } from 'valtio';

import Timeline from '../components/timeline';
import { api } from '../utils/api';
import { filteredItems } from '../utils/filters';
import states from '../utils/states';
import { getStatus, saveStatus } from '../utils/states';
import { dedupeBoosts } from '../utils/timeline-utils';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

function Following({ title, path, id, ...props }) {
  useTitle(title || 'Following', path || '/following');
  const { masto, streaming, instance } = api();
  const snapStates = useSnapshot(states);
  const homeIterator = useRef();
  const latestItem = useRef();

  console.debug('RENDER Following', title, id);

  async function fetchHome(firstLoad) {
    if (firstLoad || !homeIterator.current) {
      homeIterator.current = masto.v1.timelines.home.list({ limit: LIMIT });
    }
    const results = await homeIterator.current.next();
    let { value } = results;
    if (value?.length) {
      if (firstLoad) {
        latestItem.current = value[0].id;
        console.log('First load', latestItem.current);
      }

      value = filteredItems(value, 'home');
      value.forEach((item) => {
        saveStatus(item, instance);
      });
      value = dedupeBoosts(value, instance);

      // ENFORCE sort by datetime (Latest first)
      value.sort((a, b) => {
        const aDate = new Date(a.createdAt);
        const bDate = new Date(b.createdAt);
        return bDate - aDate;
      });
    }
    return {
      ...results,
      value,
    };
  }

  async function checkForUpdates() {
    try {
      const results = await masto.v1.timelines.home
        .list({
          limit: 5,
          since_id: latestItem.current,
        })
        .next();
      let { value } = results;
      console.log('checkForUpdates', latestItem.current, value);
      if (value?.length) {
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
      }
    })();
    return () => {
      sub?.unsubscribe?.();
      sub = null;
    };
  }, [streaming]);

  return (
    <Timeline
      title={title || 'Following'}
      id={id || 'following'}
      emptyText="Nothing to see here."
      errorText="Unable to load posts."
      instance={instance}
      fetchItems={fetchHome}
      checkForUpdates={checkForUpdates}
      useItemID
      boostsCarousel={snapStates.settings.boostsCarousel}
      {...props}
      allowFilters
    />
  );
}

export default Following;
