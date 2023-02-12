import { useEffect, useRef } from 'preact/hooks';
import { useSnapshot } from 'valtio';

import Icon from '../components/icon';
import Link from '../components/link';
import Timeline from '../components/timeline';
import { api } from '../utils/api';
import states from '../utils/states';
import { getStatus, saveStatus } from '../utils/states';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

function Following({ title, path, id, headerStart }) {
  useTitle(title || 'Following', path, '/l/f');
  const { masto, instance } = api();
  const snapStates = useSnapshot(states);
  const homeIterator = useRef();
  const latestItem = useRef();

  async function fetchHome(firstLoad) {
    if (firstLoad || !homeIterator.current) {
      homeIterator.current = masto.v1.timelines.listHome({ limit: LIMIT });
    }
    const results = await homeIterator.current.next();
    const { value } = results;
    if (value?.length) {
      if (firstLoad) {
        latestItem.current = value[0].id;
      }

      value.forEach((item) => {
        saveStatus(item, instance);
      });

      // ENFORCE sort by datetime (Latest first)
      value.sort((a, b) => {
        const aDate = new Date(a.createdAt);
        const bDate = new Date(b.createdAt);
        return bDate - aDate;
      });
    }
    return results;
  }

  async function checkForUpdates() {
    try {
      const results = await masto.v1.timelines
        .listHome({
          limit: 5,
          since_id: latestItem.current,
        })
        .next();
      const { value } = results;
      console.log('checkForUpdates', latestItem.current, value);
      if (value?.length && value.some((item) => !item.reblog)) {
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  const ws = useRef();
  const streamUser = async () => {
    console.log('🎏 Start streaming user', ws.current);
    if (
      ws.current &&
      (ws.current.readyState === WebSocket.CONNECTING ||
        ws.current.readyState === WebSocket.OPEN)
    ) {
      console.log('🎏 Streaming user already open');
      return;
    }
    const stream = await masto.v1.stream.streamUser();
    ws.current = stream.ws;
    ws.current.__id = Math.random();
    console.log('🎏 Streaming user', ws.current);

    stream.on('status.update', (status) => {
      console.log(`🔄 Status ${status.id} updated`);
      saveStatus(status, instance);
    });

    stream.on('delete', (statusID) => {
      console.log(`❌ Status ${statusID} deleted`);
      // delete states.statuses[statusID];
      const s = getStatus(statusID, instance);
      if (s) s._deleted = true;
    });

    stream.ws.onclose = () => {
      console.log('🎏 Streaming user closed');
    };

    return stream;
  };
  useEffect(() => {
    let stream;
    (async () => {
      stream = await streamUser();
    })();
    return () => {
      if (stream) {
        stream.ws.close();
        ws.current = null;
      }
    };
  }, []);

  const headerEnd = (
    <Link
      to="/notifications"
      class={`button plain ${
        snapStates.notificationsShowNew ? 'has-badge' : ''
      }`}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <Icon icon="notification" size="l" alt="Notifications" />
    </Link>
  );

  return (
    <Timeline
      title={title || 'Following'}
      id={id || 'following'}
      emptyText="Nothing to see here."
      errorText="Unable to load posts."
      fetchItems={fetchHome}
      checkForUpdates={checkForUpdates}
      useItemID
      headerStart={headerStart}
      headerEnd={headerEnd}
      boostsCarousel={snapStates.settings.boostsCarousel}
    />
  );
}

export default Following;
