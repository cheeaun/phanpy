import './status.css';

import { Menu, MenuItem } from '@szhsin/react-menu';
import debounce from 'just-debounce-it';
import pRetry from 'p-retry';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useHotkeys } from 'react-hotkeys-hook';
import { InView } from 'react-intersection-observer';
import { matchPath, useNavigate, useParams } from 'react-router-dom';
import { useDebouncedCallback } from 'use-debounce';
import { useSnapshot } from 'valtio';

import Avatar from '../components/avatar';
import Icon from '../components/icon';
import Link from '../components/link';
import Loader from '../components/loader';
import NameText from '../components/name-text';
import RelativeTime from '../components/relative-time';
import Status from '../components/status';
import { api } from '../utils/api';
import htmlContentLength from '../utils/html-content-length';
import shortenNumber from '../utils/shorten-number';
import states, {
  saveStatus,
  statusKey,
  threadifyStatus,
} from '../utils/states';
import { getCurrentAccount } from '../utils/store-utils';
import useScroll from '../utils/useScroll';
import useTitle from '../utils/useTitle';

const LIMIT = 40;
const THREAD_LIMIT = 20;

let cachedStatusesMap = {};
function resetScrollPosition(id) {
  delete cachedStatusesMap[id];
  delete states.scrollPositions[id];
}

function StatusPage() {
  const { id, ...params } = useParams();
  const { masto, instance, authenticated } = api({ instance: params.instance });
  const navigate = useNavigate();
  const snapStates = useSnapshot(states);
  const [statuses, setStatuses] = useState([]);
  const [uiState, setUIState] = useState('default');
  const heroStatusRef = useRef();
  const sKey = statusKey(id, instance);

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
    }, 100);
    scrollableRef.current.addEventListener('scroll', onScroll, {
      passive: true,
    });
    onScroll();
    return () => {
      onScroll.flush();
      scrollableRef.current?.removeEventListener('scroll', onScroll);
    };
  }, [id, uiState !== 'loading']);

  const scrollOffsets = useRef();
  const initContext = () => {
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
      if (hasStatus) {
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

        ancestors.forEach((status) => {
          saveStatus(status, instance, {
            skipThreading: true,
          });
        });
        const nestedDescendants = [];
        descendants.forEach((status) => {
          saveStatus(status, instance, {
            skipThreading: true,
          });
          if (status.inReplyToAccountId === status.account.id) {
            // If replying to self, it's part of the thread, level 1
            nestedDescendants.push(status);
          } else if (status.inReplyToId === heroStatus.id) {
            // If replying to the hero status, it's a reply, level 1
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

        const allStatuses = [
          ...ancestors.map((s) => ({
            id: s.id,
            ancestor: true,
            accountID: s.account.id,
          })),
          { id, accountID: heroStatus.account.id },
          ...nestedDescendants.map((s) => ({
            id: s.id,
            accountID: s.account.id,
            descendant: true,
            thread: s.account.id === heroStatus.account.id,
            replies: s.__replies?.map((r) => ({
              id: r.id,
              account: r.account,
              repliesCount: r.repliesCount,
              content: r.content,
              replies: r.__replies?.map((r2) => ({
                // Level 3
                id: r2.id,
                account: r2.account,
                repliesCount: r2.repliesCount,
                content: r2.content,
                replies: r2.__replies?.map((r3) => ({
                  // Level 4
                  id: r3.id,
                  account: r3.account,
                  repliesCount: r3.repliesCount,
                  content: r3.content,
                })),
              })),
            })),
          })),
        ];

        setUIState('default');
        scrollOffsets.current = {
          offsetTop: heroStatusRef.current?.offsetTop,
          scrollTop: scrollableRef.current?.scrollTop,
        };
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
    const scrollPosition = states.scrollPositions[id];
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

        return initContext();
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
    const { spoilerText, content } = heroStatus;
    let text;
    if (spoilerText) {
      text = spoilerText;
    } else {
      const div = document.createElement('div');
      div.innerHTML = content;
      text = div.innerText.trim();
    }
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

  const closeLink = useMemo(() => {
    const { prevLocation } = snapStates;
    const pathname = prevLocation?.pathname + (prevLocation?.search || '');
    if (
      !pathname ||
      matchPath('/:instance/s/:id', pathname) ||
      matchPath('/s/:id', pathname)
    ) {
      return '/';
    }
    return pathname;
  }, []);
  const onClose = () => {
    states.showMediaModal = false;
  };

  const [limit, setLimit] = useState(LIMIT);
  const showMore = useMemo(() => {
    // return number of statuses to show
    return statuses.length - limit;
  }, [statuses.length, limit]);

  const hasManyStatuses = statuses.length > THREAD_LIMIT;
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

  useHotkeys(['esc', 'backspace'], () => {
    // location.hash = closeLink;
    onClose();
    navigate(closeLink);
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
    scrollableElement: scrollableRef.current,
    distanceFromStart: 0.2,
  });

  return (
    <div class="deck-backdrop">
      <Link to={closeLink} onClick={onClose}></Link>
      <div
        tabIndex="-1"
        ref={scrollableRef}
        class={`status-deck deck contained ${
          statuses.length > 1 ? 'padded-bottom' : ''
        }`}
      >
        <header
          class={`${heroInView ? 'inview' : ''}`}
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
                  >
                    <Icon
                      icon={heroPointer === 'down' ? 'arrow-down' : 'arrow-up'}
                    />
                  </button>
                </>
              ) : (
                <>
                  Status{' '}
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
                  >
                    <Icon icon="arrow-up" />
                    <Icon icon="comment" />{' '}
                    <span class="insignificant">
                      {shortenNumber(ancestors.length)}
                    </span>
                  </button>
                </>
              )}
            </h1>
            <div class="header-side">
              {uiState === 'loading' ? (
                <Loader abrupt />
              ) : (
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
                    <Icon icon="eye-open" />{' '}
                    <span>Show all sensitive content</span>
                  </MenuItem>
                  {import.meta.env.DEV && !authenticated && (
                    <MenuItem
                      onClick={() => {
                        (async () => {
                          try {
                            const { masto } = api();
                            const results = await masto.v2.search({
                              q: heroStatus.url,
                              type: 'statuses',
                              resolve: true,
                              limit: 1,
                            });
                            if (results.statuses.length) {
                              const status = results.statuses[0];
                              navigate(`/s/${status.id}`);
                            } else {
                              throw new Error('No results');
                            }
                          } catch (e) {
                            alert('Error: ' + e);
                            console.error(e);
                          }
                        })();
                      }}
                    >
                      See post in currently logged-in instance
                    </MenuItem>
                  )}
                </Menu>
              )}
              <Link
                class="button plain deck-close"
                to={closeLink}
                onClick={onClose}
              >
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
                descendant,
                thread,
                replies,
              } = status;
              const isHero = statusID === id;
              return (
                <li
                  key={statusID}
                  ref={isHero ? heroStatusRef : null}
                  class={`${ancestor ? 'ancestor' : ''} ${
                    descendant ? 'descendant' : ''
                  } ${thread ? 'thread' : ''} ${isHero ? 'hero' : ''}`}
                >
                  {isHero ? (
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
                      />
                    </InView>
                  ) : (
                    <Link
                      class="status-link"
                      to={
                        instance
                          ? `/${instance}/s/${statusID}`
                          : `/s/${statusID}`
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
                      />
                      {/* {replies?.length > LIMIT && (
                        <div class="replies-link">
                          <Icon icon="comment" />{' '}
                          <span title={replies.length}>
                            {shortenNumber(replies.length)}
                          </span>
                        </div>
                      )} */}
                    </Link>
                  )}
                  {descendant && replies?.length > 0 && (
                    <SubComments
                      instance={instance}
                      hasManyStatuses={hasManyStatuses}
                      replies={replies}
                      hasParentThread={thread}
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
                  class="plain block"
                  disabled={uiState === 'loading'}
                  onClick={() => setLimit((l) => l + LIMIT)}
                  style={{ marginBlockEnd: '6em' }}
                >
                  Show more&hellip;{' '}
                  <span class="tag">
                    {showMore > LIMIT ? `${LIMIT}+` : showMore}
                  </span>
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
                Unable to load status
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
    </div>
  );
}

function SubComments({ hasManyStatuses, replies, instance, hasParentThread }) {
  // Set isBrief = true:
  // - if less than or 2 replies
  // - if replies have no sub-replies
  // - if total number of characters of content from replies is less than 500
  let isBrief = false;
  if (replies.length <= 2) {
    const containsSubReplies = replies.some(
      (r) => r.repliesCount > 0 || r.replies?.length > 0,
    );
    if (!containsSubReplies) {
      let totalLength = replies.reduce((acc, reply) => {
        const { content } = reply;
        const length = htmlContentLength(content);
        return acc + length;
      }, 0);
      isBrief = totalLength < 500;
    }
  }

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

  const open =
    (!hasParentThread || replies.length === 1) && (isBrief || !hasManyStatuses);

  return (
    <details class="replies" open={open}>
      <summary hidden={open}>
        <span class="avatars">
          {accounts.map((a) => (
            <Avatar
              key={a.id}
              url={a.avatarStatic}
              title={`${a.displayName} @${a.username}`}
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
              <Status
                statusID={r.id}
                instance={instance}
                withinContext
                size="s"
              />
              {!r.replies?.length && r.repliesCount > 0 && (
                <div class="replies-link">
                  <Icon icon="comment" />{' '}
                  <span title={r.repliesCount}>
                    {shortenNumber(r.repliesCount)}
                  </span>
                </div>
              )}
            </Link>
            {r.replies?.length && (
              <SubComments
                instance={instance}
                hasManyStatuses={hasManyStatuses}
                replies={r.replies}
              />
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

export default StatusPage;
