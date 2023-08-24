import './notifications.css';

import { useIdle } from '@uidotdev/usehooks';
import { memo } from 'preact/compat';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { useSnapshot } from 'valtio';

import AccountBlock from '../components/account-block';
import FollowRequestButtons from '../components/follow-request-buttons';
import Icon from '../components/icon';
import Link from '../components/link';
import Loader from '../components/loader';
import NavMenu from '../components/nav-menu';
import Notification from '../components/notification';
import { api } from '../utils/api';
import enhanceContent from '../utils/enhance-content';
import groupNotifications from '../utils/group-notifications';
import handleContentLinks from '../utils/handle-content-links';
import niceDateTime from '../utils/nice-date-time';
import shortenNumber from '../utils/shorten-number';
import states, { saveStatus } from '../utils/states';
import { getCurrentInstance } from '../utils/store-utils';
import useScroll from '../utils/useScroll';
import useTitle from '../utils/useTitle';

const LIMIT = 30; // 30 is the maximum limit :(

function Notifications() {
  useTitle('Notifications', '/notifications');
  const { masto, instance } = api();
  const snapStates = useSnapshot(states);
  const [uiState, setUIState] = useState('default');
  const [showMore, setShowMore] = useState(false);
  const [onlyMentions, setOnlyMentions] = useState(false);
  const scrollableRef = useRef();
  const { nearReachEnd, scrollDirection, reachStart, nearReachStart } =
    useScroll({
      scrollableRef,
    });
  const hiddenUI = scrollDirection === 'end' && !nearReachStart;
  const [followRequests, setFollowRequests] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  console.debug('RENDER Notifications');

  const notificationsIterator = useRef();
  async function fetchNotifications(firstLoad) {
    if (firstLoad || !notificationsIterator.current) {
      // Reset iterator
      notificationsIterator.current = masto.v1.notifications.list({
        limit: LIMIT,
        excludeTypes: ['follow_request'],
      });
    }
    const allNotifications = await notificationsIterator.current.next();
    const notifications = allNotifications.value;

    if (notifications?.length) {
      notifications.forEach((notification) => {
        saveStatus(notification.status, instance, {
          skipThreading: true,
        });
      });

      const groupedNotifications = groupNotifications(notifications);

      if (firstLoad) {
        states.notificationsLast = notifications[0];
        states.notifications = groupedNotifications;
      } else {
        states.notifications.push(...groupedNotifications);
      }
    }

    states.notificationsShowNew = false;
    states.notificationsLastFetchTime = Date.now();
    return allNotifications;
  }

  function fetchFollowRequests() {
    // Note: no pagination here yet because this better be on a separate page. Should be rare use-case???
    return masto.v1.followRequests.list({
      limit: 80,
    });
  }

  const loadFollowRequests = () => {
    setUIState('loading');
    (async () => {
      try {
        const requests = await fetchFollowRequests();
        setFollowRequests(requests);
        setUIState('default');
      } catch (e) {
        setUIState('error');
      }
    })();
  };

  function fetchAnnouncements() {
    return masto.v1.announcements.list();
  }

  const loadNotifications = (firstLoad) => {
    setUIState('loading');
    (async () => {
      try {
        const fetchNotificationsPromise = fetchNotifications(firstLoad);
        const fetchFollowRequestsPromise = fetchFollowRequests();
        const fetchAnnouncementsPromise = fetchAnnouncements();

        if (firstLoad) {
          const announcements = await fetchAnnouncementsPromise;
          announcements.sort((a, b) => {
            // Sort by updatedAt first, then createdAt
            const aDate = new Date(a.updatedAt || a.createdAt);
            const bDate = new Date(b.updatedAt || b.createdAt);
            return bDate - aDate;
          });
          setAnnouncements(announcements);
          const requests = await fetchFollowRequestsPromise;
          setFollowRequests(requests);
        }

        const { done } = await fetchNotificationsPromise;
        setShowMore(!done);

        setUIState('default');
      } catch (e) {
        setUIState('error');
      }
    })();
  };

  useEffect(() => {
    loadNotifications(true);
  }, []);
  useEffect(() => {
    if (reachStart) {
      loadNotifications(true);
    }
  }, [reachStart]);

  useEffect(() => {
    if (nearReachEnd && showMore) {
      loadNotifications();
    }
  }, [nearReachEnd, showMore]);

  const isHovering = useRef(false);
  const idle = useIdle(5000);
  console.debug('🧘‍♀️ IDLE', idle);
  const loadUpdates = useCallback(() => {
    console.log('✨ Load updates', {
      autoRefresh: snapStates.settings.autoRefresh,
      scrollTop: scrollableRef.current?.scrollTop === 0,
      isHovering: isHovering.current,
      inBackground: inBackground(),
      notificationsShowNew: snapStates.notificationsShowNew,
      uiState,
    });
    if (
      snapStates.settings.autoRefresh &&
      scrollableRef.current?.scrollTop === 0 &&
      (!isHovering.current || idle) &&
      !inBackground() &&
      snapStates.notificationsShowNew &&
      uiState !== 'loading'
    ) {
      loadNotifications(true);
    }
  }, [
    idle,
    snapStates.notificationsShowNew,
    snapStates.settings.autoRefresh,
    uiState,
  ]);
  useEffect(loadUpdates, [snapStates.notificationsShowNew]);

  const todayDate = new Date();
  const yesterdayDate = new Date(todayDate - 24 * 60 * 60 * 1000);
  let currentDay = new Date();
  const showTodayEmpty = !snapStates.notifications.some(
    (notification) =>
      new Date(notification.createdAt).toDateString() ===
      todayDate.toDateString(),
  );

  const announcementsListRef = useRef();

  return (
    <div
      id="notifications-page"
      class="deck-container"
      ref={scrollableRef}
      tabIndex="-1"
      onPointerEnter={() => {
        console.log('👆 Pointer enter');
        isHovering.current = true;
      }}
      onPointerLeave={() => {
        console.log('👇 Pointer leave');
        isHovering.current = false;
      }}
    >
      <div class={`timeline-deck deck ${onlyMentions ? 'only-mentions' : ''}`}>
        <header
          hidden={hiddenUI}
          onClick={(e) => {
            if (!e.target.closest('a, button')) {
              scrollableRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
          class={uiState === 'loading' ? 'loading' : ''}
        >
          <div class="header-grid">
            <div class="header-side">
              <NavMenu />
              <Link to="/" class="button plain">
                <Icon icon="home" size="l" alt="Home" />
              </Link>
            </div>
            <h1>Notifications</h1>
            <div class="header-side">
              {/* <Loader hidden={uiState !== 'loading'} /> */}
            </div>
          </div>
          {snapStates.notificationsShowNew && uiState !== 'loading' && (
            <button
              class="updates-button shiny-pill"
              type="button"
              onClick={() => {
                loadNotifications(true);
                scrollableRef.current?.scrollTo({
                  top: 0,
                  behavior: 'smooth',
                });
              }}
            >
              <Icon icon="arrow-up" /> New notifications
            </button>
          )}
        </header>
        {announcements.length > 0 && (
          <div class="shazam-container">
            <div class="shazam-container-inner">
              <details class="announcements">
                <summary>
                  <span>
                    <Icon icon="announce" class="announcement-icon" size="l" />{' '}
                    <b>Announcement{announcements.length > 1 ? 's' : ''}</b>{' '}
                    <small class="insignificant">{instance}</small>
                  </span>
                  {announcements.length > 1 && (
                    <span class="announcements-nav-buttons">
                      {announcements.map((announcement, index) => (
                        <button
                          type="button"
                          class="plain2 small"
                          onClick={() => {
                            announcementsListRef.current?.children[
                              index
                            ].scrollIntoView({
                              behavior: 'smooth',
                              block: 'nearest',
                            });
                          }}
                        >
                          {index + 1}
                        </button>
                      ))}
                    </span>
                  )}
                </summary>
                <ul
                  class={`announcements-list-${
                    announcements.length > 1 ? 'multiple' : 'single'
                  }`}
                  ref={announcementsListRef}
                >
                  {announcements.map((announcement) => (
                    <li>
                      <AnnouncementBlock announcement={announcement} />
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </div>
        )}
        {followRequests.length > 0 && (
          <div class="follow-requests">
            <h2 class="timeline-header">Follow requests</h2>
            {followRequests.length > 5 ? (
              <details>
                <summary>{followRequests.length} follow requests</summary>
                <ul>
                  {followRequests.map((account) => (
                    <li key={account.id}>
                      <AccountBlock account={account} />
                      <FollowRequestButtons
                        accountID={account.id}
                        onChange={() => {
                          // loadFollowRequests();
                          // loadNotifications(true);
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </details>
            ) : (
              <ul>
                {followRequests.map((account) => (
                  <li key={account.id}>
                    <AccountBlock account={account} />
                    <FollowRequestButtons
                      accountID={account.id}
                      onChange={() => {
                        // loadFollowRequests();
                        // loadNotifications(true);
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div id="mentions-option">
          <label>
            <input
              type="checkbox"
              checked={onlyMentions}
              onChange={(e) => {
                setOnlyMentions(e.target.checked);
              }}
            />{' '}
            Only mentions
          </label>
        </div>
        <h2 class="timeline-header">Today</h2>
        {showTodayEmpty && !!snapStates.notifications.length && (
          <p class="ui-state insignificant">
            {uiState === 'default' ? "You're all caught up." : <>&hellip;</>}
          </p>
        )}
        {snapStates.notifications.length ? (
          <>
            {snapStates.notifications.map((notification) => {
              if (onlyMentions && notification.type !== 'mention') {
                return null;
              }
              const notificationDay = new Date(notification.createdAt);
              const differentDay =
                notificationDay.toDateString() !== currentDay.toDateString();
              if (differentDay) {
                currentDay = notificationDay;
              }
              // if notificationDay is yesterday, show "Yesterday"
              // if notificationDay is before yesterday, show date
              const heading =
                notificationDay.toDateString() === yesterdayDate.toDateString()
                  ? 'Yesterday'
                  : niceDateTime(currentDay, {
                      hideTime: true,
                    });
              return (
                <>
                  {differentDay && <h2 class="timeline-header">{heading}</h2>}
                  <Notification
                    instance={instance}
                    notification={notification}
                    key={notification.id}
                    reload={() => {
                      loadNotifications(true);
                      loadFollowRequests();
                    }}
                  />
                </>
              );
            })}
          </>
        ) : (
          <>
            {uiState === 'loading' && (
              <>
                <ul class="timeline flat">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <li class="notification skeleton">
                      <div class="notification-type">
                        <Icon icon="notification" size="xl" />
                      </div>
                      <div class="notification-content">
                        <p>███████████ ████</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {uiState === 'error' && (
              <p class="ui-state">
                Unable to load notifications
                <br />
                <br />
                <button type="button" onClick={() => loadNotifications(true)}>
                  Try again
                </button>
              </p>
            )}
          </>
        )}
        {showMore && (
          <button
            type="button"
            class="plain block"
            disabled={uiState === 'loading'}
            onClick={() => loadNotifications()}
            style={{ marginBlockEnd: '6em' }}
          >
            {uiState === 'loading' ? <Loader abrupt /> : <>Show more&hellip;</>}
          </button>
        )}
      </div>
    </div>
  );
}

function inBackground() {
  return !!document.querySelector('.deck-backdrop, #modal-container > *');
}

function AnnouncementBlock({ announcement }) {
  const { instance } = api();
  const { contact } = getCurrentInstance();
  const contactAccount = contact?.account;
  const {
    id,
    content,
    startsAt,
    endsAt,
    published,
    allDay,
    publishedAt,
    updatedAt,
    read,
    mentions,
    statuses,
    tags,
    emojis,
    reactions,
  } = announcement;

  const publishedAtDate = new Date(publishedAt);
  const publishedDateText = niceDateTime(publishedAtDate);
  const updatedAtDate = new Date(updatedAt);
  const updatedAtText = niceDateTime(updatedAtDate);

  return (
    <div class="announcement-block">
      <AccountBlock account={contactAccount} />
      <div
        class="announcement-content"
        onClick={handleContentLinks({ mentions, instance })}
        dangerouslySetInnerHTML={{
          __html: enhanceContent(content, {
            emojis,
          }),
        }}
      />
      <p class="insignificant">
        <time datetime={publishedAtDate.toISOString()}>
          {niceDateTime(publishedAtDate)}
        </time>
        {updatedAt && updatedAtText !== publishedDateText && (
          <>
            {' '}
            &bull;{' '}
            <span class="ib">
              Updated{' '}
              <time datetime={updatedAtDate.toISOString()}>
                {niceDateTime(updatedAtDate)}
              </time>
            </span>
          </>
        )}
      </p>
      <div class="announcement-reactions" hidden>
        {reactions.map((reaction) => {
          const { name, count, me, staticUrl, url } = reaction;
          return (
            <button type="button" class={`plain4 small ${me ? 'reacted' : ''}`}>
              {url || staticUrl ? (
                <img src={url || staticUrl} alt={name} width="16" height="16" />
              ) : (
                <span>{name}</span>
              )}{' '}
              <span class="count">{shortenNumber(count)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default memo(Notifications);
