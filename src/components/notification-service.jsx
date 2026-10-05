import { Trans, useLingui } from '@lingui/react/macro';
import { memo } from 'preact/compat';
import { useLayoutEffect, useState } from 'preact/hooks';
import { useSnapshot } from 'valtio';

import { api } from '../utils/api';
import { handlePushSubscriptionChange } from '../utils/push-notifications';
import states from '../utils/states';
import {
  getAccountByAccessToken,
  getCurrentAccount,
} from '../utils/store-utils';
import usePageVisibility from '../utils/usePageVisibility';

import Icon from './icon';
import Link from './link';
import Modal from './modal';
import Notification from './notification';

{
  if ('serviceWorker' in navigator) {
    const handleMessage = (event) => {
      console.log('💥💥💥 Message event', event);
      const { type, id, accessToken, oldEndpoint, newSubscription } =
        event?.data || {};
      if (type === 'notification') {
        states.routeNotification = {
          id,
          accessToken,
        };
      } else if (type === 'pushsubscriptionchange') {
        if (!getCurrentAccount()) return;
        handlePushSubscriptionChange({ oldEndpoint, newSubscription }).catch(
          (err) => {
            console.warn('🔔 Failed to handle push subscription change', err);
          },
        );
      }
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);

    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      });
    }
  }
}

export default memo(function NotificationService() {
  const { t } = useLingui();
  if (!('serviceWorker' in navigator)) return null;

  const snapStates = useSnapshot(states);
  const { routeNotification } = snapStates;

  console.log('🛎️ Notification service', routeNotification);

  const { id, accessToken } = routeNotification || {};
  const [showNotificationSheet, setShowNotificationSheet] = useState(false);

  useLayoutEffect(() => {
    if (!id || !accessToken) return;
    const { instance: currentInstance } = api();
    const { masto, instance } = api({
      accessToken,
    });
    console.log('API', { accessToken, currentInstance, instance });
    const sameInstance = currentInstance === instance;
    const account = accessToken
      ? getAccountByAccessToken(accessToken)
      : getCurrentAccount();
    (async () => {
      const notification = await masto.v1.notifications.$select(id).fetch();
      if (notification && account) {
        console.log('🛎️ Notification', { id, notification, account });
        const accountInstance = account.instanceURL;
        const { type, status, account: notificationAccount } = notification;
        const hasModal = !!document.querySelector('#modal-container > *');
        const isFollow = type === 'follow' && !!notificationAccount?.id;
        const hasAccount = !!notificationAccount?.id;
        const hasStatus = !!status?.id;
        if (isFollow && sameInstance) {
          // Show account sheet, can handle different instances
          states.showAccount = {
            account: notificationAccount,
            instance: accountInstance,
          };
        } else if (hasModal || !sameInstance || (hasAccount && hasStatus)) {
          // Show sheet of notification, if
          // - there is a modal open
          // - the notification is from another instance
          // - the notification has both account and status, gives choice for users to go to account or status
          setShowNotificationSheet({
            id,
            account,
            notification,
            sameInstance,
          });
        } else {
          if (hasStatus) {
            // Go to status page
            location.hash = `/${currentInstance}/s/${status.id}`;
          } else if (isFollow) {
            // Go to profile page
            location.hash = `/${currentInstance}/a/${notificationAccount.id}`;
          } else {
            // Go to notifications page
            location.hash = '/notifications';
          }
        }
      } else {
        console.warn('🛎️ Notification not found', id);
      }
    })();
  }, [id, accessToken]);

  useLayoutEffect(() => {
    if (navigator?.clearAppBadge) {
      navigator.clearAppBadge();
    }
  }, []);
  usePageVisibility((visible) => {
    if (visible && navigator?.clearAppBadge) {
      console.log('🔰 Clear app badge');
      navigator.clearAppBadge();
    }
  });

  const onClose = () => {
    setShowNotificationSheet(false);
    states.routeNotification = null;

    // If url is #/notifications?id=123, go to #/notifications
    if (/\/notifications\?id=/i.test(location.hash)) {
      location.hash = '/notifications';
    }
  };

  if (showNotificationSheet) {
    const { id, account, notification, sameInstance } = showNotificationSheet;
    return (
      <Modal
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div class="sheet" tabIndex="-1">
          <button type="button" class="sheet-close" onClick={onClose}>
            <Icon icon="x" alt={t`Close`} />
          </button>
          <header>
            <b>
              <Trans>Notification</Trans>
            </b>
          </header>
          <main>
            {!sameInstance && (
              <p>
                <Trans>This notification is from your other account.</Trans>
              </p>
            )}
            <div
              class="notification-peek"
              // style={{
              //   pointerEvents: sameInstance ? '' : 'none',
              // }}
              onClick={(e) => {
                const { target } = e;
                // If button or links
                if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A') {
                  onClose();
                }
              }}
            >
              <Notification
                instance={account.instanceURL}
                notification={notification}
                isStatic
              />
            </div>
            <div
              style={{
                textAlign: 'end',
              }}
            >
              <Link to="/notifications" class="button light" onClick={onClose}>
                <span>
                  <Trans>View all notifications</Trans>
                </span>{' '}
                <Icon icon="arrow-right" />
              </Link>
            </div>
          </main>
        </div>
      </Modal>
    );
  }

  return null;
});
