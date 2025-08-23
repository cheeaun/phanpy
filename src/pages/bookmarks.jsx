import { useLingui } from '@lingui/react/macro';
import { useRef } from 'preact/hooks';

import Timeline from '../components/timeline';
import { api } from '../utils/api';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

function Bookmarks() {
  const { t } = useLingui();
  useTitle(t`Bookmarks`, '/bookmarks');
  const { masto, instance } = api();
  const bookmarksIterator = useRef();
  async function fetchBookmarks(firstLoad) {
    if (firstLoad || !bookmarksIterator.current) {
      bookmarksIterator.current = masto.v1.bookmarks
        .list({ limit: LIMIT })
        .values();
    }
    return await bookmarksIterator.current.next();
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
