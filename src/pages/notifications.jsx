import './notifications.css';

import { memo } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useSnapshot } from 'valtio';

import Icon from '../components/icon';
import Link from '../components/link';
import Loader from '../components/loader';
import NavMenu from '../components/nav-menu';
import Notification from '../components/notification';
import { api } from '../utils/api';
import groupNotifications from '../utils/group-notifications';
import niceDateTime from '../utils/nice-date-time';
import states, { saveStatus } from '../utils/states';
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

  console.debug('RENDER Notifications');

  const notificationsIterator = useRef();
  async function fetchNotifications(firstLoad) {
    if (firstLoad || !notificationsIterator.current) {
      // Reset iterator
      notificationsIterator.current = masto.v1.notifications.list({
        limit: LIMIT,
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

  const loadNotifications = (firstLoad) => {
    setUIState('loading');
    (async () => {
      try {
        const { done } = await fetchNotifications(firstLoad);
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

  const todayDate = new Date();
  const yesterdayDate = new Date(todayDate - 24 * 60 * 60 * 1000);
  let currentDay = new Date();
  const showTodayEmpty = !snapStates.notifications.some(
    (notification) =>
      new Date(notification.createdAt).toDateString() ===
      todayDate.toDateString(),
  );

  return (
    <div
      id="notifications-page"
      class="deck-container"
      ref={scrollableRef}
      tabIndex="-1"
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

export default memo(Notifications);
