import './notifications.css';

import { memo } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useSnapshot } from 'valtio';

import Avatar from '../components/avatar';
import Icon from '../components/icon';
import Link from '../components/link';
import Loader from '../components/loader';
import Menu from '../components/menu';
import NameText from '../components/name-text';
import RelativeTime from '../components/relative-time';
import Status from '../components/status';
import { api } from '../utils/api';
import states, { saveStatus } from '../utils/states';
import store from '../utils/store';
import useScroll from '../utils/useScroll';
import useTitle from '../utils/useTitle';

/*
Notification types
==================
mention = Someone mentioned you in their status
status = Someone you enabled notifications for has posted a status
reblog = Someone boosted one of your statuses
follow = Someone followed you
follow_request = Someone requested to follow you
favourite = Someone favourited one of your statuses
poll = A poll you have voted in or created has ended
update = A status you interacted with has been edited
admin.sign_up = Someone signed up (optionally sent to admins)
admin.report = A new report has been filed
*/

const contentText = {
  mention: 'mentioned you in their status.',
  status: 'posted a status.',
  reblog: 'boosted your status.',
  follow: 'followed you.',
  follow_request: 'requested to follow you.',
  favourite: 'favourited your status.',
  poll: 'A poll you have voted in or created has ended.',
  'poll-self': 'A poll you have created has ended.',
  'poll-voted': 'A poll you have voted in has ended.',
  update: 'A status you interacted with has been edited.',
};

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
      scrollableElement: scrollableRef.current,
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
        >
          <div class="header-grid">
            <div class="header-side">
              <Menu />
              <Link to="/" class="button plain">
                <Icon icon="home" size="l" />
              </Link>
            </div>
            <h1>Notifications</h1>
            <div class="header-side">
              <Loader hidden={uiState !== 'loading'} />
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
                  : Intl.DateTimeFormat('en', {
                      // Show year if not current year
                      year:
                        currentDay.getFullYear() === todayDate.getFullYear()
                          ? undefined
                          : 'numeric',
                      month: 'short',
                      day: 'numeric',
                    }).format(currentDay);
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
function Notification({ notification, instance }) {
  const { id, type, status, account, _accounts } = notification;

  // status = Attached when type of the notification is favourite, reblog, status, mention, poll, or update
  const actualStatusID = status?.reblog?.id || status?.id;

  const currentAccount = store.session.get('currentAccount');
  const isSelf = currentAccount === account?.id;
  const isVoted = status?.poll?.voted;

  const text =
    type === 'poll'
      ? contentText[isSelf ? 'poll-self' : isVoted ? 'poll-voted' : 'poll']
      : contentText[type];

  return (
    <div class={`notification ${type}`} tabIndex="0">
      <div
        class={`notification-type notification-${type}`}
        title={new Date(notification.createdAt).toLocaleString()}
      >
        <Icon
          icon={
            {
              mention: 'comment',
              status: 'notification',
              reblog: 'rocket',
              follow: 'follow',
              follow_request: 'follow-add',
              favourite: 'heart',
              poll: 'poll',
              update: 'pencil',
            }[type] || 'notification'
          }
          size="xl"
          alt={type}
        />
      </div>
      <div class="notification-content">
        {type !== 'mention' && (
          <>
            <p>
              {!/poll|update/i.test(type) && (
                <>
                  {_accounts?.length > 1 ? (
                    <>
                      <b>{_accounts.length} people</b>{' '}
                    </>
                  ) : (
                    <>
                      <NameText account={account} showAvatar />{' '}
                    </>
                  )}
                </>
              )}
              {text}
              {type === 'mention' && (
                <span class="insignificant">
                  {' '}
                  •{' '}
                  <RelativeTime
                    datetime={notification.createdAt}
                    format="micro"
                  />
                </span>
              )}
            </p>
            {type === 'follow_request' && (
              <FollowRequestButtons
                accountID={account.id}
                onChange={() => {
                  loadNotifications(true);
                }}
              />
            )}
          </>
        )}
        {_accounts?.length > 1 && (
          <p class="avatars-stack">
            {_accounts.map((account, i) => (
              <>
                <a
                  href={account.url}
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.preventDefault();
                    states.showAccount = account;
                  }}
                >
                  <Avatar
                    url={account.avatarStatic}
                    size={
                      _accounts.length <= 10
                        ? 'xxl'
                        : _accounts.length < 100
                        ? 'xl'
                        : _accounts.length < 1000
                        ? 'l'
                        : _accounts.length < 2000
                        ? 'm'
                        : 's' // My god, this person is popular!
                    }
                    key={account.id}
                    alt={`${account.displayName} @${account.acct}`}
                  />
                </a>{' '}
              </>
            ))}
          </p>
        )}
        {status && (
          <Link
            class={`status-link status-type-${type}`}
            to={
              instance
                ? `/${instance}/s/${actualStatusID}`
                : `/s/${actualStatusID}`
            }
          >
            <Status status={status} size="s" />
          </Link>
        )}
      </div>
    </div>
  );
}

function FollowRequestButtons({ accountID, onChange }) {
  const { masto } = api();
  const [uiState, setUIState] = useState('default');
  return (
    <p>
      <button
        type="button"
        disabled={uiState === 'loading'}
        onClick={() => {
          setUIState('loading');
          (async () => {
            try {
              await masto.v1.followRequests.authorize(accountID);
              onChange();
            } catch (e) {
              console.error(e);
              setUIState('default');
            }
          })();
        }}
      >
        Accept
      </button>{' '}
      <button
        type="button"
        disabled={uiState === 'loading'}
        class="light danger"
        onClick={() => {
          setUIState('loading');
          (async () => {
            try {
              await masto.v1.followRequests.reject(accountID);
              onChange();
            } catch (e) {
              console.error(e);
              setUIState('default');
            }
          })();
        }}
      >
        Reject
      </button>
      <Loader hidden={uiState !== 'loading'} />
    </p>
  );
}

function groupNotifications(notifications) {
  // Create new flat list of notifications
  // Combine sibling notifications based on type and status id
  // Concat all notification.account into an array of _accounts
  const notificationsMap = {};
  const cleanNotifications = [];
  for (let i = 0, j = 0; i < notifications.length; i++) {
    const notification = notifications[i];
    const { status, account, type, createdAt } = notification;
    const date = new Date(createdAt).toLocaleDateString();
    const key = `${status?.id}-${type}-${date}`;
    const mappedNotification = notificationsMap[key];
    if (type === 'follow_request') {
      cleanNotifications[j++] = notification;
    } else if (mappedNotification?.account) {
      mappedNotification._accounts.push(account);
    } else {
      let n = (notificationsMap[key] = {
        ...notification,
        _accounts: [account],
      });
      cleanNotifications[j++] = n;
    }
  }
  return cleanNotifications;
}

export default memo(Notifications);
