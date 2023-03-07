import './app.css';

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import {
  matchPath,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { useSnapshot } from 'valtio';

import Account from './components/account';
import Compose from './components/compose';
import Drafts from './components/drafts';
import Loader from './components/loader';
import MediaModal from './components/media-modal';
import Modal from './components/modal';
import Shortcuts from './components/shortcuts';
import ShortcutsSettings from './components/shortcuts-settings';
import NotFound from './pages/404';
import AccountStatuses from './pages/account-statuses';
import Accounts from './pages/accounts';
import Bookmarks from './pages/bookmarks';
import Favourites from './pages/favourites';
import FollowedHashtags from './pages/followed-hashtags';
import Following from './pages/following';
import Hashtag from './pages/hashtag';
import Home from './pages/home';
import HomeV1 from './pages/home-v1';
import List from './pages/list';
import Lists from './pages/lists';
import Login from './pages/login';
import Notifications from './pages/notifications';
import Public from './pages/public';
import Search from './pages/search';
import Settings from './pages/settings';
import Status from './pages/status';
import Welcome from './pages/welcome';
import {
  api,
  initAccount,
  initClient,
  initInstance,
  initPreferences,
} from './utils/api';
import { getAccessToken } from './utils/auth';
import showToast from './utils/show-toast';
import states, { getStatus, saveStatus } from './utils/states';
import store from './utils/store';
import { getCurrentAccount } from './utils/store-utils';
import useInterval from './utils/useInterval';
import usePageVisibility from './utils/usePageVisibility';

window.__STATES__ = states;

function App() {
  const snapStates = useSnapshot(states);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [uiState, setUIState] = useState('loading');
  const navigate = useNavigate();

  useLayoutEffect(() => {
    const theme = store.local.get('theme');
    if (theme) {
      document.documentElement.classList.add(`is-${theme}`);
      document
        .querySelector('meta[name="color-scheme"]')
        .setAttribute('content', theme === 'auto' ? 'dark light' : theme);
    }
  }, []);

  useEffect(() => {
    const instanceURL = store.local.get('instanceURL');
    const code = (window.location.search.match(/code=([^&]+)/) || [])[1];

    if (code) {
      console.log({ code });
      // Clear the code from the URL
      window.history.replaceState({}, document.title, '/');

      const clientID = store.session.get('clientID');
      const clientSecret = store.session.get('clientSecret');

      (async () => {
        setUIState('loading');
        const { access_token: accessToken } = await getAccessToken({
          instanceURL,
          client_id: clientID,
          client_secret: clientSecret,
          code,
        });

        const masto = initClient({ instance: instanceURL, accessToken });
        await Promise.allSettled([
          initInstance(masto),
          initAccount(masto, instanceURL, accessToken),
        ]);
        initPreferences(masto);

        setIsLoggedIn(true);
        setUIState('default');
      })();
    } else {
      const account = getCurrentAccount();
      if (account) {
        store.session.set('currentAccount', account.info.id);
        const { masto } = api({ account });
        console.log('masto', masto);
        initPreferences(masto);
        setUIState('loading');
        (async () => {
          try {
            await initInstance(masto);
          } catch (e) {
          } finally {
            setIsLoggedIn(true);
            setUIState('default');
          }
        })();
      } else {
        setUIState('default');
      }
    }
  }, []);

  let location = useLocation();
  states.currentLocation = location.pathname;

  const locationDeckMap = {
    '/': 'home-page',
    '/notifications': 'notifications-page',
  };
  const focusDeck = () => {
    let timer = setTimeout(() => {
      const columns = document.getElementById('columns');
      if (columns) {
        // Focus first column
        columns.querySelector('.deck-container')?.focus?.();
      } else {
        // Focus last deck
        const pages = document.querySelectorAll('.deck-container');
        const page = pages[pages.length - 1]; // last one
        if (page && page.tabIndex === -1) {
          console.log('FOCUS', page);
          page.focus();
        }
      }
      // const page = document.getElementById(locationDeckMap[location.pathname]);
      // console.debug('FOCUS', location.pathname, page);
      // if (page) {
      //   page.focus();
      // }
    }, 100);
    return () => clearTimeout(timer);
  };
  useEffect(focusDeck, [location]);
  const showModal =
    snapStates.showCompose ||
    snapStates.showSettings ||
    snapStates.showAccounts ||
    snapStates.showAccount ||
    snapStates.showDrafts ||
    snapStates.showMediaModal ||
    snapStates.showShortcutsSettings;
  useEffect(() => {
    if (!showModal) focusDeck();
  }, [showModal]);

  // useEffect(() => {
  //   // HACK: prevent this from running again due to HMR
  //   if (states.init) return;
  //   if (isLoggedIn) {
  //     requestAnimationFrame(startVisibility);
  //     states.init = true;
  //   }
  // }, [isLoggedIn]);

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
            states.notificationsShowNew = true;
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

  const { prevLocation } = snapStates;
  const backgroundLocation = useRef(prevLocation || null);
  const isModalPage =
    matchPath('/:instance/s/:id', location.pathname) ||
    matchPath('/s/:id', location.pathname);
  if (isModalPage) {
    if (!backgroundLocation.current) backgroundLocation.current = prevLocation;
  } else {
    backgroundLocation.current = null;
  }
  console.debug({
    backgroundLocation: backgroundLocation.current,
    location,
  });

  const nonRootLocation = useMemo(() => {
    const { pathname } = location;
    return !/^\/(login|welcome)/.test(pathname);
  }, [location]);

  useInterval(() => {
    console.log('✨ Check app update');
    fetch('./version.json')
      .then((r) => r.json())
      .then((info) => {
        if (info) states.appVersion = info;
      })
      .catch((e) => {
        console.error(e);
      });
  }, visible && 1000 * 60 * 60); // 1 hour

  return (
    <>
      <Routes location={nonRootLocation || location}>
        <Route
          path="/"
          element={
            isLoggedIn ? (
              <Home />
            ) : uiState === 'loading' ? (
              <Loader />
            ) : (
              <Welcome />
            )
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/welcome" element={<Welcome />} />
      </Routes>
      <Routes location={backgroundLocation.current || location}>
        {isLoggedIn && (
          <Route path="/notifications" element={<Notifications />} />
        )}
        {isLoggedIn && <Route path="/following" element={<Following />} />}
        {isLoggedIn && <Route path="/homev1" element={<HomeV1 />} />}
        {isLoggedIn && <Route path="/b" element={<Bookmarks />} />}
        {isLoggedIn && <Route path="/f" element={<Favourites />} />}
        {isLoggedIn && (
          <Route path="/l">
            <Route index element={<Lists />} />
            <Route path=":id" element={<List />} />
          </Route>
        )}
        {isLoggedIn && <Route path="/ft" element={<FollowedHashtags />} />}
        <Route path="/:instance?/t/:hashtag" element={<Hashtag />} />
        <Route path="/:instance?/a/:id" element={<AccountStatuses />} />
        <Route path="/:instance?/p">
          <Route index element={<Public />} />
          <Route path="l" element={<Public local />} />
        </Route>
        <Route path="/:instance?/search" element={<Search />} />
        {/* <Route path="/:anything" element={<NotFound />} /> */}
      </Routes>
      <Routes>
        <Route path="/:instance?/s/:id" element={<Status />} />
      </Routes>
      <div>
        {!snapStates.settings.shortcutsColumnsMode &&
          snapStates.settings.shortcutsViewMode !== 'multi-column' && (
            <Shortcuts />
          )}
      </div>
      {!!snapStates.showCompose && (
        <Modal>
          <Compose
            replyToStatus={
              typeof snapStates.showCompose !== 'boolean'
                ? snapStates.showCompose.replyToStatus
                : window.__COMPOSE__?.replyToStatus || null
            }
            editStatus={
              states.showCompose?.editStatus ||
              window.__COMPOSE__?.editStatus ||
              null
            }
            draftStatus={
              states.showCompose?.draftStatus ||
              window.__COMPOSE__?.draftStatus ||
              null
            }
            onClose={(results) => {
              const { newStatus, instance } = results || {};
              states.showCompose = false;
              window.__COMPOSE__ = null;
              if (newStatus) {
                states.reloadStatusPage++;
                showToast({
                  text: 'Status posted. Check it out.',
                  delay: 1000,
                  duration: 10_000, // 10 seconds
                  onClick: (toast) => {
                    toast.hideToast();
                    states.prevLocation = location;
                    navigate(
                      instance
                        ? `/${instance}/s/${newStatus.id}`
                        : `/s/${newStatus.id}`,
                    );
                  },
                });
              }
            }}
          />
        </Modal>
      )}
      {!!snapStates.showSettings && (
        <Modal
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              states.showSettings = false;
            }
          }}
        >
          <Settings
            onClose={() => {
              states.showSettings = false;
            }}
          />
        </Modal>
      )}
      {!!snapStates.showAccounts && (
        <Modal
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              states.showAccounts = false;
            }
          }}
        >
          <Accounts
            onClose={() => {
              states.showAccounts = false;
            }}
          />
        </Modal>
      )}
      {!!snapStates.showAccount && (
        <Modal
          class="light"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              states.showAccount = false;
            }
          }}
        >
          <Account
            account={snapStates.showAccount?.account || snapStates.showAccount}
            instance={snapStates.showAccount?.instance}
            onClose={() => {
              states.showAccount = false;
            }}
          />
        </Modal>
      )}
      {!!snapStates.showDrafts && (
        <Modal
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              states.showDrafts = false;
            }
          }}
        >
          <Drafts />
        </Modal>
      )}
      {!!snapStates.showMediaModal && (
        <Modal
          onClick={(e) => {
            if (
              e.target === e.currentTarget ||
              e.target.classList.contains('media')
            ) {
              states.showMediaModal = false;
            }
          }}
        >
          <MediaModal
            mediaAttachments={snapStates.showMediaModal.mediaAttachments}
            instance={snapStates.showMediaModal.instance}
            index={snapStates.showMediaModal.index}
            statusID={snapStates.showMediaModal.statusID}
            onClose={() => {
              states.showMediaModal = false;
            }}
          />
        </Modal>
      )}
      {!!snapStates.showShortcutsSettings && (
        <Modal
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              states.showShortcutsSettings = false;
            }
          }}
        >
          <ShortcutsSettings />
        </Modal>
      )}
    </>
  );
}

// let ws;
// async function startStream() {
//   const { masto, instance } = api();
//   if (
//     ws &&
//     (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)
//   ) {
//     return;
//   }

//   const stream = await masto.v1.stream.streamUser();
//   console.log('STREAM START', { stream });
//   ws = stream.ws;

//   const handleNewStatus = debounce((status) => {
//     console.log('UPDATE', status);
//     if (document.visibilityState === 'hidden') return;

//     const inHomeNew = states.homeNew.find((s) => s.id === status.id);
//     const inHome = status.id === states.homeLast?.id;
//     if (!inHomeNew && !inHome) {
//       if (states.settings.boostsCarousel && status.reblog) {
//         // do nothing
//       } else {
//         states.homeNew.unshift({
//           id: status.id,
//           reblog: status.reblog?.id,
//           reply: !!status.inReplyToAccountId,
//         });
//         console.log('homeNew 1', [...states.homeNew]);
//       }
//     }

//     saveStatus(status, instance);
//   }, 5000);
//   stream.on('update', handleNewStatus);
//   stream.on('status.update', (status) => {
//     console.log('STATUS.UPDATE', status);
//     saveStatus(status, instance);
//   });
//   stream.on('delete', (statusID) => {
//     console.log('DELETE', statusID);
//     // delete states.statuses[statusID];
//     const s = getStatus(statusID);
//     if (s) s._deleted = true;
//   });
//   stream.on('notification', (notification) => {
//     console.log('NOTIFICATION', notification);

//     const inNotificationsNew = states.notificationsNew.find(
//       (n) => n.id === notification.id,
//     );
//     const inNotifications = notification.id === states.notificationsLast?.id;
//     if (!inNotificationsNew && !inNotifications) {
//       states.notificationsNew.unshift(notification);
//     }

//     saveStatus(notification.status, instance, { override: false });
//   });

//   stream.ws.onclose = () => {
//     console.log('STREAM CLOSED!');
//     if (document.visibilityState !== 'hidden') {
//       startStream();
//     }
//   };

//   return {
//     stream,
//     stopStream: () => {
//       stream.ws.close();
//     },
//   };
// }

// let lastHidden;
// function startVisibility() {
//   const { masto, instance } = api();
//   const handleVisible = (visible) => {
//     if (!visible) {
//       const timestamp = Date.now();
//       lastHidden = timestamp;
//     } else {
//       const timestamp = Date.now();
//       const diff = timestamp - lastHidden;
//       const diffMins = Math.round(diff / 1000 / 60);
//       console.log(`visible: ${visible}`, { lastHidden, diffMins });
//       if (!lastHidden || diffMins > 1) {
//         (async () => {
//           try {
//             const firstStatusID = states.homeLast?.id;
//             const firstNotificationID = states.notificationsLast?.id;
//             console.log({ states, firstNotificationID, firstStatusID });
//             const fetchHome = masto.v1.timelines.listHome({
//               limit: 5,
//               ...(firstStatusID && { sinceId: firstStatusID }),
//             });
//             const fetchNotifications = masto.v1.notifications.list({
//               limit: 1,
//               ...(firstNotificationID && { sinceId: firstNotificationID }),
//             });

//             const newStatuses = await fetchHome;
//             const hasOneAndReblog =
//               newStatuses.length === 1 && newStatuses?.[0]?.reblog;
//             if (newStatuses.length) {
//               if (states.settings.boostsCarousel && hasOneAndReblog) {
//                 // do nothing
//               } else {
//                 states.homeNew = newStatuses.map((status) => {
//                   saveStatus(status, instance);
//                   return {
//                     id: status.id,
//                     reblog: status.reblog?.id,
//                     reply: !!status.inReplyToAccountId,
//                   };
//                 });
//                 console.log('homeNew 2', [...states.homeNew]);
//               }
//             }

//             const newNotifications = await fetchNotifications;
//             if (newNotifications.length) {
//               const notification = newNotifications[0];
//               const inNotificationsNew = states.notificationsNew.find(
//                 (n) => n.id === notification.id,
//               );
//               const inNotifications =
//                 notification.id === states.notificationsLast?.id;
//               if (!inNotificationsNew && !inNotifications) {
//                 states.notificationsNew.unshift(notification);
//               }

//               saveStatus(notification.status, instance, { override: false });
//             }
//           } catch (e) {
//             // Silently fail
//             console.error(e);
//           } finally {
//             startStream();
//           }
//         })();
//       }
//     }
//   };

//   const handleVisibilityChange = () => {
//     const hidden = document.visibilityState === 'hidden';
//     handleVisible(!hidden);
//     console.log('VISIBILITY: ' + (hidden ? 'hidden' : 'visible'));
//   };
//   document.addEventListener('visibilitychange', handleVisibilityChange);
//   requestAnimationFrame(handleVisibilityChange);
//   return {
//     stop: () => {
//       document.removeEventListener('visibilitychange', handleVisibilityChange);
//     },
//   };
// }

export { App };
