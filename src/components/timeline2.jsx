import './timeline2.css';

import { Trans, useLingui } from '@lingui/react/macro';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'preact/hooks';
import { useDebouncedCallback, useThrottledCallback } from 'use-debounce';

import { api } from '../utils/api';
import FilterContext from '../utils/filter-context';
import states, { saveStatus, statusKey } from '../utils/states';
import store from '../utils/store';
import {
  dedupeBoosts,
  filterHiddenStatuses,
  groupContext,
} from '../utils/timeline-utils';
import useInterval from '../utils/useInterval';
import usePageVisibility from '../utils/usePageVisibility';
import useScrollFn from '../utils/useScrollFn';

import Icon from './icon';
import Link from './link';
import Loader from './loader';
import NavMenu from './nav-menu';
import Status from './status';
import {
  TimelineItem,
  useJHotkeys,
  useKHotkeys,
  useOHotkeys,
} from './timeline';

// Batch size (Mastodon API limit is around 20-40)
const BATCH_SIZE = 20;
const TIMELINE_LIMIT = 50;
const CACHE_AGE = 1000 * 60 * 15; // 15 minutes

function getLastItem(items) {
  const item = items[items.length - 1];
  return item.items ? item.items[item.items.length - 1] : item;
}

function getFirstItem(items) {
  const item = items[0];
  return item.items ? item.items[0] : item;
}

function getScrollAnchor(scrollable) {
  if (!scrollable) return null;

  const containerRect = scrollable.getBoundingClientRect();
  const itemElements = scrollable.querySelectorAll('[data-state-post-id]');

  for (const el of itemElements) {
    const rect = el.getBoundingClientRect();
    // Check if item is visible in viewport (at least partially)
    if (
      rect.bottom > containerRect.top + 10 &&
      rect.top < containerRect.bottom - 10
    ) {
      const postID = el.dataset.statePostId?.split?.(' ');
      if (postID) {
        return {
          itemId: postID,
          offset: rect.top - containerRect.top,
        };
      }
    }
  }
  return null;
}

function Timeline2({
  title,
  titleComponent,
  id,
  instance,
  emptyText,
  errorText,
  useItemID,
  fetchItems = async () => {},
  checkForUpdates = async () => {},
  checkForUpdatesInterval = 15_000,
  headerStart,
  headerEnd,
  timelineStart,
  refresh,
  filterContext,
  showFollowedTags,
  showReplyParent,
  dedupeBoosts: shouldDedupeBoosts,
  // clearWhenRefresh,
}) {
  const { t } = useLingui();
  const { masto } = api({ instance });

  const cacheKey = `timeline2-${id}`;
  const cachedData = useRef(null);
  if (cachedData.current === null) {
    cachedData.current = store.account.get(cacheKey) || null;
  }
  const hasCachedData = !!cachedData.current?.items?.length;
  const cachedUpdatedAt = cachedData.current?.updatedAt;
  const cacheAge = cachedUpdatedAt ? Date.now() - cachedUpdatedAt : 0;

  const loadStateRef = useRef();
  const [uiState, setUIState] = useState(hasCachedData ? 'default' : 'start');
  const [showNewer, setShowNewer] = useState(
    (cachedData.current?.showNewer ?? false) || cacheAge > CACHE_AGE,
  );
  const [showOlder, setShowOlder] = useState(
    cachedData.current?.showOlder ?? true,
  );
  const [visible, setVisible] = useState(true);
  const scrollableRef = useRef();

  const firstLoad = useRef(true);
  const [items, setItems] = useState(() => {
    const cached = cachedData.current;
    console.log('🔍 Restore', {
      cached,
      itemsCount: cached?.items?.length,
    });
    const items = cached?.items;
    if (!items?.length) return [];
    // Populate statuses
    items.forEach((item) => {
      if (item.items) {
        item.items.forEach((subItem) => {
          saveStatus(subItem, instance, { sync: true });
        });
      } else {
        saveStatus(item, instance, { sync: true });
      }
    });
    return items;
  });

  // Hydrate cached statuses on mount and when page becomes visible
  const hydrateCache = useCallback(() => {
    const cached = cachedData.current;
    if (!cached?.items?.length) return;
    const cacheAge = cached.updatedAt
      ? Date.now() - cached.updatedAt
      : Infinity;
    if (cacheAge <= CACHE_AGE) return;

    const statusIds = [];
    cached.items.forEach((item) => {
      if (item.items) {
        item.items.forEach((subItem) => {
          statusIds.push(subItem.id);
        });
      } else {
        statusIds.push(item.id);
      }
    });

    if (statusIds.length === 0) return;

    const deletedStatuses = [];
    (async () => {
      try {
        // Process in batches
        for (let i = 0; i < statusIds.length; i += BATCH_SIZE) {
          const batchIds = statusIds.slice(i, i + BATCH_SIZE);
          try {
            const hydratedStatuses = await masto.v1.statuses.list({
              id: batchIds,
            });
            const returnedIds = new Set(
              hydratedStatuses?.map((s) => s.id) || [],
            );
            // Track deleted statuses (not in returnedIds)
            batchIds.forEach((id) => {
              if (!returnedIds.has(id)) {
                deletedStatuses.push(id);
              }
            });
            if (hydratedStatuses?.length) {
              hydratedStatuses.forEach((status) => {
                saveStatus(status, instance, { sync: true });
              });
            }
          } catch (e) {
            console.error('Failed to hydrate batch:', e);
          }
        }

        // Mark deleted statuses
        deletedStatuses.forEach((id) => {
          const key = statusKey(id, instance);
          if (states.statuses[key]) {
            states.statuses[key]._deleted = true;
          }
        });
        console.log('🔍 Hydrated', {
          statusIds,
          deletedStatuses,
        });
      } catch (e) {
        console.error('Failed to hydrate statuses:', e);
      }
    })();
  }, [instance, masto]);

  useEffect(() => {
    hydrateCache();
  }, []);

  usePageVisibility(
    (visible) => {
      if (visible) hydrateCache();
    },
    [hydrateCache],
  );

  const scrollAnchorRef = useRef(cachedData.current?.scrollAnchor || null);

  const saveScrollAnchor = useCallback(({ items, direction }) => {
    console.log('🔍 saveScrollAnchor', {
      direction,
      items,
    });
    if (!items?.length) return;
    if (!scrollableRef.current) return;
    const getItem = direction === 'next' ? getLastItem : getFirstItem;
    const item = getItem(items);
    const postID = statusKey(item?.id, instance);
    const targetElement = scrollableRef.current.querySelector(
      `[data-state-post-id~="${postID}"]`,
    );
    console.log('🔍 saveScrollAnchor 2', {
      postID,
      targetElement,
      direction,
      items,
    });
    if (targetElement) {
      const containerRect = scrollableRef.current.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();
      scrollAnchorRef.current = {
        itemId: postID,
        offset: targetRect.top - containerRect.top,
        direction,
      };
    } else {
      console.warn('🔍 Target element not found', {
        postID,
        targetElement,
        direction,
        items,
      });
    }
  }, []);

  console.debug('RENDER Timeline2', id, refresh);
  __BENCHMARK.start(`timeline-${id}-load`);

  const minID = useRef(cachedData.current?.minID || null);
  const maxID = useRef(cachedData.current?.maxID || null);

  const loadItems = useDebouncedCallback(
    (params = {}) => {
      console.log('🔍 loadItems', { params });
      const { max_id, min_id } = params;
      const loadState =
        !max_id && !min_id ? 'start' : max_id ? 'next' : min_id ? 'prev' : null;
      loadStateRef.current = loadState;
      setUIState('loading');
      (async () => {
        try {
          let result = await fetchItems(params);

          const { max_id, min_id } = params;
          let { value, originalValue, done } = result;
          const hasOlder = !done;
          const minIDValue = originalValue[0]?.id;
          const maxIDValue = originalValue[originalValue.length - 1]?.id;
          console.log('🔍 loadItems result', result);

          if (value?.length) {
            if (shouldDedupeBoosts) {
              value = dedupeBoosts(value, instance);
            }
            value = filterHiddenStatuses(value, filterContext);
            value = groupContext(value, instance);

            if (loadState === 'start') {
              minID.current = minIDValue;
              maxID.current = maxIDValue;
              setItems(value);
              setShowOlder(hasOlder);
              setShowNewer(false);
            } else if (loadState === 'next') {
              maxID.current = maxIDValue;
              scrollableRef.current.classList.add('scrolling-next');
              setItems((prevItems) => {
                saveScrollAnchor({ items: prevItems, direction: 'next' });
                const newItems = [...prevItems, ...value].slice(
                  -TIMELINE_LIMIT,
                );
                minID.current = [newItems[0].id].flat()[0];
                return newItems;
              });
              setShowOlder(hasOlder);
              setShowNewer(true);
            } else if (loadState === 'prev') {
              minID.current = minIDValue;
              scrollableRef.current.classList.add('scrolling-prev');
              setItems((prevItems) => {
                saveScrollAnchor({ items: prevItems, direction: 'prev' });
                const newItems = [...value, ...prevItems].slice(
                  0,
                  TIMELINE_LIMIT,
                );
                maxID.current = [newItems.at(-1).id].flat().at(-1);
                return newItems;
              });
              setShowOlder(true);
              // If prevItems > batch size, show newer
              setShowNewer(originalValue.length >= BATCH_SIZE);
            }
          } else {
            // No items
            if (max_id) {
              setShowOlder(false);
            }
            if (min_id) {
              setShowNewer(false);
            }
          }
          setUIState('default');
          __BENCHMARK.end(`timeline-${id}-load`);
        } catch (e) {
          console.error(e);
          setUIState('error');
        } finally {
          loadItems.cancel();
        }
      })();
    },
    300,
    { leading: true },
  );

  const jRef = useJHotkeys(scrollableRef);
  const kRef = useKHotkeys(scrollableRef);
  const oRef = useOHotkeys();

  const headerRef = useRef();

  // Cache items whenever they change
  useEffect(() => {
    if (firstLoad.current) return;
    if (items.length > 0) {
      console.log('🔍 Cache items', { items });
      const existing = store.account.get(cacheKey) || {};
      store.account.set(cacheKey, {
        ...existing,
        items,
        minID: minID.current,
        maxID: maxID.current,
        showNewer,
        showOlder,
        updatedAt: Date.now(),
      });
    } else {
      store.account.del(cacheKey);
    }
  }, [items, cacheKey, showNewer, showOlder]);

  // Throttled scroll handler to cache scroll position
  const cacheScrollAnchor = useThrottledCallback(() => {
    if (!scrollableRef.current || items.length === 0) return;

    const scrollAnchor = getScrollAnchor(scrollableRef.current);
    if (scrollAnchor) {
      const cached = store.account.get(cacheKey) || {};
      store.account.set(cacheKey, {
        ...cached,
        scrollAnchor,
      });
    }
  }, 500);

  const scrollFnCallback = useCallback(
    ({ scrollDirection, nearReachStart }) => {
      if (headerRef.current) {
        console.log('🔍 scrollFnCallback', {
          scrollDirection,
          nearReachStart,
        });
        headerRef.current.hidden = scrollDirection === 'end' && !nearReachStart;
      }
      // Cache scroll position on scroll
      cacheScrollAnchor();
    },
    [cacheScrollAnchor],
  );
  const { resetScrollDirection } = useScrollFn(
    {
      scrollableRef,
      distanceFromEnd: 2,
      scrollThresholdStart: 44,
    },
    scrollFnCallback,
  );

  // Restore from cache or load fresh items on mount
  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      // If not restored from cache, load fresh items
      if (!cachedData.current?.items?.length) {
        loadItems();
      } else {
        // If from cache, check for updates
        checkUpdates();
      }
    }
  }, [loadItems]);

  // useEffect(() => {
  //   if (firstLoad.current) return;
  //   if (clearWhenRefresh && items?.length) {
  //     loadItems.cancel?.();
  //     setItems([]);
  //   }
  //   loadItems();
  // }, [clearWhenRefresh, refresh]);

  const checkUpdates = useCallback(async () => {
    if (!minID.current) return;
    const hasUpdates = await checkForUpdates({
      minID: minID.current,
    });
    setShowNewer(hasUpdates);
  }, [checkForUpdates]);

  const lastHiddenTime = useRef();
  usePageVisibility(
    (visible) => {
      if (firstLoad.current) return;
      if (visible) {
        const timeDiff = Date.now() - lastHiddenTime.current;
        if (!lastHiddenTime.current || timeDiff > 1000 * 3) {
          checkUpdates();
        }
      } else {
        lastHiddenTime.current = Date.now();
      }
      setVisible(visible);
    },
    [checkUpdates],
  );

  useInterval(
    checkUpdates,
    visible && !showNewer ? checkForUpdatesInterval : null,
  );

  useLayoutEffect(() => {
    if (uiState !== 'default') return;
    console.log('🔍 Scroll', {
      scrollableRef: scrollableRef.current,
      scrollAnchorRef: scrollAnchorRef.current,
    });
    if (!scrollableRef.current || !scrollAnchorRef.current) return;

    // Clear the anchor immediately to prevent re-entrant executions
    const anchor = scrollAnchorRef.current;
    scrollAnchorRef.current = null;

    const { itemId, offset, direction } = anchor;
    const targetElement = scrollableRef.current.querySelector(
      `[data-state-post-id~="${itemId}"]`,
    );
    console.log('🔍 Scroll to?', { itemId, offset, targetElement });

    if (targetElement) {
      const containerRect = scrollableRef.current.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();
      const currentOffset = targetRect.top - containerRect.top;
      const delta = currentOffset - offset;
      console.log('Scrolling to', {
        itemId,
        offset,
        containerRect,
        targetRect,
        currentOffset,
        delta,
      });
      // Only scroll if the delta is meaningful to avoid triggering unnecessary scroll events
      if (Math.abs(delta) > 1) {
        scrollableRef.current.scrollTop += delta;
      }
      setTimeout(() => {
        scrollableRef.current?.classList.remove(`scrolling-${direction}`);
      }, 300);
    } else {
      console.warn('Target element not found', {
        itemId,
        offset,
        targetElement,
      });
    }
  }, [items, uiState]);

  return (
    <FilterContext.Provider value={filterContext}>
      <div
        id={`${id}-page`}
        class="deck-container timeline-2-container"
        ref={(node) => {
          scrollableRef.current = node;
          jRef.current = node;
          kRef.current = node;
          oRef.current = node;
        }}
        tabIndex="-1"
        onClick={(e) => {
          if (
            headerRef.current &&
            e.target.closest('.timeline-item, .timeline-item-alt')
          ) {
            setTimeout(() => {
              headerRef.current.hidden = false;
              resetScrollDirection();
            }, 250);
          }
        }}
      >
        <div class="timeline-deck deck">
          <header
            ref={headerRef}
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
                loadItems();
              }
            }}
            // class={uiState === 'loading' ? 'loading' : ''}
          >
            <div class="header-grid">
              <div class="header-side">
                <NavMenu />
                {headerStart !== null && headerStart !== undefined ? (
                  headerStart
                ) : (
                  <Link to="/" class="button plain home-button">
                    <Icon icon="home" size="l" alt={t`Home`} />
                  </Link>
                )}
              </div>
              {title && (titleComponent ? titleComponent : <h1>{title}</h1>)}
              <div class="header-side">{!!headerEnd && headerEnd}</div>
            </div>
          </header>
          {!!timelineStart && (
            <div
              class={`timeline-start ${uiState === 'loading' ? 'loading' : ''}`}
            >
              {timelineStart}
            </div>
          )}
          {!!items.length ? (
            <>
              {showNewer && (
                <div
                  class={`timeline-pagination timeline-pagination-top ${firstLoad.current ? '' : 'transitioning'}`}
                >
                  <button
                    type="button"
                    data-pagination-trigger="latest"
                    class={`plain4 ${uiState === 'loading' && loadStateRef.current === 'start' ? 'block' : ''}`}
                    onClick={() => {
                      // Load from top (latest)
                      loadItems();
                    }}
                    disabled={uiState === 'loading'}
                  >
                    {uiState === 'loading' &&
                    loadStateRef.current === 'start' ? (
                      <Loader abrupt />
                    ) : (
                      <Icon icon="arrow-up-top" size="l" />
                    )}
                  </button>
                  <button
                    type="button"
                    data-pagination-trigger="prev"
                    class={`plain4 ${uiState === 'loading' && loadStateRef.current === 'start' ? '' : 'block'}`}
                    onClick={() => {
                      loadItems({ min_id: minID.current });
                    }}
                    disabled={uiState === 'loading'}
                  >
                    {uiState === 'loading' &&
                    loadStateRef.current === 'prev' ? (
                      <Loader abrupt />
                    ) : (
                      <Icon icon="arrow-up" size="l" />
                    )}
                  </button>
                </div>
              )}
              <ul class="timeline">
                {items.map((status) => (
                  <TimelineItem
                    status={status}
                    instance={instance}
                    useItemID={useItemID}
                    filterContext={filterContext}
                    key={status.id}
                    showFollowedTags={showFollowedTags}
                    showReplyParent={showReplyParent}
                  />
                ))}
                {/* {uiState === 'loading' && (
                  <>
                    <li style={{ height: '20vh' }}>
                      <Status skeleton />
                    </li>
                    <li style={{ height: '25vh' }}>
                      <Status skeleton />
                    </li>
                  </>
                )} */}
              </ul>
              {showOlder ? (
                <div class="timeline-pagination timeline-pagination-bottom">
                  <button
                    type="button"
                    class="plain4 block"
                    data-pagination-trigger="next"
                    onClick={() => {
                      loadItems({ max_id: maxID.current });
                    }}
                    disabled={uiState === 'loading'}
                  >
                    {uiState === 'loading' ? (
                      <Loader abrupt />
                    ) : (
                      <Icon icon="arrow-down" size="l" />
                    )}
                  </button>
                </div>
              ) : uiState !== 'loading' ? (
                <p class="ui-state insignificant">
                  <Trans>The end.</Trans>
                </p>
              ) : null}
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
            uiState !== 'error' &&
            uiState !== 'start' && <p class="ui-state">{emptyText}</p>
          )}
          {uiState === 'error' && (
            <p class="ui-state">
              {errorText}
              <br />
              <br />
              <button type="button" onClick={() => loadItems()}>
                <Trans>Try again</Trans>
              </button>
            </p>
          )}
        </div>
      </div>
    </FilterContext.Provider>
  );
}

export default Timeline2;
