import { useLingui } from '@lingui/react/macro';
import { useRef } from 'preact/hooks';
import { useSnapshot } from 'valtio';

import Timeline from '../components/timeline';
import { api } from '../utils/api';
import states from '../utils/states';
import { applyTimelineFilters } from '../utils/timeline-utils';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

function Bookmarks() {
  const { t } = useLingui();
  const snapStates = useSnapshot(states);
  useTitle(t`Bookmarks`, '/b');
  const { masto, instance } = api();
  const bookmarksIterator = useRef();
  async function fetchBookmarks(firstLoad) {
    if (firstLoad || !bookmarksIterator.current) {
      bookmarksIterator.current = masto.v1.bookmarks
        .list({ limit: LIMIT })
        .values();
    }
    const results = await bookmarksIterator.current.next();
    let { value } = results;
    if (value?.length) {
      value = applyTimelineFilters(value, snapStates.settings);
    }
    return {
      ...results,
      value,
    };
  }

  return (
    <Timeline
      title={t`Bookmarks`}
      id="bookmarks"
      emptyText={t`No bookmarks yet. Go bookmark something!`}
      errorText={t`Unable to load bookmarks.`}
      instance={instance}
      fetchItems={fetchBookmarks}
    />
  );
}

export default Bookmarks;
