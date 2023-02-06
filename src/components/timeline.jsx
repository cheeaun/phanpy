import { useEffect, useRef, useState } from 'preact/hooks';
import { useDebouncedCallback } from 'use-debounce';

import useScroll from '../utils/useScroll';

import Icon from './icon';
import Link from './link';
import Loader from './loader';
import Status from './status';

function Timeline({
  title,
  titleComponent,
  id,
  instance,
  emptyText,
  errorText,
  boostsCarousel,
  fetchItems = () => {},
}) {
  const [items, setItems] = useState([]);
  const [uiState, setUIState] = useState('default');
  const [showMore, setShowMore] = useState(false);
  const scrollableRef = useRef(null);
  const { nearReachEnd, reachStart, reachEnd } = useScroll({
    scrollableElement: scrollableRef.current,
    distanceFromEnd: 1,
  });

  const loadItems = useDebouncedCallback(
    (firstLoad) => {
      if (uiState === 'loading') return;
      setUIState('loading');
      (async () => {
        try {
          let { done, value } = await fetchItems(firstLoad);
          if (value?.length) {
            if (boostsCarousel) {
              value = groupBoosts(value);
            }
            console.log(value);
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
    },
    1500,
    {
      leading: true,
      trailing: false,
    },
  );

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
    if (nearReachEnd || (reachEnd && showMore)) {
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
                const { id: statusID, reblog, boosts } = status;
                const actualStatusID = reblog?.id || statusID;
                const url = instance
                  ? `/${instance}/s/${actualStatusID}`
                  : `/s/${actualStatusID}`;
                if (boosts) {
                  return (
                    <li key={`timeline-${statusID}`}>
                      <BoostsCarousel boosts={boosts} instance={instance} />
                    </li>
                  );
                }
                return (
                  <li key={`timeline-${statusID}`}>
                    <Link class="status-link" to={url}>
                      <Status status={status} instance={instance} />
                    </Link>
                  </li>
                );
              })}
            </ul>
            {uiState === 'default' &&
              (showMore ? (
                <button
                  type="button"
                  class="plain block"
                  onClick={() => loadItems()}
                  style={{ marginBlockEnd: '6em' }}
                >
                  Show more&hellip;
                </button>
              ) : (
                <p class="ui-state insignificant">The end.</p>
              ))}
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
          uiState !== 'error' && <p class="ui-state">{emptyText}</p>
        )}
        {uiState === 'error' && (
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
        )}
      </div>
    </div>
  );
}

function groupBoosts(values) {
  let newValues = [];
  let boostStash = [];
  let serialBoosts = 0;
  for (let i = 0; i < values.length; i++) {
    const item = values[i];
    if (item.reblog) {
      boostStash.push(item);
      serialBoosts++;
    } else {
      newValues.push(item);
      if (serialBoosts < 3) {
        serialBoosts = 0;
      }
    }
  }
  // if boostStash is more than quarter of values
  // or if there are 3 or more boosts in a row
  if (boostStash.length > values.length / 4 || serialBoosts >= 3) {
    // if boostStash is more than 3 quarter of values
    const boostStashID = boostStash.map((status) => status.id);
    if (boostStash.length > (values.length * 3) / 4) {
      // insert boost array at the end of specialHome list
      newValues = [...newValues, { id: boostStashID, boosts: boostStash }];
    } else {
      // insert boosts array in the middle of specialHome list
      const half = Math.floor(newValues.length / 2);
      newValues = [
        ...newValues.slice(0, half),
        {
          id: boostStashID,
          boosts: boostStash,
        },
        ...newValues.slice(half),
      ];
    }
    return newValues;
  } else {
    return values;
  }
}

function BoostsCarousel({ boosts, instance }) {
  const carouselRef = useRef();
  const { reachStart, reachEnd, init } = useScroll({
    scrollableElement: carouselRef.current,
    direction: 'horizontal',
  });
  useEffect(() => {
    init?.();
  }, []);

  return (
    <div class="boost-carousel">
      <header>
        <h3>{boosts.length} Boosts</h3>
        <span>
          <button
            type="button"
            class="small plain2"
            disabled={reachStart}
            onClick={() => {
              carouselRef.current?.scrollBy({
                left: -Math.min(320, carouselRef.current?.offsetWidth),
                behavior: 'smooth',
              });
            }}
          >
            <Icon icon="chevron-left" />
          </button>{' '}
          <button
            type="button"
            class="small plain2"
            disabled={reachEnd}
            onClick={() => {
              carouselRef.current?.scrollBy({
                left: Math.min(320, carouselRef.current?.offsetWidth),
                behavior: 'smooth',
              });
            }}
          >
            <Icon icon="chevron-right" />
          </button>
        </span>
      </header>
      <ul ref={carouselRef}>
        {boosts.map((boost) => {
          const { id: statusID, reblog } = boost;
          const actualStatusID = reblog?.id || statusID;
          const url = instance
            ? `/${instance}/s/${actualStatusID}`
            : `/s/${actualStatusID}`;
          return (
            <li key={statusID}>
              <Link class="status-boost-link" to={url}>
                <Status status={boost} instance={instance} size="s" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default Timeline;
