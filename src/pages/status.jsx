import './status.css';

import { Menu, MenuDivider, MenuHeader, MenuItem } from '@szhsin/react-menu';
import debounce from 'just-debounce-it';
import pRetry from 'p-retry';
import { memo } from 'preact/compat';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import { useHotkeys } from 'react-hotkeys-hook';
import { InView } from 'react-intersection-observer';
import { matchPath, useParams, useSearchParams } from 'react-router-dom';
import { useDebouncedCallback } from 'use-debounce';
import { useSnapshot } from 'valtio';

import Avatar from '../components/avatar';
import Icon from '../components/icon';
import Link from '../components/link';
import Loader from '../components/loader';
import MediaModal from '../components/media-modal';
import NameText from '../components/name-text';
import RelativeTime from '../components/relative-time';
import Status from '../components/status';
import { api } from '../utils/api';
import htmlContentLength from '../utils/html-content-length';
import shortenNumber from '../utils/shorten-number';
import states, {
  getStatus,
  saveStatus,
  statusKey,
  threadifyStatus,
} from '../utils/states';
import statusPeek from '../utils/status-peek';
import { getCurrentAccount } from '../utils/store-utils';
import useScroll from '../utils/useScroll';
import useTitle from '../utils/useTitle';

import getInstanceStatusURL from './../utils/get-instance-status-url';

const LIMIT = 40;
const SUBCOMMENTS_OPEN_ALL_LIMIT = 10;
const MAX_WEIGHT = 5;

let cachedRepliesToggle = {};
let cachedStatusesMap = {};
function resetScrollPosition(id) {
  delete cachedStatusesMap[id];
  delete states.scrollPositions[id];
}

function StatusPage(params) {
  const { id } = params;
  const { masto, instance } = api({ instance: params.instance });
  const snapStates = useSnapshot(states);
  const [searchParams, setSearchParams] = useSearchParams();
  const mediaParam = searchParams.get('media');
  const mediaOnlyParam = searchParams.get('media-only');
  const mediaIndex = parseInt(mediaParam || mediaOnlyParam, 10);
  let showMedia = mediaIndex > 0;
  const mediaStatusID = searchParams.get('mediaStatusID');
  const mediaStatus = getStatus(mediaStatusID, instance);
  if (mediaStatusID && !mediaStatus) {
    showMedia = false;
  }
  const showMediaOnly = showMedia && !!mediaOnlyParam;

  const sKey = statusKey(id, instance);
  const [heroStatus, setHeroStatus] = useState(states.statuses[sKey]);
  useEffect(() => {
    if (states.statuses[sKey]) {
      setHeroStatus(states.statuses[sKey]);
    }
  }, [sKey]);

  const closeLink = useMemo(() => {
    const { prevLocation } = states;
    const pathname =
      (prevLocation?.pathname || '') + (prevLocation?.search || '');
    const matchStatusPath =
      matchPath('/:instance/s/:id', pathname) || matchPath('/s/:id', pathname);
    if (!pathname || matchStatusPath) {
      return '/';
    }
    return pathname;
  }, []);

  useEffect(() => {
    if (!heroStatus && showMedia) {
      (async () => {
        try {
          const status = await masto.v1.statuses.fetch(id);
          saveStatus(status, instance);
          setHeroStatus(status);
        } catch (err) {
          console.error(err);
          alert('Unable to load post.');
          location.hash = closeLink;
        }
      })();
    }
  }, [showMedia]);

  const mediaAttachments = mediaStatusID
    ? mediaStatus?.mediaAttachments
    : heroStatus?.mediaAttachments;

  return (
    <div class="deck-backdrop">
      {showMedia ? (
        mediaAttachments?.length ? (
          <MediaModal
            mediaAttachments={mediaAttachments}
            statusID={mediaStatusID || id}
            instance={instance}
            index={mediaIndex - 1}
            onClose={() => {
              if (
                !window.matchMedia('(min-width: calc(40em + 350px))').matches &&
                snapStates.prevLocation
              ) {
                history.back();
              } else {
                if (showMediaOnly) {
                  location.hash = closeLink;
                } else {
                  searchParams.delete('media');
                  searchParams.delete('mediaStatusID');
                  setSearchParams(searchParams);
                }
              }
            }}
          />
        ) : (
          <div class="media-modal-container loading">
            <Loader abrupt />
          </div>
        )
      ) : (
        <Link to={closeLink} />
      )}
      {!showMediaOnly && (
        <StatusThread
          id={id}
          instance={params.instance}
          closeLink={closeLink}
        />
      )}
    </div>
  );
}

function StatusThread({ id, closeLink = '/', instance: propInstance }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const mediaParam = searchParams.get('media');
  const showMedia = parseInt(mediaParam, 10) > 0;
  const [viewMode, setViewMode] = useState(searchParams.get('view'));
  const translate = !!parseInt(searchParams.get('translate'));
  const { masto, instance } = api({ instance: propInstance });
  const {
    masto: currentMasto,
    instance: currentInstance,
    authenticated,
  } = api();
  const sameInstance = instance === currentInstance;
  const snapStates = useSnapshot(states);
  const [statuses, setStatuses] = useState([]);
  const [uiState, setUIState] = useState('default');
  const heroStatusRef = useRef();
  const sKey = statusKey(id, instance);
  const totalDescendants = useRef(0);

  const scrollableRef = useRef();
  useEffect(() => {
    scrollableRef.current?.focus();
  }, []);
  useEffect(() => {
    const onScroll = debounce(() => {
      // console.log('onScroll');
      if (!scrollableRef.current) return;
      const { scrollTop } = scrollableRef.current;
      if (uiState !== 'loading') {
        states.scrollPositions[id] = scrollTop;
      }
    }, 50);
    scrollableRef.current?.addEventListener('scroll', onScroll, {
      passive: true,
    });
    onScroll();
    return () => {
      onScroll.cancel();
      scrollableRef.current?.removeEventListener('scroll', onScroll);
    };
  }, [id, uiState !== 'loading']);

  const scrollOffsets = useRef();
  const initContext = ({ reloadHero } = {}) => {
    console.debug('initContext', id);
    setUIState('loading');
    let heroTimer;

    const cachedStatuses = cachedStatusesMap[id];
    if (cachedStatuses) {
      // Case 1: It's cached, let's restore them to make it snappy
      const reallyCachedStatuses = cachedStatuses.filter(
        (s) => states.statuses[sKey],
        // Some are not cached in the global state, so we need to filter them out
      );
      setStatuses(reallyCachedStatuses);
    } else {
      // const heroIndex = statuses.findIndex((s) => s.id === id);
      // if (heroIndex !== -1) {
      //   // Case 2: It's in current statuses. Slice off all descendant statuses after the hero status to be safe
      //   const slicedStatuses = statuses.slice(0, heroIndex + 1);
      //   setStatuses(slicedStatuses);
      // } else {
      // Case 3: Not cached and not in statuses, let's start from scratch
      setStatuses([{ id }]);
      // }
    }

    (async () => {
      const heroFetch = () =>
        pRetry(() => masto.v1.statuses.fetch(id), {
          retries: 4,
        });
      const contextFetch = pRetry(() => masto.v1.statuses.fetchContext(id), {
        retries: 8,
      });

      const hasStatus = !!snapStates.statuses[sKey];
      let heroStatus = snapStates.statuses[sKey];
      if (hasStatus && !reloadHero) {
        console.debug('Hero status is cached');
      } else {
        try {
          heroStatus = await heroFetch();
          saveStatus(heroStatus, instance);
          // Give time for context to appear
          await new Promise((resolve) => {
            setTimeout(resolve, 100);
          });
        } catch (e) {
          console.error(e);
          setUIState('error');
          return;
        }
      }

      try {
        const context = await contextFetch;
        const { ancestors, descendants } = context;

        totalDescendants.current = descendants?.length || 0;

        const missingStatuses = new Set();
        ancestors.forEach((status) => {
          saveStatus(status, instance, {
            skipThreading: true,
          });
          if (
            status.inReplyToId &&
            !ancestors.find((s) => s.id === status.inReplyToId)
          ) {
            missingStatuses.add(status.inReplyToId);
          }
        });
        const ancestorsIsThread = ancestors.every(
          (s) => s.account.id === heroStatus.account.id,
        );
        const nestedDescendants = [];
        descendants.forEach((status) => {
          saveStatus(status, instance, {
            skipThreading: true,
          });

          if (
            status.inReplyToId &&
            !descendants.find((s) => s.id === status.inReplyToId) &&
            status.inReplyToId !== heroStatus.id
          ) {
            missingStatuses.add(status.inReplyToId);
          }

          if (status.inReplyToAccountId === status.account.id) {
            // If replying to self, it's part of the thread, level 1
            nestedDescendants.push(status);
          } else if (status.inReplyToId === heroStatus.id) {
            // If replying to the hero status, it's a reply, level 1
            nestedDescendants.push(status);
          } else if (
            !status.inReplyToAccountId &&
            nestedDescendants.find((s) => s.id === status.inReplyToId) &&
            status.account.id === heroStatus.account.id
          ) {
            // If replying to hero's own statuses, it's part of the thread, level 1
            nestedDescendants.push(status);
          } else {
            // If replying to someone else, it's a reply to a reply, level 2
            const parent = descendants.find((s) => s.id === status.inReplyToId);
            if (parent) {
              if (!parent.__replies) {
                parent.__replies = [];
              }
              parent.__replies.push(status);
            } else {
              // If no parent, something is wrong
              console.warn('No parent found for', status);
            }
          }
        });

        console.log({ ancestors, descendants, nestedDescendants });
        if (missingStatuses.size) {
          console.error('Missing statuses', [...missingStatuses]);
        }

        function expandReplies(_replies) {
          return _replies?.map((_r) => ({
            id: _r.id,
            account: _r.account,
            repliesCount: _r.repliesCount,
            content: _r.content,
            weight: calcStatusWeight(_r),
            replies: expandReplies(_r.__replies),
          }));
        }

        const allStatuses = [
          ...ancestors.map((s) => ({
            id: s.id,
            ancestor: true,
            isThread: ancestorsIsThread,
            accountID: s.account.id,
            account: s.account,
            repliesCount: s.repliesCount,
            weight: calcStatusWeight(s),
          })),
          {
            id,
            accountID: heroStatus.account.id,
            weight: calcStatusWeight(heroStatus),
          },
          ...nestedDescendants.map((s) => ({
            id: s.id,
            account: s.account,
            accountID: s.account.id,
            descendant: true,
            thread: s.account.id === heroStatus.account.id,
            weight: calcStatusWeight(s),
            replies: expandReplies(s.__replies),
          })),
        ];

        setUIState('default');
        scrollOffsets.current = {
          offsetTop: heroStatusRef.current?.offsetTop,
          scrollTop: scrollableRef.current?.scrollTop,
        };

        // Set limit to hero's index
        const heroLimit = allStatuses.findIndex((s) => s.id === id);
        if (heroLimit >= limit) {
          setLimit(heroLimit + 1);
        }

        console.log({ allStatuses });
        setStatuses(allStatuses);
        cachedStatusesMap[id] = allStatuses;

        // Let's threadify this one
        // Note that all non-hero statuses will trigger saveStatus which will threadify them too
        // By right, at this point, all descendant statuses should be cached
        threadifyStatus(heroStatus, instance);
      } catch (e) {
        console.error(e);
        setUIState('error');
      }
    })();

    return () => {
      clearTimeout(heroTimer);
    };
  };

  useEffect(initContext, [id, masto]);
  useEffect(() => {
    if (!statuses.length) return;
    console.debug('STATUSES', statuses);
    const scrollPosition = snapStates.scrollPositions[id];
    console.debug('scrollPosition', scrollPosition);
    if (!!scrollPosition) {
      console.debug('Case 1', {
        id,
        scrollPosition,
      });
      scrollableRef.current.scrollTop = scrollPosition;
    } else if (scrollOffsets.current) {
      const newScrollOffsets = {
        offsetTop: heroStatusRef.current?.offsetTop,
        scrollTop: scrollableRef.current?.scrollTop,
      };
      const newScrollTop =
        newScrollOffsets.offsetTop -
        scrollOffsets.current.offsetTop +
        newScrollOffsets.scrollTop;
      console.debug('Case 2', {
        scrollOffsets: scrollOffsets.current,
        newScrollOffsets,
        newScrollTop,
        statuses: [...statuses],
      });
      scrollableRef.current.scrollTop = newScrollTop;
    } else if (statuses.length === 1) {
      console.debug('Case 3', {
        id,
      });
      scrollableRef.current.scrollTop = 0;
    }

    // RESET
    scrollOffsets.current = null;
  }, [statuses]);

  useEffect(() => {
    if (snapStates.reloadStatusPage <= 0) return;
    // Delete the cache for the context
    (async () => {
      try {
        const { instanceURL } = getCurrentAccount();
        const contextURL = `https://${instanceURL}/api/v1/statuses/${id}/context`;
        console.log('Clear cache', contextURL);
        const apiCache = await caches.open('api');
        await apiCache.delete(contextURL, { ignoreVary: true });

        return initContext({
          reloadHero: true,
        });
      } catch (e) {
        console.error(e);
      }
    })();
  }, [snapStates.reloadStatusPage]);

  useEffect(() => {
    return () => {
      // RESET
      states.scrollPositions = {};
      states.reloadStatusPage = 0;
      cachedStatusesMap = {};
      cachedRepliesToggle = {};
      statusWeightCache.clear();
    };
  }, []);

  const heroStatus = snapStates.statuses[sKey] || snapStates.statuses[id];
  const heroDisplayName = useMemo(() => {
    // Remove shortcodes from display name
    if (!heroStatus) return '';
    const { account } = heroStatus;
    const div = document.createElement('div');
    div.innerHTML = account.displayName;
    return div.innerText.trim();
  }, [heroStatus]);
  const heroContentText = useMemo(() => {
    if (!heroStatus) return '';
    let text = statusPeek(heroStatus);
    if (text.length > 64) {
      // "The title should ideally be less than 64 characters in length"
      // https://www.w3.org/Provider/Style/TITLE.html
      text = text.slice(0, 64) + '…';
    }
    return text;
  }, [heroStatus]);
  useTitle(
    heroDisplayName && heroContentText
      ? `${heroDisplayName}: "${heroContentText}"`
      : 'Status',
    '/:instance?/s/:id',
  );

  const postInstance = useMemo(() => {
    if (!heroStatus) return;
    const { url } = heroStatus;
    if (!url) return;
    return new URL(url).hostname;
  }, [heroStatus]);
  const postSameInstance = useMemo(() => {
    if (!postInstance) return;
    return postInstance === instance;
  }, [postInstance, instance]);

  const [limit, setLimit] = useState(LIMIT);
  const showMore = useMemo(() => {
    // return number of statuses to show
    return statuses.length - limit;
  }, [statuses.length, limit]);

  const hasDescendants = statuses.some((s) => s.descendant);
  const ancestors = statuses.filter((s) => s.ancestor);

  const [heroInView, setHeroInView] = useState(true);
  const onView = useDebouncedCallback(setHeroInView, 100);
  const heroPointer = useMemo(() => {
    // get top offset of heroStatus
    if (!heroStatusRef.current || heroInView) return null;
    const { top } = heroStatusRef.current.getBoundingClientRect();
    return top > 0 ? 'down' : 'up';
  }, [heroInView]);

  useHotkeys(
    'esc',
    () => {
      location.hash = closeLink;
    },
    {
      // If media is open, esc to close media first
      // Else close the status page
      enabled: !showMedia,
    },
  );
  // For backspace, will always close both media and status page
  useHotkeys('backspace', () => {
    location.hash = closeLink;
  });

  useHotkeys('j', () => {
    const activeStatus = document.activeElement.closest(
      '.status-link, .status-focus',
    );
    const activeStatusRect = activeStatus?.getBoundingClientRect();
    const allStatusLinks = Array.from(
      // Select all statuses except those inside collapsed details/summary
      // Hat-tip to @AmeliaBR@front-end.social
      // https://front-end.social/@AmeliaBR/109784776146144471
      scrollableRef.current.querySelectorAll(
        '.status-link:not(details:not([open]) > summary ~ *, details:not([open]) > summary ~ * *), .status-focus:not(details:not([open]) > summary ~ *, details:not([open]) > summary ~ * *)',
      ),
    );
    console.log({ allStatusLinks });
    if (
      activeStatus &&
      activeStatusRect.top < scrollableRef.current.clientHeight &&
      activeStatusRect.bottom > 0
    ) {
      const activeStatusIndex = allStatusLinks.indexOf(activeStatus);
      let nextStatus = allStatusLinks[activeStatusIndex + 1];
      if (nextStatus) {
        nextStatus.focus();
        nextStatus.scrollIntoViewIfNeeded?.();
      }
    } else {
      // If active status is not in viewport, get the topmost status-link in viewport
      const topmostStatusLink = allStatusLinks.find((statusLink) => {
        const statusLinkRect = statusLink.getBoundingClientRect();
        return statusLinkRect.top >= 44 && statusLinkRect.left >= 0; // 44 is the magic number for header height, not real
      });
      if (topmostStatusLink) {
        topmostStatusLink.focus();
        topmostStatusLink.scrollIntoViewIfNeeded?.();
      }
    }
  });

  useHotkeys('k', () => {
    const activeStatus = document.activeElement.closest(
      '.status-link, .status-focus',
    );
    const activeStatusRect = activeStatus?.getBoundingClientRect();
    const allStatusLinks = Array.from(
      scrollableRef.current.querySelectorAll(
        '.status-link:not(details:not([open]) > summary ~ *, details:not([open]) > summary ~ * *), .status-focus:not(details:not([open]) > summary ~ *, details:not([open]) > summary ~ * *)',
      ),
    );
    if (
      activeStatus &&
      activeStatusRect.top < scrollableRef.current.clientHeight &&
      activeStatusRect.bottom > 0
    ) {
      const activeStatusIndex = allStatusLinks.indexOf(activeStatus);
      let prevStatus = allStatusLinks[activeStatusIndex - 1];
      if (prevStatus) {
        prevStatus.focus();
        prevStatus.scrollIntoViewIfNeeded?.();
      }
    } else {
      // If active status is not in viewport, get the topmost status-link in viewport
      const topmostStatusLink = allStatusLinks.find((statusLink) => {
        const statusLinkRect = statusLink.getBoundingClientRect();
        return statusLinkRect.top >= 44 && statusLinkRect.left >= 0; // 44 is the magic number for header height, not real
      });
      if (topmostStatusLink) {
        topmostStatusLink.focus();
        topmostStatusLink.scrollIntoViewIfNeeded?.();
      }
    }
  });

  // NOTE: I'm not sure if 'x' is the best shortcut for this, might change it later
  // IDEA: x is for expand
  useHotkeys('x', () => {
    const activeStatus = document.activeElement.closest(
      '.status-link, .status-focus',
    );
    if (activeStatus) {
      const details = activeStatus.nextElementSibling;
      if (details && details.tagName.toLowerCase() === 'details') {
        details.open = !details.open;
      }
    }
  });

  const { nearReachStart } = useScroll({
    scrollableRef,
    distanceFromStartPx: 16,
  });

  const initialPageState = useRef(showMedia ? 'media+status' : 'status');

  const handleMediaClick = useCallback(
    (e, i, media, status) => {
      e.preventDefault();
      e.stopPropagation();
      setSearchParams({
        media: i + 1,
        mediaStatusID: status.id,
      });
    },
    [id],
  );

  return (
    <div
      tabIndex="-1"
      ref={scrollableRef}
      class={`status-deck deck contained ${
        statuses.length > 1 ? 'padded-bottom' : ''
      } ${initialPageState.current === 'status' ? 'slide-in' : ''} ${
        viewMode ? `deck-view-${viewMode}` : ''
      }`}
      onAnimationEnd={(e) => {
        // Fix the bounce effect when switching viewMode
        // `slide-in` animation kicks in when switching viewMode
        if (initialPageState.current === 'status') {
          // e.target.classList.remove('slide-in');
          initialPageState.current = null;
        }
      }}
    >
      <header
        class={`${heroInView ? 'inview' : ''} ${
          uiState === 'loading' ? 'loading' : ''
        }`}
        onDblClick={(e) => {
          // reload statuses
          states.reloadStatusPage++;
        }}
      >
        {/* <div>
            <Link class="button plain deck-close" href={closeLink}>
              <Icon icon="chevron-left" size="xl" />
            </Link>
          </div> */}
        <div class="header-grid header-grid-2">
          <h1>
            {!!/\/s\//i.test(snapStates.prevLocation?.pathname) && (
              <button
                type="button"
                class="plain deck-back"
                onClick={() => {
                  history.back();
                }}
              >
                <Icon icon="chevron-left" size="xl" />
              </button>
            )}
            {!heroInView && heroStatus && uiState !== 'loading' ? (
              <>
                <span class="hero-heading">
                  <NameText
                    account={heroStatus.account}
                    instance={instance}
                    showAvatar
                    short
                  />{' '}
                  <span class="insignificant">
                    &bull;{' '}
                    <RelativeTime
                      datetime={heroStatus.createdAt}
                      format="micro"
                    />
                  </span>
                </span>{' '}
                <button
                  type="button"
                  class="ancestors-indicator light small"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    heroStatusRef.current.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    });
                  }}
                  title="Go to main post"
                >
                  <Icon
                    icon={heroPointer === 'down' ? 'arrow-down' : 'arrow-up'}
                  />
                </button>
              </>
            ) : (
              <>
                Post{' '}
                <button
                  type="button"
                  class="ancestors-indicator light small"
                  onClick={(e) => {
                    // Scroll to top
                    e.preventDefault();
                    e.stopPropagation();
                    scrollableRef.current.scrollTo({
                      top: 0,
                      behavior: 'smooth',
                    });
                  }}
                  hidden={!ancestors.length || nearReachStart}
                  title={`${ancestors.length} posts above ‒ Go to top`}
                >
                  <Icon icon="arrow-up" />
                  {ancestors
                    .filter(
                      (a, i, arr) =>
                        arr.findIndex((b) => b.accountID === a.accountID) === i,
                    )
                    .slice(0, 3)
                    .map((ancestor) => (
                      <Avatar
                        key={ancestor.account.id}
                        url={ancestor.account.avatar}
                        alt={ancestor.account.displayName}
                      />
                    ))}
                  {/* <Icon icon="comment" />{' '} */}
                  {ancestors.length > 3 && (
                    <>
                      {' '}
                      <span class="insignificant">
                        {shortenNumber(ancestors.length)}
                      </span>
                    </>
                  )}
                </button>
              </>
            )}
          </h1>
          <div class="header-side">
            <Menu
              align="end"
              portal={{
                // Need this, else the menu click will cause scroll jump
                target: scrollableRef.current,
              }}
              menuButton={
                <button type="button" class="button plain4">
                  <Icon icon="more" alt="Actions" size="xl" />
                </button>
              }
            >
              <MenuItem
                disabled={uiState === 'loading'}
                onClick={() => {
                  states.reloadStatusPage++;
                }}
              >
                <Icon icon="refresh" />
                <span>Refresh</span>
              </MenuItem>
              <MenuItem
                className="menu-switch-view"
                onClick={() => {
                  setViewMode(viewMode === 'full' ? null : 'full');
                  searchParams.delete('media');
                  searchParams.delete('media-only');
                  if (viewMode === 'full') {
                    searchParams.delete('view');
                  } else {
                    searchParams.set('view', 'full');
                  }
                  setSearchParams(searchParams);
                }}
              >
                <Icon
                  icon={
                    {
                      '': 'layout5',
                      full: 'layout4',
                    }[viewMode || '']
                  }
                />
                <span>
                  Switch to {viewMode === 'full' ? 'Side Peek' : 'Full'} view
                </span>
              </MenuItem>
              <MenuItem
                onClick={() => {
                  // Click all buttons with class .spoiler but not .spoiling
                  const buttons = Array.from(
                    scrollableRef.current.querySelectorAll(
                      'button.spoiler:not(.spoiling)',
                    ),
                  );
                  buttons.forEach((button) => {
                    button.click();
                  });
                }}
              >
                <Icon icon="eye-open" /> <span>Show all sensitive content</span>
              </MenuItem>
              <MenuDivider />
              <MenuHeader className="plain">Experimental</MenuHeader>
              <MenuItem
                disabled={postSameInstance}
                onClick={() => {
                  const statusURL = getInstanceStatusURL(heroStatus.url);
                  if (statusURL) {
                    location.hash = statusURL;
                  } else {
                    alert('Unable to switch');
                  }
                }}
              >
                <Icon icon="transfer" />
                <small class="menu-double-lines">
                  Switch to post's instance (<b>{postInstance}</b>)
                </small>
              </MenuItem>
            </Menu>
            <Link class="button plain deck-close" to={closeLink}>
              <Icon icon="x" size="xl" />
            </Link>
          </div>
        </div>
      </header>
      {!!statuses.length && heroStatus ? (
        <ul
          class={`timeline flat contextual grow ${
            uiState === 'loading' ? 'loading' : ''
          }`}
        >
          {statuses.slice(0, limit).map((status) => {
            const {
              id: statusID,
              ancestor,
              isThread,
              descendant,
              thread,
              replies,
              repliesCount,
              weight,
            } = status;
            const isHero = statusID === id;
            // const StatusParent = useCallback(
            //   (props) =>
            //     isThread || thread || ancestor ? (
            //       <Link
            //         class="status-link"
            //         to={
            //           instance ? `/${instance}/s/${statusID}` : `/s/${statusID}`
            //         }
            //         onClick={() => {
            //           resetScrollPosition(statusID);
            //         }}
            //         {...props}
            //       />
            //     ) : (
            //       <div class="status-focus" tabIndex={0} {...props} />
            //     ),
            //   [isThread, thread],
            // );
            return (
              <li
                key={statusID}
                ref={isHero ? heroStatusRef : null}
                class={`${ancestor ? 'ancestor' : ''} ${
                  descendant ? 'descendant' : ''
                } ${thread ? 'thread' : ''} ${isHero ? 'hero' : ''}`}
              >
                {isHero ? (
                  <>
                    <InView
                      threshold={0.1}
                      onChange={onView}
                      class="status-focus"
                      tabIndex={0}
                    >
                      <Status
                        statusID={statusID}
                        instance={instance}
                        withinContext
                        size="l"
                        enableTranslate
                        forceTranslate={translate}
                      />
                    </InView>
                    {uiState !== 'loading' && !authenticated ? (
                      <div class="post-status-banner">
                        <p>
                          You're not logged in. Interactions (reply, boost, etc)
                          are not possible.
                        </p>
                        <Link to="/login" class="button">
                          Log in
                        </Link>
                      </div>
                    ) : (
                      !sameInstance && (
                        <div class="post-status-banner">
                          <p>
                            This post is from another instance (
                            <b>{instance}</b>). Interactions (reply, boost, etc)
                            are not possible.
                          </p>
                          <button
                            type="button"
                            disabled={uiState === 'loading'}
                            onClick={() => {
                              setUIState('loading');
                              (async () => {
                                try {
                                  const results = await currentMasto.v2.search({
                                    q: heroStatus.url,
                                    type: 'statuses',
                                    resolve: true,
                                    limit: 1,
                                  });
                                  if (results.statuses.length) {
                                    const status = results.statuses[0];
                                    location.hash = currentInstance
                                      ? `/${currentInstance}/s/${status.id}`
                                      : `/s/${status.id}`;
                                  } else {
                                    throw new Error('No results');
                                  }
                                } catch (e) {
                                  setUIState('default');
                                  alert('Error: ' + e);
                                  console.error(e);
                                }
                              })();
                            }}
                          >
                            <Icon icon="transfer" /> Switch to my instance to
                            enable interactions
                          </button>
                        </div>
                      )
                    )}
                  </>
                ) : (
                  // <StatusParent>
                  <Link
                    class="status-link"
                    to={
                      instance ? `/${instance}/s/${statusID}` : `/s/${statusID}`
                    }
                    onClick={() => {
                      resetScrollPosition(statusID);
                    }}
                  >
                    <Status
                      statusID={statusID}
                      instance={instance}
                      withinContext
                      size={thread || ancestor ? 'm' : 's'}
                      enableTranslate
                      onMediaClick={handleMediaClick}
                      onStatusLinkClick={() => {
                        resetScrollPosition(statusID);
                      }}
                    />
                    {ancestor && isThread && repliesCount > 1 && (
                      <div class="replies-link">
                        <Icon icon="comment" />{' '}
                        <span title={repliesCount}>
                          {shortenNumber(repliesCount)}
                        </span>
                      </div>
                    )}{' '}
                    {/* {replies?.length > LIMIT && (
                        <div class="replies-link">
                          <Icon icon="comment" />{' '}
                          <span title={replies.length}>
                            {shortenNumber(replies.length)}
                          </span>
                        </div>
                      )} */}
                    {/* </StatusParent> */}
                  </Link>
                )}
                {descendant && replies?.length > 0 && (
                  <SubComments
                    instance={instance}
                    replies={replies}
                    hasParentThread={thread}
                    level={1}
                    accWeight={weight}
                    openAll={
                      totalDescendants.current < SUBCOMMENTS_OPEN_ALL_LIMIT
                    }
                  />
                )}
                {uiState === 'loading' &&
                  isHero &&
                  !!heroStatus?.repliesCount &&
                  !hasDescendants && (
                    <div class="status-loading">
                      <Loader />
                    </div>
                  )}
                {uiState === 'error' &&
                  isHero &&
                  !!heroStatus?.repliesCount &&
                  !hasDescendants && (
                    <div class="status-error">
                      Unable to load replies.
                      <br />
                      <button
                        type="button"
                        class="plain"
                        onClick={() => {
                          states.reloadStatusPage++;
                        }}
                      >
                        Try again
                      </button>
                    </div>
                  )}
              </li>
            );
          })}
          {showMore > 0 && (
            <li>
              <button
                type="button"
                class="plain block show-more"
                disabled={uiState === 'loading'}
                onClick={() => setLimit((l) => l + LIMIT)}
                style={{ marginBlockEnd: '6em' }}
              >
                <div class="ib">
                  {/* show avatars for first 5 statuses */}
                  {statuses.slice(limit, limit + 5).map((status) => (
                    <Avatar
                      key={status.id}
                      url={status.account.avatarStatic}
                      // title={`${status.avatar.displayName} (@${status.avatar.acct})`}
                    />
                  ))}
                </div>{' '}
                <div class="ib">
                  Show more&hellip;{' '}
                  <span class="tag">
                    {showMore > LIMIT ? `${LIMIT}+` : showMore}
                  </span>
                </div>
              </button>
            </li>
          )}
        </ul>
      ) : (
        <>
          {uiState === 'loading' && (
            <ul class="timeline flat contextual grow loading">
              <li>
                <Status skeleton size="l" />
              </li>
            </ul>
          )}
          {uiState === 'error' && (
            <p class="ui-state">
              Unable to load post
              <br />
              <br />
              <button
                type="button"
                onClick={() => {
                  states.reloadStatusPage++;
                }}
              >
                Try again
              </button>
            </p>
          )}
        </>
      )}
    </div>
  );
}

function SubComments({
  replies,
  instance,
  hasParentThread,
  level,
  accWeight,
  openAll,
}) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Total comments count, including sub-replies
  const diveDeep = (replies) => {
    return replies.reduce((acc, reply) => {
      const { repliesCount, replies } = reply;
      const count = replies?.length || repliesCount;
      return acc + count + diveDeep(replies || []);
    }, 0);
  };
  const totalComments = replies.length + diveDeep(replies);
  const sameCount = replies.length === totalComments;

  // Get the first 3 accounts, unique by id
  const accounts = replies
    .map((r) => r.account)
    .filter((a, i, arr) => arr.findIndex((b) => b.id === a.id) === i)
    .slice(0, 3);

  const totalWeight = useMemo(() => {
    return replies?.reduce((acc, reply) => {
      return acc + reply?.weight;
    }, accWeight);
  }, [accWeight, replies?.length]);

  let open = false;
  if (openAll) {
    open = true;
  } else if (totalWeight <= MAX_WEIGHT) {
    open = true;
  } else if (!hasParentThread && totalComments === 1) {
    const shortReply = calcStatusWeight(replies[0]) < 2;
    if (shortReply) open = true;
  }
  const openBefore = cachedRepliesToggle[replies[0].id];

  const handleMediaClick = useCallback((e, i, media, status) => {
    e.preventDefault();
    e.stopPropagation();
    setSearchParams({
      media: i + 1,
      mediaStatusID: status.id,
    });
  }, []);

  const detailsRef = useRef();
  useLayoutEffect(() => {
    function handleScroll(e) {
      e.target.dataset.scrollLeft = e.target.scrollLeft;
    }
    detailsRef.current?.addEventListener('scroll', handleScroll, {
      passive: true,
    });
    return () => {
      detailsRef.current?.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <details
      ref={detailsRef}
      class="replies"
      open={openBefore || open}
      onToggle={(e) => {
        const { open } = e.target;
        // use first reply as ID
        cachedRepliesToggle[replies[0].id] = open;
      }}
      style={{
        '--comments-level': level,
      }}
      data-comments-level={level}
      data-comments-level-overflow={level > 4}
    >
      <summary class="replies-summary" hidden={open}>
        <span class="avatars">
          {accounts.map((a) => (
            <Avatar
              key={a.id}
              url={a.avatarStatic}
              title={`${a.displayName} @${a.username}`}
              squircle={a?.bot}
            />
          ))}
        </span>
        <span>
          <span title={replies.length}>{shortenNumber(replies.length)}</span>{' '}
          repl
          {replies.length === 1 ? 'y' : 'ies'}
        </span>
        {!sameCount && totalComments > 1 && (
          <>
            {' '}
            &middot;{' '}
            <span>
              <span title={totalComments}>{shortenNumber(totalComments)}</span>{' '}
              comment
              {totalComments === 1 ? '' : 's'}
            </span>
          </>
        )}
      </summary>
      <ul>
        {replies.map((r) => (
          <li key={r.id}>
            <Link
              class="status-link"
              to={instance ? `/${instance}/s/${r.id}` : `/s/${r.id}`}
              onClick={() => {
                resetScrollPosition(r.id);
              }}
            >
              {/* <div class="status-focus" tabIndex={0}> */}
              <Status
                statusID={r.id}
                instance={instance}
                withinContext
                size="s"
                enableTranslate
                onMediaClick={handleMediaClick}
              />
              {!r.replies?.length && r.repliesCount > 0 && (
                <div class="replies-link">
                  <Icon icon="comment" />{' '}
                  <span title={r.repliesCount}>
                    {shortenNumber(r.repliesCount)}
                  </span>
                </div>
              )}
              {/* </div> */}
            </Link>
            {r.replies?.length && (
              <SubComments
                instance={instance}
                replies={r.replies}
                level={level + 1}
                accWeight={!open ? r.weight : totalWeight}
                openAll={openAll}
              />
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

const MEDIA_VIRTUAL_LENGTH = 140;
const POLL_VIRTUAL_LENGTH = 35;
const CARD_VIRTUAL_LENGTH = 70;
const WEIGHT_SEGMENT = 140;
const statusWeightCache = new Map();
function calcStatusWeight(status) {
  const cachedWeight = statusWeightCache.get(status.id);
  if (cachedWeight) return cachedWeight;
  const { spoilerText, content, mediaAttachments, poll, card } = status;
  const length = htmlContentLength(spoilerText + content);
  const mediaLength = mediaAttachments?.length ? MEDIA_VIRTUAL_LENGTH : 0;
  const pollLength = (poll?.options?.length || 0) * POLL_VIRTUAL_LENGTH;
  const cardLength =
    card && (mediaAttachments?.length || poll?.options?.length)
      ? 0
      : CARD_VIRTUAL_LENGTH;
  const totalLength = length + mediaLength + pollLength + cardLength;
  const weight = totalLength / WEIGHT_SEGMENT;
  statusWeightCache.set(status.id, weight);
  return weight;
}

export default memo(StatusPage);
