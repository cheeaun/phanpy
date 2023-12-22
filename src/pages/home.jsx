import './notifications-menu.css';

import { ControlledMenu } from '@szhsin/react-menu';
import { memo } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useSnapshot } from 'valtio';

import Columns from '../components/columns';
import Icon from '../components/icon';
import Link from '../components/link';
import Loader from '../components/loader';
import Notification from '../components/notification';
import { api } from '../utils/api';
import db from '../utils/db';
import groupNotifications from '../utils/group-notifications';
import states, { saveStatus } from '../utils/states';
import { getCurrentAccountNS } from '../utils/store-utils';

import Following from './following';

function Home() {
  const snapStates = useSnapshot(states);
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
      {(snapStates.settings.shortcutsViewMode === 'multi-column' ||
        (!snapStates.settings.shortcutsViewMode &&
          snapStates.settings.shortcutsColumnsMode)) &&
      !!snapStates.shortcuts?.length ? (
        <Columns />
      ) : (
        <Following
          title="Home"
          path="/"
          id="home"
          headerStart={false}
          headerEnd={<NotificationsLink />}
        />
      )}
    </>
  );
}

function NotificationsLink() {
  const snapStates = useSnapshot(states);
  const notificationLinkRef = useRef();
  const [menuState, setMenuState] = useState(undefined);
  return (
    <>
      <Link
        ref={notificationLinkRef}
        to="/notifications"
        class={`button plain notifications-button ${
          snapStates.notificationsShowNew ? 'has-badge' : ''
        } ${menuState || ''}`}
        onClick={(e) => {
          e.stopPropagation();
          if (window.matchMedia('(min-width: calc(40em))').matches) {
            e.preventDefault();
            setMenuState((state) => (!state ? 'open' : undefined));
          }
        }}
      >
        <Icon icon="notification" size="l" alt="Notifications" />
      </Link>
      <NotificationsMenu
        state={menuState}
        anchorRef={notificationLinkRef}
        onClose={() => setMenuState(undefined)}
      />
    </>
  );
}

const NOTIFICATIONS_LIMIT = 30;
const NOTIFICATIONS_DISPLAY_LIMIT = 5;
function NotificationsMenu({ anchorRef, state, onClose }) {
  const { masto, instance } = api();
  const snapStates = useSnapshot(states);
  const [uiState, setUIState] = useState('default');

  const notificationsIterator = masto.v1.notifications.list({
    limit: NOTIFICATIONS_LIMIT,
  });

  async function fetchNotifications() {
    const allNotifications = await notificationsIterator.next();
    const notifications = allNotifications.value;

    if (notifications?.length) {
      notifications.forEach((notification) => {
        saveStatus(notification.status, instance, {
          skipThreading: true,
        });
      });

      const groupedNotifications = groupNotifications(notifications);

      states.notificationsLast = notifications[0];
      states.notifications = groupedNotifications;

      // Update last read marker
      masto.v1.markers
        .create({
          notifications: {
            lastReadId: notifications[0].id,
          },
        })
        .catch(() => {});
    }

    states.notificationsShowNew = false;
    states.notificationsLastFetchTime = Date.now();
    return allNotifications;
  }

  const [hasFollowRequests, setHasFollowRequests] = useState(false);
  function fetchFollowRequests() {
    return masto.v1.followRequests.list({
      limit: 1,
    });
  }

  function loadNotifications() {
    setUIState('loading');
    (async () => {
      try {
        await fetchNotifications();
        const followRequests = await fetchFollowRequests();
        setHasFollowRequests(!!followRequests?.length);
        setUIState('default');
      } catch (e) {
        setUIState('error');
      }
    })();
  }

  useEffect(() => {
    if (state === 'open') loadNotifications();
  }, [state]);

  return (
    <ControlledMenu
      menuClassName="notifications-menu"
      state={state}
      anchorRef={anchorRef}
      onClose={onClose}
      portal={{
        target: document.body,
      }}
      overflow="auto"
      viewScroll="close"
      position="anchor"
      align="center"
      boundingBoxPadding="8 8 8 8"
    >
      <header>
        <h2>Notifications</h2>
      </header>
      <main>
        {snapStates.notifications.length ? (
          <>
            {snapStates.notifications
              .slice(0, NOTIFICATIONS_DISPLAY_LIMIT)
              .map((notification) => (
                <Notification
                  key={notification.id}
                  instance={instance}
                  notification={notification}
                  disableContextMenu
                />
              ))}
          </>
        ) : uiState === 'loading' ? (
          <div class="ui-state">
            <Loader abrupt />
          </div>
        ) : (
          uiState === 'error' && (
            <div class="ui-state">
              <p>Unable to fetch notifications.</p>
              <p>
                <button type="button" onClick={loadNotifications}>
                  Try again
                </button>
              </p>
            </div>
          )
        )}
      </main>
      <footer>
        <Link to="/mentions" class="button plain">
          <Icon icon="at" /> <span>Mentions</span>
        </Link>
        <Link to="/notifications" class="button plain2">
          {hasFollowRequests ? (
            <>
              <span class="tag collapsed">New</span>{' '}
              <span>Follow Requests</span>
            </>
          ) : (
            <b>See all</b>
          )}{' '}
          <Icon icon="arrow-right" />
        </Link>
      </footer>
    </ControlledMenu>
  );
}

export default memo(Home);
