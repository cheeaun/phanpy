import { useEffect, useRef, useState } from 'preact/hooks';
import { useHotkeys } from 'react-hotkeys-hook';
import { InView } from 'react-intersection-observer';
import { useDebouncedCallback } from 'use-debounce';

import useInterval from '../utils/useInterval';
import usePageVisibility from '../utils/usePageVisibility';
import useScroll from '../utils/useScroll';

import Icon from './icon';
import Link from './link';
import Loader from './loader';
import Menu from './menu';
import Status from './status';

function Timeline({
  title,
  titleComponent,
  id,
  instance,
  emptyText,
  errorText,
  useItemID, // use statusID instead of status object, assuming it's already in states
  boostsCarousel,
  fetchItems = () => {},
  checkForUpdates = () => {},
  checkForUpdatesInterval = 60_000, // 1 minute
  headerStart,
  headerEnd,
  timelineStart,
  allowFilters,
}) {
  const [items, setItems] = useState([]);
  const [uiState, setUIState] = useState('default');
  const [showMore, setShowMore] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [visible, setVisible] = useState(true);
  const scrollableRef = useRef();

  const loadItems = useDebouncedCallback(
    (firstLoad) => {
      setShowNew(false);
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
              setItems((items) => [...items, ...value]);
            }
            setShowMore(!done);
          } else {
            setShowMore(false);
          }
          setUIState('default');
        } catch (e) {
          console.error(e);
          setUIState('error');
        } finally {
          loadItems.cancel();
        }
      })();
    },
    1500,
    {
      leading: true,
      trailing: false,
    },
  );

  const itemsSelector = '.timeline-item, .timeline-item-alt';

  const jRef = useHotkeys('j, shift+j', (_, handler) => {
    // focus on next status after active item
    const activeItem = document.activeElement.closest(itemsSelector);
    const activeItemRect = activeItem?.getBoundingClientRect();
    const allItems = Array.from(
      scrollableRef.current.querySelectorAll(itemsSelector),
    );
    if (
      activeItem &&
      activeItemRect.top < scrollableRef.current.clientHeight &&
      activeItemRect.bottom > 0
    ) {
      const activeItemIndex = allItems.indexOf(activeItem);
      let nextItem = allItems[activeItemIndex + 1];
      if (handler.shift) {
        // get next status that's not .timeline-item-alt
        nextItem = allItems.find(
          (item, index) =>
            index > activeItemIndex &&
            !item.classList.contains('timeline-item-alt'),
        );
      }
      if (nextItem) {
        nextItem.focus();
        nextItem.scrollIntoViewIfNeeded?.();
      }
    } else {
      // If active status is not in viewport, get the topmost status-link in viewport
      const topmostItem = allItems.find((item) => {
        const itemRect = item.getBoundingClientRect();
        return itemRect.top >= 44 && itemRect.left >= 0; // 44 is the magic number for header height, not real
      });
      if (topmostItem) {
        topmostItem.focus();
        topmostItem.scrollIntoViewIfNeeded?.();
      }
    }
  });

  const kRef = useHotkeys('k, shift+k', (_, handler) => {
    // focus on previous status after active item
    const activeItem = document.activeElement.closest(itemsSelector);
    const activeItemRect = activeItem?.getBoundingClientRect();
    const allItems = Array.from(
      scrollableRef.current.querySelectorAll(itemsSelector),
    );
    if (
      activeItem &&
      activeItemRect.top < scrollableRef.current.clientHeight &&
      activeItemRect.bottom > 0
    ) {
      const activeItemIndex = allItems.indexOf(activeItem);
      let prevItem = allItems[activeItemIndex - 1];
      if (handler.shift) {
        // get prev status that's not .timeline-item-alt
        prevItem = allItems.findLast(
          (item, index) =>
            index < activeItemIndex &&
            !item.classList.contains('timeline-item-alt'),
        );
      }
      if (prevItem) {
        prevItem.focus();
        prevItem.scrollIntoViewIfNeeded?.();
      }
    } else {
      // If active status is not in viewport, get the topmost status-link in viewport
      const topmostItem = allItems.find((item) => {
        const itemRect = item.getBoundingClientRect();
        return itemRect.top >= 44 && itemRect.left >= 0; // 44 is the magic number for header height, not real
      });
      if (topmostItem) {
        topmostItem.focus();
        topmostItem.scrollIntoViewIfNeeded?.();
      }
    }
  });

  const oRef = useHotkeys(['enter', 'o'], () => {
    // open active status
    const activeItem = document.activeElement.closest(itemsSelector);
    if (activeItem) {
      activeItem.click();
    }
  });

  const {
    scrollDirection,
    nearReachStart,
    nearReachEnd,
    reachStart,
    reachEnd,
  } = useScroll({
    scrollableRef,
    distanceFromEnd: 2,
    scrollThresholdStart: 44,
  });

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

  const lastHiddenTime = useRef();
  usePageVisibility((visible) => {
    if (visible) {
      const timeDiff = Date.now() - lastHiddenTime.current;
      if (!lastHiddenTime.current || timeDiff > 1000 * 60) {
        (async () => {
          console.log('✨ Check updates');
          const hasUpdate = await checkForUpdates();
          if (hasUpdate) {
            console.log('✨ Has new updates');
            setShowNew(true);
          }
        })();
      }
    } else {
      lastHiddenTime.current = Date.now();
    }
    setVisible(visible);
  }, []);

  // checkForUpdates interval
  useInterval(
    () => {
      (async () => {
        console.log('✨ Check updates');
        const hasUpdate = await checkForUpdates();
        if (hasUpdate) {
          console.log('✨ Has new updates');
          setShowNew(true);
        }
      })();
    },
    visible && !showNew ? checkForUpdatesInterval : null,
  );

  const hiddenUI = scrollDirection === 'end' && !nearReachStart;

  return (
    <div
      id={`${id}-page`}
      class="deck-container"
      ref={(node) => {
        scrollableRef.current = node;
        jRef.current = node;
        kRef.current = node;
        oRef.current = node;
      }}
      tabIndex="-1"
    >
      <div class="timeline-deck deck">
        <header
          hidden={hiddenUI}
          onClick={(e) => {
            if (!e.target.closest('a, button')) {
              scrollableRef.current?.scrollTo({
                top: 0,
                behavior: 'smooth',
              });
            }
          }}
          onDblClick={(e) => {
            if (!e.target.closest('a, button')) {
              loadItems(true);
            }
          }}
        >
          <div class="header-grid">
            <div class="header-side">
              <Menu />
              {headerStart !== null && headerStart !== undefined ? (
                headerStart
              ) : (
                <Link to="/" class="button plain home-button">
                  <Icon icon="home" size="l" />
                </Link>
              )}
            </div>
            {title && (titleComponent ? titleComponent : <h1>{title}</h1>)}
            <div class="header-side">
              <Loader hidden={uiState !== 'loading'} />
              {!!headerEnd && headerEnd}
            </div>
          </div>
          {items.length > 0 &&
            uiState !== 'loading' &&
            !hiddenUI &&
            showNew && (
              <button
                class="updates-button shiny-pill"
                type="button"
                onClick={() => {
                  loadItems(true);
                  scrollableRef.current?.scrollTo({
                    top: 0,
                    behavior: 'smooth',
                  });
                }}
              >
                <Icon icon="arrow-up" /> New posts
              </button>
            )}
        </header>
        {!!timelineStart && <div class="timeline-start">{timelineStart}</div>}
        {!!items.length ? (
          <>
            <ul class="timeline">
              {items.map((status) => {
                const { id: statusID, reblog, items, type, _pinned } = status;
                const actualStatusID = reblog?.id || statusID;
                const url = instance
                  ? `/${instance}/s/${actualStatusID}`
                  : `/s/${actualStatusID}`;
                let title = '';
                if (type === 'boosts') {
                  title = `${items.length} Boosts`;
                } else if (type === 'pinned') {
                  title = 'Pinned posts';
                }
                if (items) {
                  // Here, we don't hide filtered posts, but we sort them last
                  items.sort((a, b) => {
                    if (a._filtered && !b._filtered) {
                      return 1;
                    }
                    if (!a._filtered && b._filtered) {
                      return -1;
                    }
                    return 0;
                  });
                  return (
                    <li key={`timeline-${statusID}`}>
                      <StatusCarousel title={title} class={`${type}-carousel`}>
                        {items.map((item) => {
                          const { id: statusID, reblog } = item;
                          const actualStatusID = reblog?.id || statusID;
                          const url = instance
                            ? `/${instance}/s/${actualStatusID}`
                            : `/s/${actualStatusID}`;
                          return (
                            <li key={statusID}>
                              <Link
                                class="status-carousel-link timeline-item-alt"
                                to={url}
                              >
                                {useItemID ? (
                                  <Status
                                    statusID={statusID}
                                    instance={instance}
                                    size="s"
                                    contentTextWeight
                                  />
                                ) : (
                                  <Status
                                    status={item}
                                    instance={instance}
                                    size="s"
                                    contentTextWeight
                                  />
                                )}
                              </Link>
                            </li>
                          );
                        })}
                      </StatusCarousel>
                    </li>
                  );
                }
                return (
                  <li key={`timeline-${statusID + _pinned}`}>
                    <Link class="status-link timeline-item" to={url}>
                      {useItemID ? (
                        <Status
                          statusID={statusID}
                          instance={instance}
                          allowFilters
                        />
                      ) : (
                        <Status
                          status={status}
                          instance={instance}
                          allowFilters
                        />
                      )}
                    </Link>
                  </li>
                );
              })}
              {showMore && uiState === 'loading' && (
                <>
                  <li
                    style={{
                      height: '20vh',
                    }}
                  >
                    <Status skeleton />
                  </li>
                  <li
                    style={{
                      height: '25vh',
                    }}
                  >
                    <Status skeleton />
                  </li>
                </>
              )}
            </ul>
            {uiState === 'default' &&
              (showMore ? (
                <InView
                  onChange={(inView) => {
                    if (inView) {
                      loadItems();
                    }
                  }}
                >
                  <button
                    type="button"
                    class="plain block"
                    onClick={() => loadItems()}
                    style={{ marginBlockEnd: '6em' }}
                  >
                    Show more&hellip;
                  </button>
                </InView>
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
      newValues = [
        ...newValues,
        { id: boostStashID, items: boostStash, type: 'boosts' },
      ];
    } else {
      // insert boosts array in the middle of specialHome list
      const half = Math.floor(newValues.length / 2);
      newValues = [
        ...newValues.slice(0, half),
        {
          id: boostStashID,
          items: boostStash,
          type: 'boosts',
        },
        ...newValues.slice(half),
      ];
    }
    return newValues;
  } else {
    return values;
  }
}

function StatusCarousel({ title, class: className, children }) {
  const carouselRef = useRef();
  const { reachStart, reachEnd, init } = useScroll({
    scrollableRef: carouselRef,
    direction: 'horizontal',
  });
  useEffect(() => {
    init?.();
  }, []);

  return (
    <div class={`status-carousel ${className}`}>
      <header>
        <h3>{title}</h3>
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
      <ul ref={carouselRef}>{children}</ul>
    </div>
  );
}

export default Timeline;
