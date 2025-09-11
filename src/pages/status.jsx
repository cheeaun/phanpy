import './status.css';

import { plural } from '@lingui/core/macro';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { MenuDivider, MenuHeader, MenuItem } from '@szhsin/react-menu';
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
import punycode from 'punycode/';
import { useHotkeys } from 'react-hotkeys-hook';
import { InView } from 'react-intersection-observer';
import { matchPath, useSearchParams } from 'react-router-dom';
import { useSnapshot } from 'valtio';

import Avatar from '../components/avatar';
import EditHistoryControls from '../components/edit-history-controls';
import Icon from '../components/icon';
import Link from '../components/link';
import Loader from '../components/loader';
import { getSafeViewTransitionName } from '../components/media';
import MediaModal from '../components/media-modal';
import Menu2 from '../components/menu2';
import NameText from '../components/name-text';
import RelativeTime from '../components/relative-time';
import Status from '../components/status';
import { api } from '../utils/api';
import {
  EditHistoryProvider,
  useEditHistory,
} from '../utils/edit-history-context';
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
import useTitle from '../utils/useTitle';

import getInstanceStatusURL from './../utils/get-instance-status-url';

const { PHANPY_DEFAULT_INSTANCE: DEFAULT_INSTANCE } = import.meta.env;

const LIMIT = 40;
const SUBCOMMENTS_OPEN_ALL_LIMIT = 10;
const MAX_WEIGHT = 5;

let cachedRepliesToggle = {};
let cachedStatusesMap = {};
let scrollPositions = {};
function resetScrollPosition(id) {
  delete cachedStatusesMap[id];
  delete scrollPositions[id];
}

const scrollIntoViewOptions = {
  block: 'nearest',
  inline: 'center',
  behavior: 'smooth',
};

// Select all statuses except those inside collapsed details/summary
// Hat-tip to @AmeliaBR@front-end.social
// https://front-end.social/@AmeliaBR/109784776146144471
const STATUSES_SELECTOR =
  '.status-link:not(details:not([open]) > summary ~ *, details:not([open]) > summary ~ * *), .status-focus:not(details:not([open]) > summary ~ *, details:not([open]) > summary ~ * *)';

const STATUS_URL_REGEX = /\/s\//i;

import { ThreadCountContext } from '../utils/thread-count-context';

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
          const status = await masto.v1.statuses.$select(id).fetch();
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
    ? snapStates.statuses[statusKey(mediaStatusID, instance)]?.mediaAttachments
    : heroStatus?.mediaAttachments;

  const postViewState = () =>
    window.matchMedia('(min-width: calc(40em + 350px))').matches
      ? 'large'
      : 'small';
  const mediaClose = useCallback(() => {
    console.log('xxx', {
      postViewState: postViewState(),
      showMediaOnly,
    });
    if (postViewState() === 'small' && snapStates.prevLocation) {
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
  }, [showMediaOnly, closeLink, snapStates.prevLocation]);
  const handleMediaClose = useCallback(
    (e, currentIndex, mediaAttachments, carouselRef) => {
      if (postViewState() === 'large' && !showMediaOnly) {
        mediaClose();
        return;
      }
      if (showMedia && document.startViewTransition) {
        const media = mediaAttachments[currentIndex];
        const { id, blurhash, url } = media;
        const mediaVTN = getSafeViewTransitionName(id || blurhash || url);
        const els = document.querySelectorAll(
          `.status .media [data-view-transition-name="${mediaVTN}"]`,
        );
        const foundEls = [...els]?.filter?.((el) => {
          const elBounds = el.getBoundingClientRect();
          return (
            elBounds.top < window.innerHeight &&
            elBounds.bottom > 0 &&
            elBounds.left < window.innerWidth &&
            elBounds.right > 0
          );
        });
        // If more than one, get the one in status page
        const el =
          foundEls.length === 1
            ? foundEls[0]
            : foundEls.find((el) => !!el.closest('.status-deck'));

        console.log('xxx', { media, id, els, el });
        if (el) {
          const transition = document.startViewTransition(() => {
            el.style.viewTransitionName = mediaVTN;
            if (carouselRef?.current) {
              carouselRef.current
                .querySelectorAll('.media img, .media video')
                ?.forEach((el) => {
                  el.style.viewTransitionName = '';
                });
            }
            mediaClose();
          });
          transition.ready.finally(() => {
            el.style.viewTransitionName = '';
            el.dataset.viewTransitioned = mediaVTN;
          });
        } else {
          mediaClose();
        }
      } else {
        mediaClose();
      }
    },
    [showMedia, showMediaOnly],
  );

  useEffect(() => {
    let timer = setTimeout(() => {
      // carouselRef.current?.focus?.();
      const $carousel = document.querySelector('.carousel');
      if ($carousel) {
        $carousel.focus();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [showMediaOnly]);

  useEffect(() => {
    const $deckContainers = document.querySelectorAll('.deck-container');
    $deckContainers.forEach(($deckContainer) => {
      $deckContainer.setAttribute('inert', '');
    });
    return () => {
      $deckContainers.forEach(($deckContainer) => {
        $deckContainer.removeAttribute('inert');
      });
    };
  }, []);

  return (
    <div class="deck-backdrop">
      {showMedia ? (
        mediaAttachments?.length ? (
          <MediaModal
            mediaAttachments={mediaAttachments}
            statusID={mediaStatusID || id}
            instance={instance}
            lang={heroStatus?.language}
            index={mediaIndex - 1}
            onClose={handleMediaClose}
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
        <EditHistoryProvider statusID={id}>
          <StatusThread
            id={id}
            instance={params.instance}
            closeLink={closeLink}
          />
        </EditHistoryProvider>
      )}
    </div>
  );
}

function StatusParent(props) {
  const { linkable, to, onClick, ...restProps } = props;
  return linkable ? (
    <Link class="status-link" to={to} onClick={onClick} {...restProps} />
  ) : (
    <div class="status-focus" tabIndex={0} {...restProps} />
  );
}

// oldest first
function createdAtSort(a, b) {
  return Date.parse(a.createdAt) - Date.parse(b.createdAt);
}

const MONTH_IN_MS = 1000 * 60 * 60 * 24 * 30;

function StatusThread({ id, closeLink = '/', instance: propInstance }) {
  const { t } = useLingui();
  const [searchParams, setSearchParams] = useSearchParams();
  const mediaParam = searchParams.get('media');
  const mediaStatusID = searchParams.get('mediaStatusID');
  const showMedia = parseInt(mediaParam, 10) > 0;
  const firstLoad = useRef(
    !states.prevLocation &&
      (history.length === 1 ||
        ('navigation' in window && navigation?.entries?.()?.length === 1)),
  );
  const [viewMode, setViewMode] = useState(
    searchParams.get('view') || firstLoad.current ? 'full' : null,
  );
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
        scrollPositions[id] = scrollTop;
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

  const { editHistoryMode, initEditHistory, editedAtIndex, editHistoryRef } =
    useEditHistory();

  const scrollOffsets = useRef();
  const lastInitContextTS = useRef();
  const [threadsCount, setThreadsCount] = useState(0);
  const fullContext = useRef(null);
  const restructureContext = () => {
    console.log({ fullContext: fullContext.current });
    if (!fullContext.current) return;
    let { ancestors, descendants, heroStatus } = fullContext.current;

    if (editHistoryMode && descendants?.length) {
      // Filter descendants based on createdAt/editedAt dates
      // - editHistory items only has createdAt
      // - descendants items has createdAt and optional editedAt
      const currentEditedAtStatus = editHistoryRef.current[editedAtIndex];
      const currentEditedAtStatusCreatedAt = Date.parse(
        currentEditedAtStatus.createdAt,
      );
      const nextEditedAtStatus = editHistoryRef.current[editedAtIndex - 1];
      const nextEditedAtStatusCreatedAt = nextEditedAtStatus
        ? Date.parse(nextEditedAtStatus.createdAt)
        : null;
      descendants = descendants.filter((s) => {
        // Show descendants created between current and next editedAt dates
        const sCreatedAt = Date.parse(s.editedAt || s.createdAt);
        return (
          sCreatedAt >= currentEditedAtStatusCreatedAt &&
          (!nextEditedAtStatusCreatedAt ||
            sCreatedAt <= nextEditedAtStatusCreatedAt)
        );
      });
    }

    ancestors.sort(createdAtSort);
    descendants.sort(createdAtSort);

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
        // skipThreading: true,
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
        nestedDescendants.find(
          (s) =>
            s.id === status.inReplyToId &&
            s.account.id === heroStatus.account.id,
        ) &&
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

    // sort hero author to top
    nestedDescendants.sort((a, b) => {
      const heroAccountID = heroStatus.account.id;
      if (a.account.id === heroAccountID && b.account.id !== heroAccountID)
        return -1;
      if (b.account.id === heroAccountID && a.account.id !== heroAccountID)
        return 1;
      return 0;
    });

    console.log({ ancestors, descendants, nestedDescendants });
    if (missingStatuses.size) {
      console.error('Missing statuses', [...missingStatuses]);
    }

    let descendantLevelsCount = 1;
    function expandReplies(_replies, level) {
      const nextLevel = level + 1;
      if (nextLevel > descendantLevelsCount) {
        descendantLevelsCount = level;
      }
      return _replies?.map((_r) => ({
        id: _r.id,
        account: _r.account,
        repliesCount: _r.repliesCount,
        content: _r.content,
        weight: calcStatusWeight(_r),
        level: nextLevel,
        replies: expandReplies(_r.__replies, nextLevel),
      }));
    }

    const mappedNestedDescendants = nestedDescendants.map((s) => ({
      id: s.id,
      account: s.account,
      accountID: s.account.id,
      descendant: true,
      thread: s.account.id === heroStatus.account.id,
      weight: calcStatusWeight(s),
      level: 1,
      replies: expandReplies(s.__replies, 1),
      createdAt: s.createdAt,
    }));
    const allStatuses = [
      ...ancestors.map((s) => ({
        id: s.id,
        ancestor: true,
        isThread: ancestorsIsThread,
        accountID: s.account.id,
        account: s.account,
        repliesCount: s.repliesCount,
        weight: calcStatusWeight(s),
        createdAt: s.createdAt,
      })),
      {
        id,
        accountID: heroStatus.account.id,
        weight: calcStatusWeight(heroStatus),
        createdAt: heroStatus.createdAt,
      },
      ...mappedNestedDescendants,
    ];

    console.log({ allStatuses, descendantLevelsCount });
    return { allStatuses, ancestorsIsThread, mappedNestedDescendants };
  };

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
        pRetry(() => masto.v1.statuses.$select(id).fetch(), {
          retries: 4,
        });
      const contextFetch = pRetry(
        () => masto.v1.statuses.$select(id).context.fetch(),
        {
          retries: 8,
        },
      );

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
        const { ancestors } = context;
        fullContext.current = { ...context, heroStatus };
        const { allStatuses, ancestorsIsThread, mappedNestedDescendants } =
          restructureContext();

        const descendantsThread =
          ancestors.length && !ancestorsIsThread
            ? []
            : mappedNestedDescendants.filter((s) => s.thread);
        const threadsCount =
          (ancestorsIsThread ? ancestors.length : 0) + descendantsThread.length;
        if (threadsCount > 0 && threadsCount < 100) {
          // Cap at 100 because there's no point showing 100+
          // Include hero as part of thread count
          setThreadsCount(threadsCount + 1);
        }

        setUIState('default');
        scrollOffsets.current = {
          offsetTop: heroStatusRef.current?.offsetTop,
          scrollTop: scrollableRef.current?.scrollTop,
        };

        // Set limit to hero's index
        // const heroLimit = allStatuses.findIndex((s) => s.id === id);
        const heroLimit = ancestors.length || 0; // 0-indexed
        if (heroLimit >= limit) {
          setLimit(heroLimit + 1);
        }

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

    lastInitContextTS.current = Date.now();

    return () => {
      clearTimeout(heroTimer);
    };
  };

  useEffect(initContext, [id, masto]);

  useEffect(() => {
    try {
      const { allStatuses } = restructureContext();
      setStatuses(allStatuses);
    } catch (e) {}
    // Only run this when editHistoryMode changes
    // If id changes, initContext will run instead, so don't worry
  }, [editHistoryMode, editedAtIndex]);

  const [showRefresh, setShowRefresh] = useState(false);
  useEffect(() => {
    let interval = setInterval(() => {
      const now = Date.now();
      if (
        lastInitContextTS.current &&
        now - lastInitContextTS.current >= 60_000
      ) {
        setShowRefresh(true);
      }
    }, 60_000); // 1 minute
    return () => {
      clearInterval(interval);
    };
  }, []);

  useLayoutEffect(() => {
    if (!statuses.length) return;
    console.debug('STATUSES', statuses);
    const scrollPosition = scrollPositions[id];
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
      scrollPositions = {};
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
      : t({
          id: 'post.title',
          message: 'Post',
        }),
    '/:instance?/s/:id',
  );

  const postInstance = useMemo(() => {
    if (!heroStatus) return;
    const { url } = heroStatus;
    if (!url) return;
    return URL.parse(url)?.hostname;
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
      ignoreEventWhen: (e) => {
        const hasModal = !!document.querySelector('#modal-container > *');
        return hasModal || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey;
      },
      useKey: true,
    },
  );
  // For backspace, will always close both media and status page
  useHotkeys(
    'backspace',
    () => {
      location.hash = closeLink;
    },
    {
      useKey: true,
      ignoreEventWhen: (e) => e.metaKey || e.ctrlKey || e.altKey || e.shiftKey,
    },
  );

  useHotkeys(
    'j',
    () => {
      const activeStatus = document.activeElement.closest(
        '.status-link, .status-focus',
      );
      const activeStatusRect = activeStatus?.getBoundingClientRect();
      const allStatusLinks = Array.from(
        scrollableRef.current.querySelectorAll(STATUSES_SELECTOR),
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
          nextStatus.scrollIntoView(scrollIntoViewOptions);
        }
      } else {
        // If active status is not in viewport, get the topmost status-link in viewport
        const topmostStatusLink = allStatusLinks.find((statusLink) => {
          const statusLinkRect = statusLink.getBoundingClientRect();
          return statusLinkRect.top >= 44 && statusLinkRect.left >= 0; // 44 is the magic number for header height, not real
        });
        if (topmostStatusLink) {
          topmostStatusLink.focus();
          topmostStatusLink.scrollIntoView(scrollIntoViewOptions);
        }
      }
    },
    {
      useKey: true,
      ignoreEventWhen: (e) => e.metaKey || e.ctrlKey || e.altKey || e.shiftKey,
    },
  );

  useHotkeys(
    'k',
    () => {
      const activeStatus = document.activeElement.closest(
        '.status-link, .status-focus',
      );
      const activeStatusRect = activeStatus?.getBoundingClientRect();
      const allStatusLinks = Array.from(
        scrollableRef.current.querySelectorAll(STATUSES_SELECTOR),
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
          prevStatus.scrollIntoView(scrollIntoViewOptions);
        }
      } else {
        // If active status is not in viewport, get the topmost status-link in viewport
        const topmostStatusLink = allStatusLinks.find((statusLink) => {
          const statusLinkRect = statusLink.getBoundingClientRect();
          return statusLinkRect.top >= 44 && statusLinkRect.left >= 0; // 44 is the magic number for header height, not real
        });
        if (topmostStatusLink) {
          topmostStatusLink.focus();
          topmostStatusLink.scrollIntoView(scrollIntoViewOptions);
        }
      }
    },
    {
      useKey: true,
      ignoreEventWhen: (e) => e.metaKey || e.ctrlKey || e.altKey || e.shiftKey,
    },
  );

  // NOTE: I'm not sure if 'x' is the best shortcut for this, might change it later
  // IDEA: x is for expand
  useHotkeys(
    'x',
    () => {
      const activeStatus = document.activeElement.closest(
        '.status-link, .status-focus',
      );
      if (activeStatus) {
        const details = activeStatus.nextElementSibling;
        if (details && details.tagName.toLowerCase() === 'details') {
          details.open = !details.open;
        }
      }
    },
    {
      useKey: true,
      ignoreEventWhen: (e) => e.metaKey || e.ctrlKey || e.altKey || e.shiftKey,
    },
  );

  const [reachTopPost, setReachTopPost] = useState(false);
  // const { nearReachStart } = useScroll({
  //   scrollableRef,
  //   distanceFromStartPx: 16,
  // });

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

  const handleStatusLinkClick = useCallback((e, status) => {
    resetScrollPosition(status.id);
  }, []);

  useEffect(() => {
    let timer;
    if (mediaStatusID && showMedia) {
      timer = setTimeout(() => {
        const status = scrollableRef.current?.querySelector(
          `.status-link[href*="/${mediaStatusID}"]`,
        );
        if (status) {
          status.scrollIntoView(scrollIntoViewOptions);
        }
      }, 400); // After CSS transition
    }
    return () => {
      clearTimeout(timer);
    };
  }, [mediaStatusID, showMedia]);

  const renderStatus = useCallback(
    (status, i) => {
      const {
        id: statusID,
        ancestor,
        isThread,
        descendant,
        thread,
        replies,
        repliesCount,
        weight,
        level,
      } = status;
      const isHero = statusID === id;
      const isLinkable = isThread || ancestor;

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
                onChange={(inView) => {
                  queueMicrotask(() => {
                    requestAnimationFrame(() => {
                      setHeroInView(inView);
                    });
                  });
                }}
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
                    <Trans>
                      You're not logged in. Interactions (reply, boost, etc) are
                      not possible.
                    </Trans>
                  </p>
                  <Link
                    to={
                      DEFAULT_INSTANCE
                        ? `/login?instance=${DEFAULT_INSTANCE}&submit=1`
                        : '/login'
                    }
                    class="button"
                  >
                    <Trans>Log in</Trans>
                  </Link>
                </div>
              ) : (
                !sameInstance && (
                  <div class="post-status-banner">
                    <p>
                      <Trans>
                        This post is from another instance (<b>{instance}</b>).
                        Interactions (reply, boost, etc) are not possible.
                      </Trans>
                    </p>
                    <button
                      type="button"
                      disabled={uiState === 'loading'}
                      onClick={() => {
                        setUIState('loading');
                        (async () => {
                          try {
                            const results = await currentMasto.v2.search.list({
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
                            alert(t`Error: ${e}`);
                            console.error(e);
                          }
                        })();
                      }}
                    >
                      <Icon icon="transfer" />{' '}
                      <Trans>
                        Switch to my instance to enable interactions
                      </Trans>
                    </button>
                  </div>
                )
              )}
            </>
          ) : (
            <StatusParent
              linkable={isLinkable}
              to={instance ? `/${instance}/s/${statusID}` : `/s/${statusID}`}
              onClick={() => {
                resetScrollPosition(statusID);
              }}
            >
              {/* <Link
              class="status-link"
              to={instance ? `/${instance}/s/${statusID}` : `/s/${statusID}`}
              onClick={() => {
                resetScrollPosition(statusID);
              }}
            > */}
              {i === 0 && ancestor ? (
                <InView
                  threshold={0.5}
                  onChange={(inView) => {
                    queueMicrotask(() => {
                      requestAnimationFrame(() => {
                        setReachTopPost(inView);
                      });
                    });
                  }}
                >
                  <Status
                    statusID={statusID}
                    instance={instance}
                    withinContext
                    size={thread || ancestor ? 'm' : 's'}
                    enableTranslate
                    onMediaClick={handleMediaClick}
                    onStatusLinkClick={handleStatusLinkClick}
                  />
                </InView>
              ) : (
                <Status
                  statusID={statusID}
                  instance={instance}
                  withinContext
                  size={thread || ancestor ? 'm' : 's'}
                  enableTranslate
                  onMediaClick={handleMediaClick}
                  onStatusLinkClick={handleStatusLinkClick}
                  showActionsBar={!!descendant}
                />
              )}
              {ancestor && repliesCount > 1 && (
                <div class="replies-link">
                  <Icon icon="comment2" alt={t`Replies`} />{' '}
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
            </StatusParent>
            // </Link>
          )}
          {descendant && replies?.length > 0 && (
            <SubComments
              instance={instance}
              replies={replies}
              hasParentThread={thread}
              level={level}
              accWeight={weight}
              openAll={totalDescendants.current < SUBCOMMENTS_OPEN_ALL_LIMIT}
              parentLink={{
                to: instance ? `/${instance}/s/${statusID}` : `/s/${statusID}`,
                onClick: () => resetScrollPosition(statusID),
              }}
            />
          )}
          {uiState === 'loading' &&
            isHero &&
            !!heroStatus?.repliesCount &&
            !hasDescendants && (
              <div class="status-loading">
                <Loader abrupt={heroStatus.repliesCount >= 3} />
              </div>
            )}
          {uiState === 'error' &&
            isHero &&
            !!heroStatus?.repliesCount &&
            !hasDescendants && (
              <div class="status-error">
                <Trans>Unable to load replies.</Trans>
                <br />
                <button
                  type="button"
                  class="plain"
                  onClick={() => {
                    states.reloadStatusPage++;
                  }}
                >
                  <Trans>Try again</Trans>
                </button>
              </div>
            )}
        </li>
      );
    },
    [
      id,
      instance,
      uiState,
      authenticated,
      sameInstance,
      translate,
      handleMediaClick,
      handleStatusLinkClick,
      hasDescendants,
    ],
  );

  const prevLocationIsStatusPage = useMemo(() => {
    // Navigation API
    if ('navigation' in window && navigation?.entries) {
      const prevEntry = navigation.entries()[navigation.currentEntry.index - 1];
      if (prevEntry?.url) {
        return STATUS_URL_REGEX.test(prevEntry.url);
      }
    }
    return STATUS_URL_REGEX.test(states.prevLocation?.pathname);
  }, [sKey]);

  const moreStatusesKeys = useMemo(() => {
    if (!showMore) return [];
    const ids = [];
    function getIDs(status) {
      ids.push(status.id);
      if (status.replies) {
        status.replies.forEach(getIDs);
      }
    }
    statuses.slice(limit).forEach(getIDs);
    return ids.map((id) => statusKey(id, instance));
  }, [showMore, statuses, limit, instance]);

  // Helper function to format time differences between two dates
  function formatTimeGap(months) {
    if (months < 12) {
      return plural(months, {
        one: '# month later',
        other: '# months later',
      });
    } else {
      const years = Math.floor(months / 12);
      return plural(years, {
        one: '# year later',
        other: '# years later',
      });
    }
  }

  const statusesList = useMemo(() => {
    const result = [];
    const slicedStatuses = statuses.slice(0, limit);

    for (let i = 0; i < slicedStatuses.length; i++) {
      const status = slicedStatuses[i];

      // Add time gap indicator if needed
      if (i > 0) {
        const prevStatus = slicedStatuses[i - 1];

        const { createdAt, descendant, thread, id } = status;

        if (prevStatus?.createdAt && createdAt) {
          const currentDate = Date.parse(createdAt);
          if (isFinite(currentDate) && currentDate > MONTH_IN_MS) {
            const prevDate = Date.parse(prevStatus.createdAt);

            if (prevDate && isFinite(prevDate)) {
              const { ancestor, id: prevID } = prevStatus;
              const timeDiff = currentDate - prevDate;
              const monthsDiff = ~~(timeDiff / MONTH_IN_MS);

              if (monthsDiff > 0) {
                result.push(
                  <li
                    key={`time-gap-${id}-${prevID}`}
                    style={{
                      '--time-gap-range': Math.min(12, monthsDiff),
                    }}
                    class={`time-gap ${ancestor ? 'ancestor' : ''} ${descendant ? 'descendant' : ''} ${
                      thread ? 'thread' : ''
                    }`}
                  >
                    {formatTimeGap(monthsDiff)}
                  </li>,
                );
              } else {
                // NOTE: For testing purposes
                // result.push(
                //   <li
                //     key={`time-gap-${id}`}
                //     class={`time-gap ${ancestor ? 'ancestor' : ''} ${descendant ? 'descendant' : ''} ${
                //       thread ? 'thread' : ''
                //     }`}
                //   >
                //     One eternity later
                //   </li>,
                // );
              }
            }
          }
        }
      }

      result.push(renderStatus(status, i));
    }

    return result;
  }, [statuses, limit, renderStatus, editHistoryMode, editedAtIndex]);

  // If there's spoiler in hero status, auto-expand it
  useEffect(() => {
    let timer = setTimeout(() => {
      if (!heroStatusRef.current) return;
      const spoilerButton = heroStatusRef.current.querySelector(
        '.spoiler-button:not(.spoiling), .spoiler-media-button:not(.spoiling)',
      );
      if (spoilerButton) spoilerButton.click();
    }, 1000);
    return () => clearTimeout(timer);
  }, [id]);

  return (
    <ThreadCountContext.Provider value={threadsCount}>
      <div
        tabIndex="-1"
        ref={scrollableRef}
        class={`status-deck deck contained ${
          statuses.length > 1 ? 'padded-bottom' : ''
        } ${
          initialPageState.current === 'status' && !firstLoad.current
            ? 'slide-in'
            : ''
        } ${viewMode ? `deck-view-${viewMode}` : ''} ${
          editHistoryMode ? 'edit-history-mode' : ''
        }`}
        style={
          editHistoryMode
            ? {
                '--edit-history-percentage': `${editedAtIndex / (editHistoryRef.current.length - 1)}`,
              }
            : undefined
        }
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
          class={`${uiState === 'loading' ? 'loading' : ''}`}
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
              {prevLocationIsStatusPage && (
                <button
                  type="button"
                  class="plain deck-back"
                  onClick={() => {
                    history.back();
                  }}
                >
                  <Icon icon="chevron-left" size="xl" alt={t`Back`} />
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
                    title={t`Go to main post`}
                  >
                    <Icon
                      icon={heroPointer === 'down' ? 'arrow-down' : 'arrow-up'}
                    />
                  </button>
                </>
              ) : (
                <>
                  <Trans id="post.title">Post</Trans>{' '}
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
                    hidden={!ancestors.length || reachTopPost}
                    title={t`${ancestors.length} posts above ‒ Go to top`}
                  >
                    <Icon icon="arrow-up" />
                    {ancestors
                      .filter(
                        (a, i, arr) =>
                          arr.findIndex((b) => b.accountID === a.accountID) ===
                          i,
                      )
                      .slice(0, 3)
                      .map((ancestor) => (
                        <Avatar
                          key={ancestor.account.id}
                          url={
                            ancestor.account.avatarStatic ||
                            ancestor.account.avatar
                          }
                          alt={ancestor.account.displayName}
                          squircle={ancestor.account?.bot}
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
              <button
                type="button"
                class="plain4 button-switch-view"
                style={{
                  display: viewMode === 'full' ? '' : 'none',
                }}
                onClick={() => {
                  setViewMode(null);
                  searchParams.delete('media');
                  searchParams.delete('media-only');
                  searchParams.delete('view');
                  setSearchParams(searchParams);
                }}
                title={t`Switch to Side Peek view`}
              >
                <Icon icon="layout4" size="l" />
              </button>
              {showRefresh && (
                <button
                  type="button"
                  class="plain button-refresh"
                  onClick={() => {
                    states.reloadStatusPage++;
                    setShowRefresh(false);
                  }}
                >
                  <Icon icon="refresh" size="l" alt={t`Refresh`} />
                </button>
              )}
              <Menu2
                align="end"
                portal={{
                  // Need this, else the menu click will cause scroll jump
                  target: scrollableRef.current,
                }}
                menuButton={
                  <button type="button" class="button plain4">
                    <Icon icon="more" alt={t`More`} size="xl" />
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
                  <span>
                    <Trans>Refresh</Trans>
                  </span>
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
                    {viewMode === 'full'
                      ? t`Switch to Side Peek view`
                      : t`Switch to Full view`}
                  </span>
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    // Click all buttons with class .spoiler but not .spoiling
                    const buttons = Array.from(
                      scrollableRef.current.querySelectorAll(
                        '.spoiler-button:not(.spoiling), .spoiler-media-button:not(.spoiling)',
                      ),
                    );
                    buttons.forEach((button) => {
                      button.click();
                    });
                  }}
                >
                  <Icon icon="eye-open" />{' '}
                  <span>
                    <Trans>Show all sensitive content</Trans>
                  </span>
                </MenuItem>
                <MenuDivider />
                <MenuHeader className="plain">
                  <Trans>Experimental</Trans>
                </MenuHeader>
                <MenuItem
                  disabled={!postInstance || postSameInstance}
                  onClick={() => {
                    const statusURL = getInstanceStatusURL(heroStatus.url);
                    if (statusURL) {
                      location.hash = statusURL;
                    } else {
                      alert(t`Unable to switch`);
                    }
                  }}
                >
                  <Icon icon="transfer" />
                  <small class="menu-double-lines">
                    {postInstance
                      ? t`Switch to post's instance (${punycode.toUnicode(
                          postInstance,
                        )})`
                      : t`Switch to post's instance`}
                  </small>
                </MenuItem>
                <MenuItem
                  disabled={
                    !sameInstance ||
                    uiState === 'loading' ||
                    !heroStatus?.editedAt ||
                    !totalDescendants.current
                  }
                  onClick={initEditHistory}
                >
                  <Icon icon="edit" />
                  <span>{t`View Edit History Snapshots`}</span>
                </MenuItem>
              </Menu2>
              <Link class="button plain deck-close" to={closeLink}>
                <Icon icon="x" size="xl" alt={t`Close`} />
              </Link>
            </div>
          </div>
        </header>
        <EditHistoryControls />
        {!!statuses.length && heroStatus ? (
          <ul
            class={`timeline flat contextual grow ${
              uiState === 'loading' ? 'loading' : ''
            }`}
          >
            {statusesList}
            {showMore > 0 && (
              <li class="descendant descendant-more">
                <button
                  type="button"
                  class="plain block show-more"
                  disabled={uiState === 'loading'}
                  onClick={() => setLimit((l) => l + LIMIT)}
                  style={{ marginBlockEnd: '6em' }}
                  data-state-post-ids={moreStatusesKeys.join(' ')}
                >
                  <div class="ib avatars-bunch">
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
                    <Trans>Show more…</Trans>{' '}
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
                <Trans>Unable to load post</Trans>
                <br />
                <br />
                <button
                  type="button"
                  onClick={() => {
                    states.reloadStatusPage++;
                  }}
                >
                  <Trans>Try again</Trans>
                </button>
              </p>
            )}
          </>
        )}
      </div>
    </ThreadCountContext.Provider>
  );
}

function SubComments({
  replies,
  instance,
  hasParentThread,
  level,
  accWeight,
  openAll,
  parentLink,
}) {
  const { t } = useLingui();
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
      // NOTE: this scrollLeft works for RTL too
      // Browsers do the magic for us
      e.target.dataset.scrollLeft = e.target.scrollLeft;
    }
    detailsRef.current?.addEventListener('scroll', handleScroll, {
      passive: true,
    });
    return () => {
      detailsRef.current?.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // If not open, delay render replies
  const [renderReplies, setRenderReplies] = useState(openBefore || open);
  useEffect(() => {
    let timer;
    if (!openBefore && !open) {
      timer = setTimeout(() => setRenderReplies(true), 100);
    }
    return () => clearTimeout(timer);
  }, [openBefore, open]);

  const Container = open ? 'div' : 'details';
  const isDetails = Container === 'details';

  return (
    <Container
      ref={detailsRef}
      class="replies"
      open={isDetails ? openBefore || open : undefined}
      onToggle={
        isDetails
          ? (e) => {
              const { open } = e.target;
              // use first reply as ID
              cachedRepliesToggle[replies[0].id] = open;
            }
          : undefined
      }
      style={{
        '--comments-level': level,
      }}
      data-comments-level={level}
      data-comments-level-overflow={level > 4}
    >
      {!open && (
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
          <span class="replies-counts">
            <b>
              <Plural
                value={replies.length}
                one="# reply"
                other={
                  <Trans>
                    <span title={replies.length}>
                      {shortenNumber(replies.length)}
                    </span>{' '}
                    replies
                  </Trans>
                }
              />
            </b>
            {!sameCount && totalComments > 1 && (
              <>
                {' '}
                &middot;{' '}
                <span>
                  <Plural
                    value={totalComments}
                    one="# comment"
                    other={
                      <Trans>
                        <span title={totalComments}>
                          {shortenNumber(totalComments)}
                        </span>{' '}
                        comments
                      </Trans>
                    }
                  />
                </span>
              </>
            )}
          </span>
          <Icon icon="chevron-down" class="replies-summary-chevron" />
          {!!parentLink && (
            <Link
              class="replies-parent-link"
              to={parentLink.to}
              onClick={parentLink.onClick}
              title={t`View post with its replies`}
            >
              &raquo;
            </Link>
          )}
        </summary>
      )}
      {renderReplies && (
        <ul>
          {replies.map((r) => (
            <li key={r.id}>
              {/* <Link
              class="status-link"
              to={instance ? `/${instance}/s/${r.id}` : `/s/${r.id}`}
              onClick={() => {
                resetScrollPosition(r.id);
              }}
            > */}
              <div class="status-focus" tabIndex={0}>
                <Status
                  statusID={r.id}
                  instance={instance}
                  withinContext
                  size="s"
                  enableTranslate
                  onMediaClick={handleMediaClick}
                  showActionsBar
                />
                {!r.replies?.length && r.repliesCount > 0 && (
                  <div class="replies-link">
                    <Icon icon="comment2" alt={t`Replies`} />{' '}
                    <span title={r.repliesCount}>
                      {shortenNumber(r.repliesCount)}
                    </span>
                  </div>
                )}
              </div>
              {/* </Link> */}
              {r.replies?.length && (
                <SubComments
                  instance={instance}
                  replies={r.replies}
                  level={r.level}
                  accWeight={!open ? r.weight : totalWeight}
                  openAll={openAll}
                  parentLink={{
                    to: instance ? `/${instance}/s/${r.id}` : `/s/${r.id}`,
                    onClick: () => {
                      resetScrollPosition(r.id);
                    },
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </Container>
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
