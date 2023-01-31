import { useRef } from 'preact/hooks';

import Timeline from '../components/timeline';

const LIMIT = 20;

function Bookmarks() {
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
      fetchItems={fetchBookmarks}
    />
  );
}

export default Bookmarks;
