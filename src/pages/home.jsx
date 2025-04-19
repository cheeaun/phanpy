import './notifications-menu.css';

import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
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
import FilterContext from '../utils/filter-context';
import { massageNotifications2 } from '../utils/group-notifications';
import states, { saveStatus } from '../utils/states';
import { getCurrentAccountNS } from '../utils/store-utils';

import Following from './following';
import {
  getGroupedNotifications,
  mastoFetchNotifications,
} from './notifications';

function Home() {
  const { _ } = useLingui();
  const snapStates = useSnapshot(states);
  __BENCHMARK.end('time-to-home');
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
          title={_(msg`Home`)}
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
  const { t } = useLingui();
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
        <Icon icon="notification" size="l" alt={t`Notifications`} />
      </Link>
      <NotificationsMenu
        state={menuState}
        anchorRef={notificationLinkRef}
        onClose={() => setMenuState(undefined)}
      />
    </>
  );
}

const NOTIFICATIONS_DISPLAY_LIMIT = 5;
function NotificationsMenu({ anchorRef, state, onClose }) {
  const { masto, instance } = api();
  const snapStates = useSnapshot(states);
  const [uiState, setUIState] = useState('default');

  const notificationsIterator = mastoFetchNotifications();

  async function fetchNotifications() {
    const allNotifications = await notificationsIterator.next();
    const notifications = massageNotifications2(allNotifications.value);

    if (notifications?.length) {
      notifications.forEach((notification) => {
        saveStatus(notification.status, instance, {
          skipThreading: true,
        });
      });

      const groupedNotifications = getGroupedNotifications(notifications);

      states.notificationsLast = groupedNotifications[0];
      states.notifications = groupedNotifications;

      // Update last read marker
      masto.v1.markers
        .create({
          notifications: {
            lastReadId: groupedNotifications[0].id,
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

  const menuRef = useRef();

  return (
    <ControlledMenu
      ref={menuRef}
      menuClassName="notifications-menu"
      state={state}
      anchorRef={anchorRef}
      onClose={onClose}
      portal={{
        target: document.body,
      }}
      containerProps={{
        onClick: () => {
          menuRef.current?.closeMenu?.();
        },
      }}
      overflow="auto"
      viewScroll="close"
      position="anchor"
      align="center"
      boundingBoxPadding="8 8 8 8"
    >
      <header>
        <h2>
          <Trans>Notifications</Trans>
        </h2>
      </header>
      <FilterContext.Provider value="notifications">
        <main>
          {snapStates.notifications.length ? (
            <>
              {snapStates.notifications
                .slice(0, NOTIFICATIONS_DISPLAY_LIMIT)
                .map((notification) => (
                  <Notification
                    key={notification._ids || notification.id}
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
                <p>
                  <Trans>Unable to fetch notifications.</Trans>
                </p>
                <p>
                  <button type="button" onClick={loadNotifications}>
                    <Trans>Try again</Trans>
                  </button>
                </p>
              </div>
            )
          )}
        </main>
      </FilterContext.Provider>
      <footer>
        <Link to="/mentions" class="button plain">
          <Icon icon="at" />{' '}
          <span>
            <Trans>Mentions</Trans>
          </span>
        </Link>
        <Link to="/notifications" class="button plain2">
          {hasFollowRequests ? (
            <Trans>
              <span class="tag collapsed">New</span>{' '}
              <span>Follow Requests</span>
            </Trans>
          ) : (
            <b>
              <Trans>See all</Trans>
            </b>
          )}{' '}
          <Icon icon="arrow-right" />
        </Link>
      </footer>
    </ControlledMenu>
  );
}

export default memo(Home);
