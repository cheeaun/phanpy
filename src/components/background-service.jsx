import { memo } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useHotkeys } from 'react-hotkeys-hook';

import { api } from '../utils/api';
import showToast from '../utils/show-toast';
import states, { saveStatus } from '../utils/states';
import useInterval from '../utils/useInterval';
import usePageVisibility from '../utils/usePageVisibility';

const STREAMING_TIMEOUT = 1000 * 3; // 3 seconds
const POLL_INTERVAL = 15_000; // 15 seconds

export default memo(function BackgroundService({ isLoggedIn }) {
  // Notifications service
  // - WebSocket to receive notifications when page is visible
  const [visible, setVisible] = useState(true);
  usePageVisibility(setVisible);
  const checkLatestNotification = async (masto, instance, skipCheckMarkers) => {
    if (states.notificationsLast) {
      const notificationsIterator = masto.v1.notifications.list({
        limit: 1,
        sinceId: states.notificationsLast.id,
      });
      const { value: notifications } = await notificationsIterator.next();
      if (notifications?.length) {
        if (skipCheckMarkers) {
          states.notificationsShowNew = true;
        } else {
          let lastReadId;
          try {
            const markers = await masto.v1.markers.fetch({
              timeline: 'notifications',
            });
            lastReadId = markers?.notifications?.lastReadId;
          } catch (e) {}
          if (lastReadId) {
            states.notificationsShowNew = notifications[0].id !== lastReadId;
          } else {
            states.notificationsShowNew = true;
          }
        }
      }
    }
  };

  useEffect(() => {
    let sub;
    let pollNotifications;
    if (isLoggedIn && visible) {
      const { masto, streaming, instance } = api();
      (async () => {
        // 1. Get the latest notification
        await checkLatestNotification(masto, instance);

        let hasStreaming = false;
        // 2. Start streaming
        if (streaming) {
          pollNotifications = setTimeout(() => {
            (async () => {
              try {
                hasStreaming = true;
                sub = streaming.user.notification.subscribe();
                console.log('🎏 Streaming notification', sub);
                for await (const entry of sub) {
                  if (!sub) break;
                  if (!visible) break;
                  console.log('🔔🔔 Notification entry', entry);
                  if (entry.event === 'notification') {
                    console.log('🔔🔔 Notification', entry);
                    saveStatus(entry.payload, instance, {
                      skipThreading: true,
                    });
                  }
                  states.notificationsShowNew = true;
                }
                console.log('💥 Streaming notification loop STOPPED');
              } catch (e) {
                hasStreaming = false;
                console.error(e);
              }

              if (!hasStreaming) {
                console.log('🎏 Streaming failed, fallback to polling');
                pollNotifications = setInterval(() => {
                  checkLatestNotification(masto, instance, true);
                }, POLL_INTERVAL);
              }
            })();
          }, STREAMING_TIMEOUT);
        }
      })();
    }
    return () => {
      sub?.unsubscribe?.();
      sub = null;
      clearTimeout(pollNotifications);
      clearInterval(pollNotifications);
    };
  }, [visible, isLoggedIn]);

  // Check for updates service
  const lastCheckDate = useRef();
  const checkForUpdates = () => {
    lastCheckDate.current = Date.now();
    console.log('✨ Check app update');
    fetch('./version.json')
      .then((r) => r.json())
      .then((info) => {
        if (info) states.appVersion = info;
      })
      .catch((e) => {
        console.error(e);
      });
  };
  useInterval(checkForUpdates, visible && 1000 * 60 * 30); // 30 minutes
  usePageVisibility((visible) => {
    if (visible) {
      if (!lastCheckDate.current) {
        checkForUpdates();
      } else {
        const diff = Date.now() - lastCheckDate.current;
        if (diff > 1000 * 60 * 60) {
          // 1 hour
          checkForUpdates();
        }
      }
    }
  });

  // Global keyboard shortcuts "service"
  useHotkeys('shift+alt+k', () => {
    const currentCloakMode = states.settings.cloakMode;
    states.settings.cloakMode = !currentCloakMode;
    showToast({
      text: `Cloak mode ${currentCloakMode ? 'disabled' : 'enabled'}`,
    });
  });

  return null;
});
