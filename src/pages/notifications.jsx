import './notifications.css';

import { Link } from 'preact-router/match';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useSnapshot } from 'valtio';

import Icon from '../components/icon';
import Loader from '../components/loader';
import NameText from '../components/name-text';
import Status from '../components/status';
import states from '../utils/states';
import store from '../utils/store';
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

const LIMIT = 20;

function Notification({ notification }) {
  const { id, type, status, account } = notification;

  // status = Attached when type of the notification is favourite, reblog, status, mention, poll, or update
  const actualStatusID = status?.reblog?.id || status?.id;

  const currentAccount = store.session.get('currentAccount');
  const isSelf = currentAccount?.id === account.id;
  const isVoted = status?.poll?.voted;

  const text =
    type === 'poll'
      ? contentText[isSelf ? 'poll-self' : isVoted ? 'poll-voted' : 'poll']
      : contentText[type];

  return (
    <>
      <div
        class={`notification-type ${type}`}
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
        <p>
          {!/poll|update/i.test(type) && (
            <>
              <NameText account={account} showAvatar />{' '}
            </>
          )}
          {text}
        </p>
        {status && (
          <Link class="status-link" href={`#/s/${actualStatusID}`}>
            <Status status={status} size="s" />
          </Link>
        )}
      </div>
    </>
  );
}

function NotificationsList({ notifications, emptyCopy }) {
  if (!notifications.length && emptyCopy) {
    return <p class="timeline-empty">{emptyCopy}</p>;
  }
  return (
    <ul class="timeline flat">
      {notifications.map((notification) => {
        const { id, type } = notification;
        return (
          <li key={id} class={`notification ${type}`}>
            <Notification notification={notification} />
          </li>
        );
      })}
    </ul>
  );
}

export default () => {
  useTitle('Notifications');
  const snapStates = useSnapshot(states);
  const [uiState, setUIState] = useState('default');
  const [showMore, setShowMore] = useState(false);

  const notificationsIterator = useRef(
    masto.notifications.getIterator({
      limit: LIMIT,
    }),
  ).current;
  async function fetchNotifications(firstLoad) {
    const allNotifications = await notificationsIterator.next(
      firstLoad
        ? {
            limit: LIMIT,
          }
        : undefined,
    );
    if (allNotifications.value <= 0) {
      return { done: true };
    }
    const notificationsValues = allNotifications.value.map((notification) => {
      if (notification.status) {
        states.statuses.set(notification.status.id, notification.status);
      }
      return notification;
    });
    if (firstLoad) {
      states.notifications = notificationsValues;
    } else {
      states.notifications.push(...notificationsValues);
    }
    states.notificationsLastFetchTime = Date.now();
    console.log(allNotifications);
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
    states.notificationsNew = [];
  }, []);

  const scrollableRef = useRef();

  // Group notifications by today, yesterday, and older
  const groupedNotifications = snapStates.notifications.reduce(
    (acc, notification) => {
      const date = new Date(notification.createdAt);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      if (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
      ) {
        acc.today.push(notification);
      } else if (
        date.getDate() === yesterday.getDate() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear()
      ) {
        acc.yesterday.push(notification);
      } else {
        acc.older.push(notification);
      }
      return acc;
    },
    { today: [], yesterday: [], older: [] },
  );

  console.log(groupedNotifications);

  return (
    <div class="deck-container" ref={scrollableRef}>
      <div class="timeline-deck deck">
        <header>
          <div class="header-side">
            <a href="#" class="button plain">
              <Icon icon="home" size="l" />
            </a>
          </div>
          <h1>Notifications</h1>
          <div class="header-side">
            <Loader hidden={uiState !== 'loading'} />
          </div>
          {snapStates.notificationsNew.length > 0 && (
            <button
              class="updates-button"
              type="button"
              onClick={() => {
                const uniqueNotificationsNew =
                  snapStates.notificationsNew.filter(
                    (notification) =>
                      !snapStates.notifications.some(
                        (n) => n.id === notification.id,
                      ),
                  );
                states.notifications.unshift(...uniqueNotificationsNew);
                loadNotifications(true);
                states.notificationsNew = [];

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
        {snapStates.notifications.length ? (
          <>
            <h2 class="timeline-header">Today</h2>
            <NotificationsList
              notifications={groupedNotifications.today}
              emptyCopy="You're all caught up."
            />
            {groupedNotifications.yesterday.length > 0 && (
              <>
                <h2 class="timeline-header">Yesterday</h2>
                <NotificationsList
                  notifications={groupedNotifications.yesterday}
                />
              </>
            )}
            {groupedNotifications.older.length > 0 && (
              <>
                <h2 class="timeline-header">Older</h2>
                <NotificationsList notifications={groupedNotifications.older} />
              </>
            )}
            {showMore && (
              <button
                type="button"
                class="plain block"
                disabled={uiState === 'loading'}
                onClick={() => loadNotifications()}
              >
                {uiState === 'loading' ? <Loader /> : <>Show more&hellip;</>}
              </button>
            )}
          </>
        ) : (
          <>
            {uiState === 'loading' && (
              <>
                <h2 class="timeline-header">Today</h2>
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
              <p class="ui-state">Error loading notifications</p>
            )}
          </>
        )}
      </div>
    </div>
  );
};
