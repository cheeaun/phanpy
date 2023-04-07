import { useRef } from 'preact/hooks';

import Timeline from '../components/timeline';
import { api } from '../utils/api';
import { saveStatus } from '../utils/states';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

function Mentions() {
  useTitle('Mentions', '/mentions');
  const { masto, instance } = api();
  const mentionsIterator = useRef();
  const latestItem = useRef();

  async function fetchMentions(firstLoad) {
    if (firstLoad || !mentionsIterator.current) {
      mentionsIterator.current = masto.v1.notifications.list({
        limit: LIMIT,
        types: ['mention'],
      });
    }
    const results = await mentionsIterator.current.next();
    let { value } = results;
    if (value?.length) {
      if (firstLoad) {
        latestItem.current = value[0].id;
        console.log('First load', latestItem.current);
      }

      value.forEach(({ status: item }) => {
        saveStatus(item, instance);
      });
    }
    return {
      ...results,
      value: value.map((item) => item.status),
    };
  }

  async function checkForUpdates() {
    try {
      const results = await masto.v1.notifications
        .list({
          limit: 1,
          types: ['mention'],
          since_id: latestItem.current,
        })
        .next();
      let { value } = results;
      console.log('checkForUpdates', latestItem.current, value);
      if (value?.length) {
        latestItem.current = value[0].id;
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  return (
    <Timeline
      title="Mentions"
      id="mentions"
      emptyText="No one mentioned you :("
      errorText="Unable to load mentions."
      instance={instance}
      fetchItems={fetchMentions}
      checkForUpdates={checkForUpdates}
      useItemID
    />
  );
}

export default Mentions;
