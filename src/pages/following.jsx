import { useRef } from 'preact/hooks';
import { useSnapshot } from 'valtio';

import Timeline from '../components/timeline';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

function Following() {
  useTitle('Following', '/l/f');
  const snapStates = useSnapshot(states);
  const homeIterator = useRef();
  async function fetchHome(firstLoad) {
    if (firstLoad || !homeIterator.current) {
      homeIterator.current = masto.v1.timelines.listHome({ limit: LIMIT });
    }
    return await homeIterator.current.next();
  }

  return (
    <Timeline
      title="Following"
      id="following"
      emptyText="Nothing to see here."
      errorText="Unable to load posts."
      fetchItems={fetchHome}
      boostsCarousel={snapStates.settings.boostsCarousel}
    />
  );
}

export default Following;
