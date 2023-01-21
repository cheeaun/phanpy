import { useEffect, useRef, useState } from 'preact/hooks';

import Icon from '../components/Icon';
import Link from '../components/link';
import Loader from '../components/Loader';
import Status from '../components/status';
import useTitle from '../utils/useTitle';

const LIMIT = 40;

function Bookmarks() {
  useTitle('Bookmarks');
  const [bookmarks, setBookmarks] = useState([]);
  const [uiState, setUIState] = useState('default');
  const [showMore, setShowMore] = useState(false);

  const bookmarksIterator = useRef();
  async function fetchBookmarks(firstLoad) {
    if (firstLoad || !bookmarksIterator.current) {
      bookmarksIterator.current = masto.v1.bookmarks.list({ limit: LIMIT });
    }
    const allBookmarks = await bookmarksIterator.current.next();
    const bookmarksValue = allBookmarks.value;
    if (bookmarksValue?.length) {
      if (firstLoad) {
        setBookmarks(bookmarksValue);
      } else {
        setBookmarks([...bookmarks, ...bookmarksValue]);
      }
    }
    return allBookmarks;
  }

  const loadBookmarks = (firstLoad) => {
    setUIState('loading');
    (async () => {
      try {
        const { done } = await fetchBookmarks(firstLoad);
        setShowMore(!done);
        setUIState('default');
      } catch (e) {
        console.error(e);
        setUIState('error');
      }
    })();
  };

  useEffect(() => {
    loadBookmarks(true);
  }, []);

  const scrollableRef = useRef(null);

  return (
    <div
      id="bookmarks-page"
      class="deck-container"
      ref={scrollableRef}
      tabIndex="-1"
    >
      <div class="timeline-deck deck">
        <header
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              scrollableRef.current?.scrollTo({
                top: 0,
                behavior: 'smooth',
              });
            }
          }}
          onDblClick={(e) => {
            loadBookmarks(true);
          }}
        >
          <div class="header-side">
            <Link to="/" class="button plain">
              <Icon icon="home" size="l" />
            </Link>
          </div>
          <h1>Bookmarks</h1>
          <div class="header-side">
            <Loader hidden={uiState !== 'loading'} />
          </div>
        </header>
        {!!bookmarks.length ? (
          <>
            <ul class="timeline">
              {bookmarks.map((status) => (
                <li key={`bookmark-${status.id}`}>
                  <Link class="status-link" to={`/s/${status.id}`}>
                    <Status status={status} />
                  </Link>
                </li>
              ))}
            </ul>
            {showMore && (
              <button
                type="button"
                class="plain block"
                disabled={uiState === 'loading'}
                onClick={() => loadBookmarks()}
                style={{ marginBlockEnd: '6em' }}
              >
                {uiState === 'loading' ? <Loader /> : <>Show more&hellip;</>}
              </button>
            )}
          </>
        ) : (
          uiState !== 'loading' && (
            <p class="ui-state">No bookmarks yet. Go bookmark something!</p>
          )
        )}
        {uiState === 'loading' ? (
          <ul class="timeline">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i}>
                <Status skeleton />
              </li>
            ))}
          </ul>
        ) : uiState === 'error' ? (
          <p class="ui-state">
            Unable to load bookmarks.
            <br />
            <br />
            <button
              class="button plain"
              onClick={() => loadBookmarks(!bookmarks.length)}
            >
              Try again
            </button>
          </p>
        ) : (
          bookmarks.length &&
          !showMore && <p class="ui-state insignificant">The end.</p>
        )}
      </div>
    </div>
  );
}

export default Bookmarks;
