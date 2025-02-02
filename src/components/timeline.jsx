import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { memo } from 'preact/compat';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import { useHotkeys } from 'react-hotkeys-hook';
import { InView } from 'react-intersection-observer';
import { useDebouncedCallback } from 'use-debounce';
import { useSnapshot } from 'valtio';

import FilterContext from '../utils/filter-context';
import { filteredItems, isFiltered } from '../utils/filters';
import isRTL from '../utils/is-rtl';
import showToast from '../utils/show-toast';
import states, { statusKey } from '../utils/states';
import statusPeek from '../utils/status-peek';
import { isMediaFirstInstance } from '../utils/store-utils';
import { groupBoosts, groupContext } from '../utils/timeline-utils';
import useInterval from '../utils/useInterval';
import usePageVisibility from '../utils/usePageVisibility';
import useScroll from '../utils/useScroll';
import useScrollFn from '../utils/useScrollFn';

import Icon from './icon';
import Link from './link';
import MediaPost from './media-post';
import NavMenu from './nav-menu';
import Status from './status';

const scrollIntoViewOptions = {
  block: 'start',
  inline: 'center',
  behavior: 'smooth',
};

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
  checkForUpdatesInterval = 15_000, // 15 seconds
  headerStart,
  headerEnd,
  timelineStart,
  // allowFilters,
  refresh,
  view,
  filterContext,
  showFollowedTags,
  showReplyParent,
  clearWhenRefresh,
}) {
  const { t } = useLingui();
  const snapStates = useSnapshot(states);
  const [items, setItems] = useState([]);
  const [uiState, setUIState] = useState('start');
  const [showMore, setShowMore] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [visible, setVisible] = useState(true);
  const scrollableRef = useRef();

  console.debug('RENDER Timeline', id, refresh);
  __BENCHMARK.start(`timeline-${id}-load`);

  const mediaFirst = useMemo(() => isMediaFirstInstance(), []);

  const allowGrouping = view !== 'media';
  const loadItemsTS = useRef(0); // Ensures only one loadItems at a time
  const loadItems = useDebouncedCallback(
    (firstLoad) => {
      setShowNew(false);
      // if (uiState === 'loading') return;
      setUIState('loading');
      (async () => {
        try {
          const ts = (loadItemsTS.current = Date.now());
          let { done, value } = await fetchItems(firstLoad);
          if (ts !== loadItemsTS.current) return;
          if (Array.isArray(value)) {
            // Avoid grouping for pinned posts
            const [pinnedPosts, otherPosts] = value.reduce(
              (acc, item) => {
                if (item._pinned) {
                  acc[0].push(item);
                } else {
                  acc[1].push(item);
                }
                return acc;
              },
              [[], []],
            );
            value = otherPosts;
            if (allowGrouping) {
              if (boostsCarousel) {
                value = groupBoosts(value);
              }
              value = groupContext(value, instance);
            }
            if (pinnedPosts.length) {
              value = pinnedPosts.concat(value);
            }
            console.log(value);
            if (firstLoad) {
              setItems(value);
            } else {
              setItems((items) => [...items, ...value]);
            }
            if (!value.length) done = true;
            setShowMore(!done);
          } else {
            setShowMore(false);
          }
          setUIState('default');
          __BENCHMARK.end(`timeline-${id}-load`);
        } catch (e) {
          console.error(e);
          setUIState('error');
          if (firstLoad && !items.length && errorText) {
            showToast(errorText);
          }
        } finally {
          loadItems.cancel();
        }
      })();
    },
    1_000,
    {
      leading: true,
      // trailing: false,
    },
  );

  const itemsSelector = '.timeline-item, .timeline-item-alt';

  const jRef = useHotkeys('j, shift+j', (_, handler) => {
    // focus on next status after active item
    const activeItem = document.activeElement.closest(itemsSelector);
    const activeItemRect = activeItem?.getBoundingClientRect();
    const allItems = Array.from(
      scrollableRef.current.querySelectorAll(itemsSelector),
    ).filter((item) => !!item.offsetHeight);
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
        nextItem.scrollIntoView(scrollIntoViewOptions);
      }
    } else {
      // If active status is not in viewport, get the topmost status-link in viewport
      const topmostItem = allItems.find((item) => {
        const itemRect = item.getBoundingClientRect();
        return itemRect.top >= 44 && itemRect.left >= 0; // 44 is the magic number for header height, not real
      });
      if (topmostItem) {
        topmostItem.focus();
        topmostItem.scrollIntoView(scrollIntoViewOptions);
      }
    }
  });

  const kRef = useHotkeys('k, shift+k', (_, handler) => {
    // focus on previous status after active item
    const activeItem = document.activeElement.closest(itemsSelector);
    const activeItemRect = activeItem?.getBoundingClientRect();
    const allItems = Array.from(
      scrollableRef.current.querySelectorAll(itemsSelector),
    ).filter((item) => !!item.offsetHeight);
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
        prevItem.scrollIntoView(scrollIntoViewOptions);
      }
    } else {
      // If active status is not in viewport, get the topmost status-link in viewport
      const topmostItem = allItems.find((item) => {
        const itemRect = item.getBoundingClientRect();
        return itemRect.top >= 44 && itemRect.left >= 0; // 44 is the magic number for header height, not real
      });
      if (topmostItem) {
        topmostItem.focus();
        topmostItem.scrollIntoView(scrollIntoViewOptions);
      }
    }
  });

  const oRef = useHotkeys(['enter', 'o'], () => {
    // open active status
    const activeItem = document.activeElement;
    if (activeItem?.matches(itemsSelector)) {
      activeItem.click();
    }
  });

  const showNewPostsIndicator =
    items.length > 0 && uiState !== 'loading' && showNew;
  const handleLoadNewPosts = useCallback(() => {
    if (showNewPostsIndicator) loadItems(true);
    scrollableRef.current?.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }, [loadItems, showNewPostsIndicator]);
  const dotRef = useHotkeys('.', handleLoadNewPosts);

  // const {
  //   scrollDirection,
  //   nearReachStart,
  //   nearReachEnd,
  //   reachStart,
  //   reachEnd,
  // } = useScroll({
  //   scrollableRef,
  //   distanceFromEnd: 2,
  //   scrollThresholdStart: 44,
  // });
  const headerRef = useRef();
  // const [hiddenUI, setHiddenUI] = useState(false);
  const [nearReachStart, setNearReachStart] = useState(false);
  useScrollFn(
    {
      scrollableRef,
      distanceFromEnd: 2,
      scrollThresholdStart: 44,
    },
    ({
      scrollDirection,
      nearReachStart,
      // nearReachEnd,
      reachStart,
      // reachEnd,
    }) => {
      // setHiddenUI(scrollDirection === 'end' && !nearReachEnd);
      if (headerRef.current) {
        const hiddenUI = scrollDirection === 'end' && !nearReachStart;
        headerRef.current.hidden = hiddenUI;
      }
      setNearReachStart(nearReachStart);
      if (reachStart) {
        loadItems(true);
      }
      // else if (nearReachEnd || (reachEnd && showMore)) {
      //   loadItems();
      // }
    },
    [],
  );

  useEffect(() => {
    scrollableRef.current?.scrollTo({ top: 0 });
    loadItems(true);
  }, []);
  const firstLoad = useRef(true);
  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    if (clearWhenRefresh && items?.length) {
      loadItems.cancel?.();
      setItems([]);
    }
    loadItems(true);
  }, [clearWhenRefresh, refresh]);

  // useEffect(() => {
  //   if (reachStart) {
  //     loadItems(true);
  //   }
  // }, [reachStart]);

  // useEffect(() => {
  //   if (nearReachEnd || (reachEnd && showMore)) {
  //     loadItems();
  //   }
  // }, [nearReachEnd, showMore]);

  const prevView = useRef(view);
  useEffect(() => {
    if (prevView.current !== view) {
      prevView.current = view;
      setItems([]);
    }
  }, [view]);

  const loadOrCheckUpdates = useCallback(
    async ({ disableIdleCheck = false } = {}) => {
      const noPointers = scrollableRef.current
        ? getComputedStyle(scrollableRef.current).pointerEvents === 'none'
        : false;
      console.log('✨ Load or check updates', id, {
        autoRefresh: snapStates.settings.autoRefresh,
        scrollTop: scrollableRef.current.scrollTop,
        disableIdleCheck,
        idle: window.__IDLE__,
        inBackground: inBackground(),
        noPointers,
      });
      if (
        snapStates.settings.autoRefresh &&
        scrollableRef.current.scrollTop < 16 &&
        (disableIdleCheck || window.__IDLE__) &&
        !inBackground() &&
        !noPointers
      ) {
        console.log('✨ Load updates', id, snapStates.settings.autoRefresh);
        loadItems(true);
      } else {
        console.log('✨ Check updates', id, snapStates.settings.autoRefresh);
        const hasUpdate = await checkForUpdates();
        if (hasUpdate) {
          console.log('✨ Has new updates', id);
          setShowNew(true);
        }
      }
    },
    [id, loadItems, checkForUpdates, snapStates.settings.autoRefresh],
  );

  const lastHiddenTime = useRef();
  usePageVisibility(
    (visible) => {
      if (visible) {
        const timeDiff = Date.now() - lastHiddenTime.current;
        if (!lastHiddenTime.current || timeDiff > 1000 * 3) {
          // 3 seconds
          loadOrCheckUpdates({
            disableIdleCheck: true,
          });
        }
      } else {
        lastHiddenTime.current = Date.now();
      }
      setVisible(visible);
    },
    [checkForUpdates, loadOrCheckUpdates, snapStates.settings.autoRefresh],
  );

  // checkForUpdates interval
  useInterval(
    loadOrCheckUpdates,
    visible && !showNew
      ? checkForUpdatesInterval * (nearReachStart ? 1 : 2)
      : null,
  );

  // const hiddenUI = scrollDirection === 'end' && !nearReachStart;

  return (
    <FilterContext.Provider value={filterContext}>
      <div
        id={`${id}-page`}
        class={`deck-container ${
          mediaFirst ? 'deck-container-media-first' : ''
        }`}
        ref={(node) => {
          scrollableRef.current = node;
          jRef(node);
          kRef(node);
          oRef(node);
          dotRef(node);
        }}
        tabIndex="-1"
        onClick={(e) => {
          // If click on timeline item, unhide header
          if (
            headerRef.current &&
            e.target.closest('.timeline-item, .timeline-item-alt')
          ) {
            setTimeout(() => {
              headerRef.current.hidden = false;
            }, 250);
          }
        }}
      >
        <div class="timeline-deck deck">
          <header
            ref={headerRef}
            // hidden={hiddenUI}
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
            class={uiState === 'loading' ? 'loading' : ''}
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
              <div class="header-side">
                {/* <Loader hidden={uiState !== 'loading'} /> */}
                {!!headerEnd && headerEnd}
              </div>
            </div>
            {showNewPostsIndicator && (
              <button
                class="updates-button shiny-pill"
                type="button"
                onClick={handleLoadNewPosts}
              >
                <Icon icon="arrow-up" /> <Trans>New posts</Trans>
              </button>
            )}
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
              <ul class={`timeline ${view ? `timeline-${view}` : ''}`}>
                {items.map((status) => (
                  <TimelineItem
                    status={status}
                    instance={instance}
                    useItemID={useItemID}
                    // allowFilters={allowFilters}
                    filterContext={filterContext}
                    key={status.id + status?._pinned + view}
                    view={view}
                    showFollowedTags={showFollowedTags}
                    showReplyParent={showReplyParent}
                    mediaFirst={mediaFirst}
                  />
                ))}
                {showMore &&
                  uiState === 'loading' &&
                  (view === 'media' ? null : (
                    <>
                      <li
                        style={{
                          height: '20vh',
                        }}
                      >
                        <Status skeleton mediaFirst={mediaFirst} />
                      </li>
                      <li
                        style={{
                          height: '25vh',
                        }}
                      >
                        <Status skeleton mediaFirst={mediaFirst} />
                      </li>
                    </>
                  ))}
              </ul>
              {uiState === 'default' &&
                (showMore ? (
                  <InView
                    root={scrollableRef.current}
                    rootMargin={`0px 0px ${screen.height * 1.5}px 0px`}
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
                      <Trans>Show more…</Trans>
                    </button>
                  </InView>
                ) : (
                  <p class="ui-state insignificant">
                    <Trans>The end.</Trans>
                  </p>
                ))}
            </>
          ) : uiState === 'loading' ? (
            <ul class="timeline">
              {Array.from({ length: 5 }).map((_, i) =>
                view === 'media' ? (
                  <div
                    style={{
                      height: '50vh',
                    }}
                  />
                ) : (
                  <li key={i}>
                    <Status skeleton mediaFirst={mediaFirst} />
                  </li>
                ),
              )}
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
              <button type="button" onClick={() => loadItems(!items.length)}>
                <Trans>Try again</Trans>
              </button>
            </p>
          )}
        </div>
      </div>
    </FilterContext.Provider>
  );
}

const TimelineItem = memo(
  ({
    status,
    instance,
    useItemID,
    // allowFilters,
    filterContext,
    view,
    showFollowedTags,
    showReplyParent,
    mediaFirst,
  }) => {
    const { t } = useLingui();
    console.debug('RENDER TimelineItem', status.id);
    const { id: statusID, reblog, items, type, _pinned } = status;
    if (_pinned) useItemID = false;
    const actualStatusID = reblog?.id || statusID;
    const url = instance
      ? `/${instance}/s/${actualStatusID}`
      : `/s/${actualStatusID}`;

    if (items) {
      let fItems = filteredItems(items, filterContext);
      let title = '';
      if (type === 'boosts') {
        title = plural(fItems.length, {
          one: '# Boost',
          other: '# Boosts',
        });
      } else if (type === 'pinned') {
        title = t`Pinned posts`;
      }
      const isCarousel = type === 'boosts' || type === 'pinned';
      if (isCarousel) {
        const filteredItemsIDs = new Set();
        // Here, we don't hide filtered posts, but we sort them last
        fItems.sort((a, b) => {
          // if (a._filtered && !b._filtered) {
          //   return 1;
          // }
          // if (!a._filtered && b._filtered) {
          //   return -1;
          // }
          const aFiltered = isFiltered(a.filtered, filterContext);
          const bFiltered = isFiltered(b.filtered, filterContext);
          if (aFiltered) filteredItemsIDs.add(a.id);
          if (bFiltered) filteredItemsIDs.add(b.id);
          if (aFiltered && !bFiltered) {
            return 1;
          }
          if (!aFiltered && bFiltered) {
            return -1;
          }
          return 0;
        });

        if (filteredItemsIDs.size >= 2) {
          const GROUP_SIZE = 5;
          // If 2 or more, group filtered items into one, limit to GROUP_SIZE in a group
          const unfiltered = [];
          const filtered = [];
          fItems.forEach((item) => {
            if (filteredItemsIDs.has(item.id)) {
              filtered.push(item);
            } else {
              unfiltered.push(item);
            }
          });
          const filteredItems = [];
          for (let i = 0; i < filtered.length; i += GROUP_SIZE) {
            filteredItems.push({
              _grouped: true,
              posts: filtered.slice(i, i + GROUP_SIZE),
            });
          }
          fItems = unfiltered.concat(filteredItems);
        }

        return (
          <li key={`timeline-${statusID}`} class="timeline-item-carousel">
            <StatusCarousel title={title} class={`${type}-carousel`}>
              {fItems.map((item) => {
                const { id: statusID, reblog, _pinned, _grouped } = item;
                if (_grouped) {
                  return (
                    <li key={statusID} class="timeline-item-carousel-group">
                      {item.posts.map((item) => {
                        const { id: statusID, reblog, _pinned } = item;
                        const actualStatusID = reblog?.id || statusID;
                        const url = instance
                          ? `/${instance}/s/${actualStatusID}`
                          : `/s/${actualStatusID}`;
                        if (_pinned) useItemID = false;
                        return (
                          <Link
                            class="status-carousel-link timeline-item-alt"
                            to={url}
                          >
                            {useItemID ? (
                              <Status
                                statusID={statusID}
                                instance={instance}
                                size="s"
                              />
                            ) : (
                              <Status
                                status={item}
                                instance={instance}
                                size="s"
                              />
                            )}
                          </Link>
                        );
                      })}
                    </li>
                  );
                }

                const actualStatusID = reblog?.id || statusID;
                const url = instance
                  ? `/${instance}/s/${actualStatusID}`
                  : `/s/${actualStatusID}`;
                if (_pinned) useItemID = false;
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
                          enableCommentHint
                          // allowFilters={allowFilters}
                          mediaFirst={mediaFirst}
                        />
                      ) : (
                        <Status
                          status={item}
                          instance={instance}
                          size="s"
                          contentTextWeight
                          enableCommentHint
                          // allowFilters={allowFilters}
                          mediaFirst={mediaFirst}
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
      const manyItems = fItems.length > 3;
      return fItems.map((item, i) => {
        const { id: statusID, _differentAuthor } = item;
        const url = instance ? `/${instance}/s/${statusID}` : `/s/${statusID}`;
        const isMiddle = i > 0 && i < fItems.length - 1;
        const isSpoiler = item.sensitive && !!item.spoilerText;
        const showCompact =
          (!_differentAuthor && isSpoiler && i > 0) ||
          (manyItems &&
            isMiddle &&
            (type === 'thread' ||
              (type === 'conversation' &&
                !_differentAuthor &&
                !fItems[i - 1]._differentAuthor &&
                !fItems[i + 1]._differentAuthor)));
        const isStart = i === 0;
        const isEnd = i === fItems.length - 1;
        return (
          <li
            key={`timeline-${statusID}`}
            class={`timeline-item-container timeline-item-container-type-${type} timeline-item-container-${
              isStart ? 'start' : isEnd ? 'end' : 'middle'
            } ${_differentAuthor ? 'timeline-item-diff-author' : ''}`}
          >
            <Link class="status-link timeline-item" to={url}>
              {showCompact ? (
                <TimelineStatusCompact
                  status={item}
                  instance={instance}
                  filterContext={filterContext}
                />
              ) : useItemID ? (
                <Status
                  statusID={statusID}
                  instance={instance}
                  enableCommentHint={isEnd}
                  showFollowedTags={showFollowedTags}
                  // allowFilters={allowFilters}
                />
              ) : (
                <Status
                  status={item}
                  instance={instance}
                  enableCommentHint={isEnd}
                  showFollowedTags={showFollowedTags}
                  // allowFilters={allowFilters}
                />
              )}
            </Link>
          </li>
        );
      });
    }

    const itemKey = `timeline-${statusID + _pinned}`;

    if (view === 'media') {
      return useItemID ? (
        <MediaPost
          class="timeline-item"
          parent="li"
          key={itemKey}
          statusID={statusID}
          instance={instance}
          // allowFilters={allowFilters}
        />
      ) : (
        <MediaPost
          class="timeline-item"
          parent="li"
          key={itemKey}
          status={status}
          instance={instance}
          // allowFilters={allowFilters}
        />
      );
    }

    return (
      <li key={itemKey}>
        <Link class="status-link timeline-item" to={url}>
          {useItemID ? (
            <Status
              statusID={statusID}
              instance={instance}
              enableCommentHint
              showFollowedTags={showFollowedTags}
              showReplyParent={showReplyParent}
              // allowFilters={allowFilters}
              mediaFirst={mediaFirst}
            />
          ) : (
            <Status
              status={status}
              instance={instance}
              enableCommentHint
              showFollowedTags={showFollowedTags}
              showReplyParent={showReplyParent}
              // allowFilters={allowFilters}
              mediaFirst={mediaFirst}
            />
          )}
        </Link>
      </li>
    );
  },
  (oldProps, newProps) => {
    const oldID = (oldProps.status?.id || '').toString();
    const newID = (newProps.status?.id || '').toString();
    return (
      oldID === newID &&
      oldProps.instance === newProps.instance &&
      oldProps.view === newProps.view
    );
  },
);

function StatusCarousel({ title, class: className, children }) {
  const { t } = useLingui();
  const carouselRef = useRef();
  // const { reachStart, reachEnd, init } = useScroll({
  //   scrollableRef: carouselRef,
  //   direction: 'horizontal',
  // });
  const startButtonRef = useRef();
  const endButtonRef = useRef();
  // useScrollFn(
  //   {
  //     scrollableRef: carouselRef,
  //     direction: 'horizontal',
  //     init: true,
  //   },
  //   ({ reachStart, reachEnd }) => {
  //     if (startButtonRef.current) startButtonRef.current.disabled = reachStart;
  //     if (endButtonRef.current) endButtonRef.current.disabled = reachEnd;
  //   },
  //   [],
  // );
  // useEffect(() => {
  //   init?.();
  // }, []);

  const [render, setRender] = useState(false);
  useEffect(() => {
    setTimeout(() => {
      setRender(true);
    }, 1);
  }, []);

  return (
    <div class={`status-carousel ${className}`}>
      <header>
        <h3>{title}</h3>
        <span>
          <button
            ref={startButtonRef}
            type="button"
            class="small plain2"
            // disabled={reachStart}
            onClick={() => {
              const left =
                Math.min(320, carouselRef.current?.offsetWidth) *
                (isRTL() ? 1 : -1);
              carouselRef.current?.scrollBy({
                left,
                behavior: 'smooth',
              });
            }}
          >
            <Icon icon="chevron-left" alt={t`Previous`} />
          </button>{' '}
          <button
            ref={endButtonRef}
            type="button"
            class="small plain2"
            // disabled={reachEnd}
            onClick={() => {
              const left =
                Math.min(320, carouselRef.current?.offsetWidth) *
                (isRTL() ? -1 : 1);
              carouselRef.current?.scrollBy({
                left,
                behavior: 'smooth',
              });
            }}
          >
            <Icon icon="chevron-right" alt={t`Next`} />
          </button>
        </span>
      </header>
      <ul ref={carouselRef}>
        <InView
          class="status-carousel-beacon"
          onChange={(inView) => {
            if (startButtonRef.current)
              startButtonRef.current.disabled = inView;
          }}
        />
        {children[0]}
        {render && children.slice(1)}
        <InView
          class="status-carousel-beacon"
          onChange={(inView) => {
            if (endButtonRef.current) endButtonRef.current.disabled = inView;
          }}
        />
      </ul>
    </div>
  );
}

function TimelineStatusCompact({ status, instance, filterContext }) {
  const { t } = useLingui();
  const snapStates = useSnapshot(states);
  const { id, visibility, language } = status;
  const statusPeekText = statusPeek(status);
  const sKey = statusKey(id, instance);
  const filterInfo = isFiltered(status.filtered, filterContext);
  return (
    <article
      class={`status compact-thread ${
        visibility === 'direct' ? 'visibility-direct' : ''
      }`}
      tabindex="-1"
    >
      {!!snapStates.statusThreadNumber[sKey] ? (
        <div class="status-thread-badge">
          <Icon icon="thread" size="s" alt={t`Thread`} />
          {snapStates.statusThreadNumber[sKey]
            ? ` ${snapStates.statusThreadNumber[sKey]}/X`
            : ''}
        </div>
      ) : (
        <div class="status-thread-badge">
          <Icon icon="thread" size="s" alt={t`Thread`} />
        </div>
      )}
      <div
        class="content-compact"
        title={statusPeekText}
        lang={language}
        dir="auto"
      >
        {!!filterInfo ? (
          <b
            class="status-filtered-badge badge-meta horizontal"
            title={filterInfo?.titlesStr || ''}
          >
            {filterInfo?.titlesStr ? (
              <Trans>
                <span>Filtered</span>: <span>{filterInfo.titlesStr}</span>
              </Trans>
            ) : (
              <span>
                <Trans>Filtered</Trans>
              </span>
            )}
          </b>
        ) : (
          <>
            {statusPeekText}
            {status.sensitive && status.spoilerText && (
              <>
                {' '}
                <span class="spoiler-badge">
                  <Icon icon="eye-close" size="s" alt={t`Content warning`} />
                </span>
              </>
            )}
          </>
        )}
      </div>
    </article>
  );
}

function inBackground() {
  return !!document.querySelector('.deck-backdrop, #modal-container > *');
}

export default Timeline;
