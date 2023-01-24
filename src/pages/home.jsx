import { memo } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useHotkeys } from 'react-hotkeys-hook';
import { useSnapshot } from 'valtio';

import Icon from '../components/icon';
import Link from '../components/link';
import Loader from '../components/loader';
import Status from '../components/status';
import db from '../utils/db';
import states, { saveStatus } from '../utils/states';
import { getCurrentAccountNS } from '../utils/store-utils';
import useDebouncedCallback from '../utils/useDebouncedCallback';
import useScroll from '../utils/useScroll';

const LIMIT = 20;

function Home({ hidden }) {
  const snapStates = useSnapshot(states);
  const [uiState, setUIState] = useState('default');
  const [showMore, setShowMore] = useState(false);

  console.debug('RENDER Home');

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
      states.homeNew = [];
    }
    const allStatuses = await homeIterator.current.next();
    if (allStatuses.value?.length) {
      const homeValues = allStatuses.value.map((status) => {
        saveStatus(status);
        return {
          id: status.id,
          reblog: status.reblog?.id,
          reply: !!status.inReplyToAccountId,
        };
      });

      // BOOSTS CAROUSEL
      if (snapStates.settings.boostsCarousel) {
        let specialHome = [];
        let boostStash = [];
        let serialBoosts = 0;
        for (let i = 0; i < homeValues.length; i++) {
          const status = homeValues[i];
          if (status.reblog) {
            boostStash.push(status);
            serialBoosts++;
          } else {
            specialHome.push(status);
            if (serialBoosts < 3) {
              serialBoosts = 0;
            }
          }
        }
        // if boostStash is more than quarter of homeValues
        // or if there are 3 or more boosts in a row
        if (boostStash.length > homeValues.length / 4 || serialBoosts >= 3) {
          // if boostStash is more than 3 quarter of homeValues
          const boostStashID = boostStash.map((status) => status.id);
          if (boostStash.length > (homeValues.length * 3) / 4) {
            // insert boost array at the end of specialHome list
            specialHome = [
              ...specialHome,
              { id: boostStashID, boosts: boostStash },
            ];
          } else {
            // insert boosts array in the middle of specialHome list
            const half = Math.floor(specialHome.length / 2);
            specialHome = [
              ...specialHome.slice(0, half),
              {
                id: boostStashID,
                boosts: boostStash,
              },
              ...specialHome.slice(half),
            ];
          }
        } else {
          // Untouched, this is fine
          specialHome = homeValues;
        }
        console.log({
          specialHome,
        });
        if (firstLoad) {
          states.home = specialHome;
        } else {
          states.home.push(...specialHome);
        }
      } else {
        if (firstLoad) {
          states.home = homeValues;
        } else {
          states.home.push(...homeValues);
        }
      }
    }

    states.homeLastFetchTime = Date.now();
    return allStatuses;
  }

  const loadingStatuses = useRef(false);
  const loadStatuses = useDebouncedCallback((firstLoad) => {
    if (loadingStatuses.current) return;
    loadingStatuses.current = true;
    setUIState('loading');
    (async () => {
      try {
        const { done } = await fetchStatuses(firstLoad);
        setShowMore(!done);
        setUIState('default');
      } catch (e) {
        console.warn(e);
        setUIState('error');
      } finally {
        loadingStatuses.current = false;
      }
    })();
  }, 1000);

  useEffect(() => {
    loadStatuses(true);
  }, []);

  const scrollableRef = useRef();

  useHotkeys('j, shift+j', (_, handler) => {
    // focus on next status after active status
    // Traverses .timeline li .status-link, focus on .status-link
    const activeStatus = document.activeElement.closest(
      '.status-link, .status-boost-link',
    );
    const activeStatusRect = activeStatus?.getBoundingClientRect();
    const allStatusLinks = Array.from(
      scrollableRef.current.querySelectorAll(
        '.status-link, .status-boost-link',
      ),
    );
    if (
      activeStatus &&
      activeStatusRect.top < scrollableRef.current.clientHeight &&
      activeStatusRect.bottom > 0
    ) {
      const activeStatusIndex = allStatusLinks.indexOf(activeStatus);
      let nextStatus = allStatusLinks[activeStatusIndex + 1];
      if (handler.shift) {
        // get next status that's not .status-boost-link
        nextStatus = allStatusLinks.find(
          (statusLink, index) =>
            index > activeStatusIndex &&
            !statusLink.classList.contains('status-boost-link'),
        );
      }
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

  useHotkeys('k, shift+k', (_, handler) => {
    // focus on previous status after active status
    // Traverses .timeline li .status-link, focus on .status-link
    const activeStatus = document.activeElement.closest(
      '.status-link, .status-boost-link',
    );
    const activeStatusRect = activeStatus?.getBoundingClientRect();
    const allStatusLinks = Array.from(
      scrollableRef.current.querySelectorAll(
        '.status-link, .status-boost-link',
      ),
    );
    if (
      activeStatus &&
      activeStatusRect.top < scrollableRef.current.clientHeight &&
      activeStatusRect.bottom > 0
    ) {
      const activeStatusIndex = allStatusLinks.indexOf(activeStatus);
      let prevStatus = allStatusLinks[activeStatusIndex - 1];
      if (handler.shift) {
        // get prev status that's not .status-boost-link
        prevStatus = allStatusLinks.find(
          (statusLink, index) =>
            index < activeStatusIndex &&
            !statusLink.classList.contains('status-boost-link'),
        );
      }
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

  useHotkeys(['enter', 'o'], () => {
    // open active status
    const activeStatus = document.activeElement.closest(
      '.status-link, .status-boost-link',
    );
    if (activeStatus) {
      activeStatus.click();
    }
  });

  const {
    scrollDirection,
    reachStart,
    nearReachStart,
    nearReachEnd,
    reachEnd,
  } = useScroll({
    scrollableElement: scrollableRef.current,
    distanceFromStart: 1,
    distanceFromEnd: 3,
    scrollThresholdStart: 44,
  });

  useEffect(() => {
    if (nearReachEnd || (reachEnd && showMore)) {
      loadStatuses();
    }
  }, [nearReachEnd, reachEnd]);

  useEffect(() => {
    if (reachStart) {
      loadStatuses(true);
    }
  }, [reachStart]);

  useEffect(() => {
    (async () => {
      const keys = await db.drafts.keys();
      if (keys.length) {
        const ns = getCurrentAccountNS();
        const ownKeys = keys.filter((key) => key.startsWith(ns));
        if (ownKeys.length) {
          states.showDrafts = true;
        }
      }
    })();
  }, []);

  return (
    <>
      <div
        id="home-page"
        class="deck-container"
        hidden={hidden}
        ref={scrollableRef}
        tabIndex="-1"
      >
        <div class="timeline-deck deck">
          <header
            hidden={scrollDirection === 'end' && !nearReachStart}
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
              <Link
                to="/notifications"
                class={`button plain ${
                  snapStates.notificationsNew.length > 0 ? 'has-badge' : ''
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <Icon icon="notification" size="l" alt="Notifications" />
              </Link>
            </div>
          </header>
          {snapStates.homeNew.length > 0 &&
            scrollDirection === 'start' &&
            !nearReachStart &&
            !nearReachEnd && (
              <button
                class="updates-button"
                type="button"
                onClick={() => {
                  if (!snapStates.settings.boostsCarousel) {
                    const uniqueHomeNew = snapStates.homeNew.filter(
                      (status) => !states.home.some((s) => s.id === status.id),
                    );
                    states.home.unshift(...uniqueHomeNew);
                  }
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
          {snapStates.home.length ? (
            <>
              <ul class="timeline">
                {snapStates.home.map(({ id: statusID, reblog, boosts }) => {
                  const actualStatusID = reblog || statusID;
                  if (boosts) {
                    return (
                      <li key={statusID}>
                        <BoostsCarousel boosts={boosts} />
                      </li>
                    );
                  }
                  return (
                    <li key={statusID}>
                      <Link class="status-link" to={`/s/${actualStatusID}`}>
                        <Status statusID={statusID} />
                      </Link>
                    </li>
                  );
                })}
                {showMore && (
                  <>
                    {/* <InView
                    as="li"
                    style={{
                      height: '20vh',
                    }}
                    onChange={(inView) => {
                      if (inView) loadStatuses();
                    }}
                    root={scrollableRef.current}
                    rootMargin="100px 0px"
                  > */}
                    <li
                      style={{
                        height: '20vh',
                      }}
                    >
                      <Status skeleton />
                    </li>
                    {/* </InView> */}
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
      <button
        hidden={scrollDirection === 'end' && !nearReachStart}
        type="button"
        id="compose-button"
        onClick={(e) => {
          if (e.shiftKey) {
            const newWin = openCompose();
            if (!newWin) {
              alert('Looks like your browser is blocking popups.');
              states.showCompose = true;
            }
          } else {
            states.showCompose = true;
          }
        }}
      >
        <Icon icon="quill" size="xxl" alt="Compose" />
      </button>
    </>
  );
}

function BoostsCarousel({ boosts }) {
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
          const actualStatusID = reblog || statusID;
          return (
            <li key={statusID}>
              <Link class="status-boost-link" to={`/s/${actualStatusID}`}>
                <Status statusID={statusID} size="s" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default memo(Home);
