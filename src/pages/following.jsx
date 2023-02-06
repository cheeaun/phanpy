import { useRef } from 'preact/hooks';
import { useSnapshot } from 'valtio';

import Timeline from '../components/timeline';
import { api } from '../utils/api';
import states from '../utils/states';
import { saveStatus } from '../utils/states';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

function Following() {
  useTitle('Following', '/l/f');
  const { masto, instance } = api();
  const snapStates = useSnapshot(states);
  const homeIterator = useRef();
  async function fetchHome(firstLoad) {
    if (firstLoad || !homeIterator.current) {
      homeIterator.current = masto.v1.timelines.listHome({ limit: LIMIT });
    }
    const results = await homeIterator.current.next();
    const { value } = results;
    if (value?.length) {
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

  return (
    <Timeline
      title="Following"
      id="following"
      emptyText="Nothing to see here."
      errorText="Unable to load posts."
      fetchItems={fetchHome}
      useItemID
      boostsCarousel={snapStates.settings.boostsCarousel}
    />
  );
}

export default Following;
