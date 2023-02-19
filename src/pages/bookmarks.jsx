import { useRef } from 'preact/hooks';

import Timeline from '../components/timeline';
import { api } from '../utils/api';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

function Bookmarks() {
  useTitle('Bookmarks', '/b');
  const { masto, instance } = api();
  const bookmarksIterator = useRef();
  async function fetchBookmarks(firstLoad) {
    if (firstLoad || !bookmarksIterator.current) {
      bookmarksIterator.current = masto.v1.bookmarks.list({ limit: LIMIT });
    }
    return await bookmarksIterator.current.next();
  }

  return (
    <Timeline
      title="Bookmarks"
      id="bookmarks"
      emptyText="No bookmarks yet. Go bookmark something!"
      errorText="Unable to load bookmarks"
      instance={instance}
      fetchItems={fetchBookmarks}
    />
  );
}

export default Bookmarks;
