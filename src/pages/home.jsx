import { Link } from 'preact-router/match';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useHotkeys } from 'react-hotkeys-hook';
import { InView } from 'react-intersection-observer';
import { useSnapshot } from 'valtio';

import Icon from '../components/icon';
import Loader from '../components/loader';
import Status from '../components/status';
import states from '../utils/states';

const LIMIT = 20;

function Home({ hidden }) {
  const snapStates = useSnapshot(states);
  const [uiState, setUIState] = useState('default');
  const [showMore, setShowMore] = useState(false);

  const homeIterator = useRef(
    masto.v1.timelines.listHome({
      limit: LIMIT,
    }),
  );
  async function fetchStatuses(firstLoad) {
    if (firstLoad) {
      // Reset iterator
      homeIterator.current = masto.v1.timelines.listHome({
        limit: LIMIT,
      });
    }
    const allStatuses = await homeIterator.current.next();
    if (allStatuses.value <= 0) {
      return { done: true };
    }
    const homeValues = allStatuses.value.map((status) => {
      states.statuses.set(status.id, status);
      if (status.reblog) {
        states.statuses.set(status.reblog.id, status.reblog);
      }
      return {
        id: status.id,
        reblog: status.reblog?.id,
        reply: !!status.inReplyToAccountId,
      };
    });
    if (firstLoad) {
      states.home = homeValues;
    } else {
      states.home.push(...homeValues);
    }
    states.homeLastFetchTime = Date.now();
    return allStatuses;
  }

  const loadStatuses = (firstLoad) => {
    setUIState('loading');
    (async () => {
      try {
        const { done } = await fetchStatuses(firstLoad);
        setShowMore(!done);
        setUIState('default');
      } catch (e) {
        console.warn(e);
        setUIState('error');
      }
    })();
  };

  useEffect(() => {
    loadStatuses(true);
  }, []);

  const scrollableRef = useRef();

  useHotkeys('j', () => {
    // focus on next status after active status
    // Traverses .timeline li .status-link, focus on .status-link
    const activeStatus = document.activeElement.closest('.status-link');
    const activeStatusRect = activeStatus?.getBoundingClientRect();
    if (
      activeStatus &&
      activeStatusRect.top < scrollableRef.current.clientHeight &&
      activeStatusRect.bottom > 0
    ) {
      const nextStatus = activeStatus.parentElement.nextElementSibling;
      if (nextStatus) {
        const statusLink = nextStatus.querySelector('.status-link');
        if (statusLink) {
          statusLink.focus();
        }
      }
    } else {
      // If active status is not in viewport, get the topmost status-link in viewport
      const statusLinks = document.querySelectorAll(
        '.timeline li .status-link',
      );
      let topmostStatusLink;
      for (const statusLink of statusLinks) {
        const statusLinkRect = statusLink.getBoundingClientRect();
        if (statusLinkRect.top >= 44) {
          // 44 is the magic number for header height, not real
          topmostStatusLink = statusLink;
          break;
        }
      }
      if (topmostStatusLink) {
        topmostStatusLink.focus();
      }
    }
  });

  useHotkeys('k', () => {
    // focus on previous status after active status
    // Traverses .timeline li .status-link, focus on .status-link
    const activeStatus = document.activeElement.closest('.status-link');
    const activeStatusRect = activeStatus?.getBoundingClientRect();
    if (
      activeStatus &&
      activeStatusRect.top < scrollableRef.current.clientHeight &&
      activeStatusRect.bottom > 0
    ) {
      const prevStatus = activeStatus.parentElement.previousElementSibling;
      if (prevStatus) {
        const statusLink = prevStatus.querySelector('.status-link');
        if (statusLink) {
          statusLink.focus();
        }
      }
    } else {
      // If active status is not in viewport, get the topmost status-link in viewport
      const statusLinks = document.querySelectorAll(
        '.timeline li .status-link',
      );
      let topmostStatusLink;
      for (const statusLink of statusLinks) {
        const statusLinkRect = statusLink.getBoundingClientRect();
        if (statusLinkRect.top >= 44) {
          // 44 is the magic number for header height, not real
          topmostStatusLink = statusLink;
          break;
        }
      }
      if (topmostStatusLink) {
        topmostStatusLink.focus();
      }
    }
  });

  useHotkeys(['enter', 'o'], () => {
    // open active status
    const activeStatus = document.activeElement.closest('.status-link');
    if (activeStatus) {
      activeStatus.click();
    }
  });

  return (
    <div
      id="home-page"
      class="deck-container"
      hidden={hidden}
      ref={scrollableRef}
      tabIndex="-1"
    >
      <div class="timeline-deck deck">
        <header
          onClick={() => {
            scrollableRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onDblClick={() => {
            loadStatuses(true);
          }}
        >
          <div class="header-side">
            <button
              type="button"
              class="plain"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                states.showSettings = true;
              }}
            >
              <Icon icon="gear" size="l" alt="Settings" />
            </button>
          </div>
          <h1>Home</h1>
          <div class="header-side">
            <Loader hidden={uiState !== 'loading'} />{' '}
            <a
              href="#/notifications"
              class={`button plain ${
                snapStates.notificationsNew.length > 0 ? 'has-badge' : ''
              }`}
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <Icon icon="notification" size="l" alt="Notifications" />
            </a>
          </div>
          {snapStates.homeNew.length > 0 && (
            <button
              class="updates-button"
              type="button"
              onClick={() => {
                const uniqueHomeNew = snapStates.homeNew.filter(
                  (status) => !states.home.some((s) => s.id === status.id),
                );
                states.home.unshift(...uniqueHomeNew);
                loadStatuses(true);
                states.homeNew = [];

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
        {snapStates.home.length ? (
          <>
            <ul class="timeline">
              {snapStates.home.map(({ id: statusID, reblog }) => {
                const actualStatusID = reblog || statusID;
                return (
                  <li key={statusID}>
                    <Link
                      activeClassName="active"
                      class="status-link"
                      href={`#/s/${actualStatusID}`}
                    >
                      <Status statusID={statusID} />
                    </Link>
                  </li>
                );
              })}
              {showMore && (
                <>
                  <InView
                    as="li"
                    style={{
                      height: '20vh',
                    }}
                    onChange={(inView) => {
                      if (inView) loadStatuses();
                    }}
                    root={scrollableRef.current}
                    rootMargin="100px 0px"
                  >
                    <Status skeleton />
                  </InView>
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
          </>
        ) : (
          <>
            {uiState === 'loading' && (
              <ul class="timeline">
                {Array.from({ length: 5 }).map((_, i) => (
                  <li key={i}>
                    <Status skeleton />
                  </li>
                ))}
              </ul>
            )}
            {uiState === 'error' && (
              <p class="ui-state">
                Unable to load statuses
                <br />
                <br />
                <button
                  type="button"
                  onClick={() => {
                    loadStatuses(true);
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

export default Home;
