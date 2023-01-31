import { useEffect, useRef, useState } from 'preact/hooks';

import useScroll from '../utils/useScroll';
import useTitle from '../utils/useTitle';

import Icon from './icon';
import Link from './link';
import Loader from './loader';
import Status from './status';

function Timeline({
  title,
  titleComponent,
  path,
  id,
  emptyText,
  errorText,
  fetchItems = () => {},
}) {
  if (title) {
    useTitle(title, path);
  }
  const [items, setItems] = useState([]);
  const [uiState, setUIState] = useState('default');
  const [showMore, setShowMore] = useState(false);
  const scrollableRef = useRef(null);
  const { nearReachEnd, reachStart } = useScroll({
    scrollableElement: scrollableRef.current,
  });

  const loadItems = (firstLoad) => {
    setUIState('loading');
    (async () => {
      try {
        const { done, value } = await fetchItems(firstLoad);
        if (value?.length) {
          if (firstLoad) {
            setItems(value);
          } else {
            setItems([...items, ...value]);
          }
          setShowMore(!done);
        } else {
          setShowMore(false);
        }
        setUIState('default');
      } catch (e) {
        console.error(e);
        setUIState('error');
      }
    })();
  };

  useEffect(() => {
    scrollableRef.current?.scrollTo({ top: 0 });
    loadItems(true);
  }, []);

  useEffect(() => {
    if (reachStart) {
      loadItems(true);
    }
  }, [reachStart]);

  useEffect(() => {
    if (nearReachEnd && showMore) {
      loadItems();
    }
  }, [nearReachEnd, showMore]);

  return (
    <div
      id={`${id}-page`}
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
        >
          <div class="header-side">
            <Link to="/" class="button plain">
              <Icon icon="home" size="l" />
            </Link>
          </div>
          {title && (titleComponent ? titleComponent : <h1>{title}</h1>)}
          <div class="header-side">
            <Loader hidden={uiState !== 'loading'} />
          </div>
        </header>
        {!!items.length ? (
          <>
            <ul class="timeline">
              {items.map((status) => {
                const { id: statusID, reblog } = status;
                const actualStatusID = reblog?.id || statusID;
                return (
                  <li key={`timeline-${statusID}`}>
                    <Link class="status-link" to={`/s/${actualStatusID}`}>
                      <Status status={status} />
                    </Link>
                  </li>
                );
              })}
            </ul>
            {showMore && (
              <button
                type="button"
                class="plain block"
                disabled={uiState === 'loading'}
                onClick={() => loadItems()}
                style={{ marginBlockEnd: '6em' }}
              >
                {uiState === 'loading' ? (
                  <Loader abrupt />
                ) : (
                  <>Show more&hellip;</>
                )}
              </button>
            )}
          </>
        ) : uiState === 'loading' ? (
          <ul class="timeline">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i}>
                <Status skeleton />
              </li>
            ))}
          </ul>
        ) : (
          uiState !== 'loading' && <p class="ui-state">{emptyText}</p>
        )}
        {uiState === 'error' ? (
          <p class="ui-state">
            {errorText}
            <br />
            <br />
            <button
              class="button plain"
              onClick={() => loadItems(!items.length)}
            >
              Try again
            </button>
          </p>
        ) : (
          uiState !== 'loading' &&
          !!items.length &&
          !showMore && <p class="ui-state insignificant">The end.</p>
        )}
      </div>
    </div>
  );
}

export default Timeline;
