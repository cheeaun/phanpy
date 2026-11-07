import { useLingui } from '@lingui/react/macro';
import { useRef } from 'preact/hooks';

import Timeline from '../components/timeline';
import { api } from '../utils/api';
import { SAVE_TERMINOLOGY } from '../utils/flags';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

function Bookmarks() {
  const { t } = useLingui();
  useTitle(SAVE_TERMINOLOGY ? t`Saved Posts` : t`Bookmarks`, '/b');
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
      title={SAVE_TERMINOLOGY ? t`Saved Posts` : t`Bookmarks`}
      id="bookmarks"
      emptyText={
        SAVE_TERMINOLOGY
          ? t`No saved posts yet. Go save something!`
          : t`No bookmarks yet. Go bookmark something!`
      }
      errorText={
        SAVE_TERMINOLOGY
          ? t`Unable to load saved posts.`
          : t`Unable to load bookmarks.`
      }
      instance={instance}
      fetchItems={fetchBookmarks}
    />
  );
}

export default Bookmarks;
