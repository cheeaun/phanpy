import './status.css';

import debounce from 'just-debounce-it';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useHotkeys } from 'react-hotkeys-hook';
import { InView } from 'react-intersection-observer';
import { useLocation, useParams } from 'react-router-dom';
import { useSnapshot } from 'valtio';

import Icon from '../components/icon';
import Link from '../components/link';
import Loader from '../components/loader';
import NameText from '../components/name-text';
import RelativeTime from '../components/relative-time';
import Status from '../components/status';
import htmlContentLength from '../utils/html-content-length';
import shortenNumber from '../utils/shorten-number';
import states, { saveStatus, threadifyStatus } from '../utils/states';
import { getCurrentAccount } from '../utils/store-utils';
import useDebouncedCallback from '../utils/useDebouncedCallback';
import useScroll from '../utils/useScroll';
import useTitle from '../utils/useTitle';

const LIMIT = 40;

let cachedStatusesMap = {};
function resetScrollPosition(id) {
  delete cachedStatusesMap[id];
  delete states.scrollPositions[id];
}

function StatusPage() {
  const { id } = useParams();
  const location = useLocation();
  const snapStates = useSnapshot(states);
  const [statuses, setStatuses] = useState([]);
  const [uiState, setUIState] = useState('default');
  const heroStatusRef = useRef();

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
      onScroll.cancel();
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
        (s) => states.statuses[s.id],
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
      const heroFetch = () => masto.v1.statuses.fetch(id);
      const contextFetch = masto.v1.statuses.fetchContext(id);

      const hasStatus = !!snapStates.statuses[id];
      let heroStatus = snapStates.statuses[id];
      if (hasStatus) {
        console.debug('Hero status is cached');
      } else {
        try {
          heroStatus = await heroFetch();
          saveStatus(heroStatus);
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
          states.statuses[status.id] = status;
        });
        const nestedDescendants = [];
        descendants.forEach((status) => {
          states.statuses[status.id] = status;
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
              // If no parent, it's probably a reply to a reply to a reply, level 3
              console.warn('[LEVEL 3] No parent found for', status);
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
              repliesCount: r.repliesCount,
              content: r.content,
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
        threadifyStatus(heroStatus);
      } catch (e) {
        console.error(e);
        setUIState('error');
      }
    })();

    return () => {
      clearTimeout(heroTimer);
    };
  };

  useEffect(initContext, [id]);
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
        newScrollOffsets.offsetTop - scrollOffsets.current.offsetTop;
      console.debug('Case 2', {
        scrollOffsets: scrollOffsets.current,
        newScrollOffsets,
        newScrollTop,
        statuses: [...statuses],
      });
      scrollableRef.current.scrollTop = newScrollTop;
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

  const heroStatus = snapStates.statuses[id];
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
  );

  const closeLink = useMemo(() => {
    const pathname = snapStates.prevLocation?.pathname;
    if (!pathname || pathname.startsWith('/s/')) return '/';
    return pathname;
  }, []);

  const [limit, setLimit] = useState(LIMIT);
  const showMore = useMemo(() => {
    // return number of statuses to show
    return statuses.length - limit;
  }, [statuses.length, limit]);

  const hasManyStatuses = statuses.length > LIMIT;
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
    location.hash = closeLink;
  });

  const { nearReachStart } = useScroll({
    scrollableElement: scrollableRef.current,
    distanceFromStart: 0.5,
  });

  return (
    <div class="deck-backdrop">
      <Link to={closeLink}></Link>
      <div
        tabIndex="-1"
        ref={scrollableRef}
        class={`status-deck deck contained ${
          statuses.length > 1 ? 'padded-bottom' : ''
        }`}
      >
        <header
          class={`${heroInView ? 'inview' : ''}`}
          onClick={(e) => {
            if (
              !/^(a|button)$/i.test(e.target.tagName) &&
              heroStatusRef.current
            ) {
              heroStatusRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              });
            }
          }}
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
          <h1>
            {!heroInView && heroStatus && uiState !== 'loading' ? (
              <span class="hero-heading">
                {!!heroPointer && (
                  <>
                    <Icon
                      icon={heroPointer === 'down' ? 'arrow-down' : 'arrow-up'}
                    />{' '}
                  </>
                )}
                <NameText showAvatar account={heroStatus.account} short />{' '}
                <span class="insignificant">
                  &bull;{' '}
                  <RelativeTime
                    datetime={heroStatus.createdAt}
                    format="micro"
                  />
                </span>
              </span>
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
            <Loader hidden={uiState !== 'loading'} />
            <Link class="button plain deck-close" to={closeLink}>
              <Icon icon="x" size="xl" />
            </Link>
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
                    <InView threshold={0.1} onChange={onView}>
                      <Status statusID={statusID} withinContext size="l" />
                    </InView>
                  ) : (
                    <Link
                      class="status-link"
                      to={`/s/${statusID}`}
                      onClick={() => {
                        resetScrollPosition(statusID);
                      }}
                    >
                      <Status
                        statusID={statusID}
                        withinContext
                        size={thread || ancestor ? 'm' : 's'}
                      />
                      {replies?.length > LIMIT && (
                        <div class="replies-link">
                          <Icon icon="comment" />{' '}
                          <span title={replies.length}>
                            {shortenNumber(replies.length)}
                          </span>
                        </div>
                      )}
                    </Link>
                  )}
                  {descendant &&
                    replies?.length > 0 &&
                    replies?.length <= LIMIT && (
                      <SubComments
                        hasManyStatuses={hasManyStatuses}
                        replies={replies}
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

function SubComments({ hasManyStatuses, replies }) {
  // If less than or 2 replies and total number of characters of content from replies is less than 500
  let isBrief = false;
  if (replies.length <= 2) {
    let totalLength = replies.reduce((acc, reply) => {
      const { content } = reply;
      const length = htmlContentLength(content);
      return acc + length;
    }, 0);
    isBrief = totalLength < 500;
  }

  const open = isBrief || !hasManyStatuses;

  return (
    <details class="replies" open={open}>
      <summary hidden={open}>
        <span title={replies.length}>{shortenNumber(replies.length)}</span> repl
        {replies.length === 1 ? 'y' : 'ies'}
      </summary>
      <ul>
        {replies.map((r) => (
          <li key={r.id}>
            <Link
              class="status-link"
              to={`/s/${r.id}`}
              onClick={() => {
                resetScrollPosition(r.id);
              }}
            >
              <Status statusID={r.id} withinContext size="s" />
              {r.repliesCount > 0 && (
                <div class="replies-link">
                  <Icon icon="comment" />{' '}
                  <span title={r.repliesCount}>
                    {shortenNumber(r.repliesCount)}
                  </span>
                </div>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default StatusPage;
