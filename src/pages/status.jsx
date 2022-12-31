import './status.css';

import debounce from 'just-debounce-it';
import { route } from 'preact-router';
import { Link } from 'preact-router/match';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import { useHotkeys } from 'react-hotkeys-hook';
import { InView } from 'react-intersection-observer';
import { useSnapshot } from 'valtio';

import Icon from '../components/icon';
import Loader from '../components/loader';
import NameText from '../components/name-text';
import Status from '../components/status';
import htmlContentLength from '../utils/html-content-length';
import shortenNumber from '../utils/shorten-number';
import states from '../utils/states';
import store from '../utils/store';
import useDebouncedCallback from '../utils/useDebouncedCallback';
import useTitle from '../utils/useTitle';

const LIMIT = 40;

function StatusPage({ id }) {
  const snapStates = useSnapshot(states);
  const [statuses, setStatuses] = useState([]);
  const [uiState, setUIState] = useState('default');
  const userInitiated = useRef(true); // Initial open is user-initiated
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
      states.scrollPositions.set(id, scrollTop);
    }, 100);
    scrollableRef.current.addEventListener('scroll', onScroll, {
      passive: true,
    });
    onScroll();
    return () => {
      scrollableRef.current?.removeEventListener('scroll', onScroll);
    };
  }, [id]);

  useEffect(() => {
    setUIState('loading');
    let heroTimer;

    const cachedStatuses = store.session.getJSON('statuses-' + id);
    if (cachedStatuses) {
      // Case 1: It's cached, let's restore them to make it snappy
      const reallyCachedStatuses = cachedStatuses.filter(
        (s) => states.statuses.has(s.id),
        // Some are not cached in the global state, so we need to filter them out
      );
      setStatuses(reallyCachedStatuses);
    } else {
      const heroIndex = statuses.findIndex((s) => s.id === id);
      if (heroIndex !== -1) {
        // Case 2: It's in current statuses. Slice off all descendant statuses after the hero status to be safe
        const slicedStatuses = statuses.slice(0, heroIndex + 1);
        setStatuses(slicedStatuses);
      } else {
        // Case 3: Not cached and not in statuses, let's start from scratch
        setStatuses([{ id }]);
      }
    }

    (async () => {
      const heroFetch = () => masto.v1.statuses.fetch(id);
      const contextFetch = masto.v1.statuses.fetchContext(id);

      const hasStatus = snapStates.statuses.has(id);
      let heroStatus = snapStates.statuses.get(id);
      if (hasStatus) {
        console.log('Hero status is cached');
        // NOTE: This might conflict if the user interacts with the status before the fetch is done, e.g. favouriting it
        // heroTimer = setTimeout(async () => {
        //   try {
        //     heroStatus = await heroFetch();
        //     states.statuses.set(id, heroStatus);
        //   } catch (e) {
        //     // Silent fail if status is cached
        //     console.error(e);
        //   }
        // }, 1000);
      } else {
        try {
          heroStatus = await heroFetch();
          states.statuses.set(id, heroStatus);
        } catch (e) {
          console.error(e);
          setUIState('error');
          alert('Error fetching status');
          return;
        }
      }

      try {
        const context = await contextFetch;
        const { ancestors, descendants } = context;

        ancestors.forEach((status) => {
          states.statuses.set(status.id, status);
        });
        const nestedDescendants = [];
        descendants.forEach((status) => {
          states.statuses.set(status.id, status);
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
        console.log({ allStatuses });
        setStatuses(allStatuses);
        store.session.setJSON('statuses-' + id, allStatuses);
      } catch (e) {
        console.error(e);
        setUIState('error');
      }
    })();

    return () => {
      clearTimeout(heroTimer);
    };
  }, [id, snapStates.reloadStatusPage]);

  const firstLoad = useRef(true);

  useLayoutEffect(() => {
    if (!statuses.length) return;
    const isLoading = uiState === 'loading';
    if (userInitiated.current) {
      const hasAncestors = statuses.findIndex((s) => s.id === id) > 0; // Cannot use `ancestor` key because the hero state is dynamic
      if (!isLoading && hasAncestors) {
        // Case 1: User initiated, has ancestors, after statuses are loaded, SNAP to hero status
        console.log('Case 1');
        heroStatusRef.current?.scrollIntoView();
      } else if (isLoading && statuses.length > 1) {
        if (firstLoad.current) {
          // Case 2.1: User initiated, first load, don't smooth scroll anything
          console.log('Case 2.1');
          heroStatusRef.current?.scrollIntoView();
        } else {
          // Case 2.2: User initiated, while statuses are loading, SMOOTH-SCROLL to hero status
          console.log('Case 2.2');
          heroStatusRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }
      }
    } else {
      const scrollPosition = states.scrollPositions.get(id);
      if (scrollPosition && scrollableRef.current) {
        // Case 3: Not user initiated (e.g. back/forward button), restore to saved scroll position
        console.log('Case 3');
        scrollableRef.current.scrollTop = scrollPosition;
      }
    }
    console.log('No case', {
      isLoading,
      userInitiated: userInitiated.current,
      statusesLength: statuses.length,
      firstLoad: firstLoad.current,
      // scrollPosition,
    });

    if (!isLoading) {
      // Reset user initiated flag after statuses are loaded
      userInitiated.current = false;
      firstLoad.current = false;
    }
  }, [statuses, uiState]);

  const heroStatus = snapStates.statuses.get(id);
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

  const prevRoute = states.history.findLast((h) => {
    return h === '/' || /notifications/i.test(h);
  });
  const closeLink = `#${prevRoute || '/'}`;

  const [limit, setLimit] = useState(LIMIT);
  const showMore = useMemo(() => {
    // return number of statuses to show
    return statuses.length - limit;
  }, [statuses.length, limit]);

  const hasManyStatuses = statuses.length > LIMIT;
  const hasDescendants = statuses.some((s) => s.descendant);

  const [heroInView, setHeroInView] = useState(true);
  const onView = useDebouncedCallback(setHeroInView, 100);
  const heroPointer = useMemo(() => {
    // get top offset of heroStatus
    if (!heroStatusRef.current || heroInView) return null;
    const { top } = heroStatusRef.current.getBoundingClientRect();
    return top > 0 ? 'down' : 'up';
  }, [heroInView]);

  useHotkeys(['esc', 'backspace'], () => {
    route(closeLink);
  });

  return (
    <div class="deck-backdrop">
      <Link href={closeLink}></Link>
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
                  <relative-time
                    datetime={heroStatus.createdAt}
                    format="micro"
                    threshold="P1D"
                    prefix=""
                  />
                </span>
              </span>
            ) : (
              'Status'
            )}
          </h1>
          <div class="header-side">
            <Loader hidden={uiState !== 'loading'} />
            <Link class="button plain deck-close" href={closeLink}>
              <Icon icon="x" size="xl" />
            </Link>
          </div>
        </header>
        <ul
          class={`timeline flat contextual ${
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
                    class="
                status-link
              "
                    href={`#/s/${statusID}`}
                    onClick={() => {
                      userInitiated.current = true;
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
                      onStatusLinkClick={() => {
                        userInitiated.current = true;
                      }}
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
      </div>
    </div>
  );
}

function SubComments({
  hasManyStatuses,
  replies,
  onStatusLinkClick = () => {},
}) {
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
              href={`#/s/${r.id}`}
              onClick={onStatusLinkClick}
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
