import { memo } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';

import { api } from '../utils/api';
import states, { saveStatus } from '../utils/states';
import useInterval from '../utils/useInterval';
import usePageVisibility from '../utils/usePageVisibility';

export default memo(function BackgroundService({ isLoggedIn }) {
  // Notifications service
  // - WebSocket to receive notifications when page is visible
  const [visible, setVisible] = useState(true);
  usePageVisibility(setVisible);
  const notificationStream = useRef();
  useEffect(() => {
    if (isLoggedIn && visible) {
      const { masto, instance } = api();
      (async () => {
        // 1. Get the latest notification
        if (states.notificationsLast) {
          const notificationsIterator = masto.v1.notifications.list({
            limit: 1,
            since_id: states.notificationsLast.id,
          });
          const { value: notifications } = await notificationsIterator.next();
          if (notifications?.length) {
            let lastReadId;
            try {
              const markers = await masto.v1.markers.fetch({
                timeline: 'notifications',
              });
              lastReadId = markers?.notifications?.lastReadId;
            } catch (e) {}
            if (lastReadId) {
              if (notifications[0].id !== lastReadId) {
                states.notificationsShowNew = true;
              }
            } else {
              states.notificationsShowNew = true;
            }
          }
        }

        // 2. Start streaming
        notificationStream.current = await masto.ws.stream(
          '/api/v1/streaming',
          {
            stream: 'user:notification',
          },
        );
        console.log('🎏 Streaming notification', notificationStream.current);

        notificationStream.current.on('notification', (notification) => {
          console.log('🔔🔔 Notification', notification);
          if (notification.status) {
            saveStatus(notification.status, instance, {
              skipThreading: true,
            });
          }
          states.notificationsShowNew = true;
        });

        notificationStream.current.ws.onclose = () => {
          console.log('🔔🔔 Notification stream closed');
        };
      })();
    }
    return () => {
      if (notificationStream.current) {
        notificationStream.current.ws.close();
        notificationStream.current = null;
      }
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

  return null;
});
