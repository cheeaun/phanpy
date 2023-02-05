import './app.css';
import 'toastify-js/src/toastify.css';

import debounce from 'just-debounce-it';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Toastify from 'toastify-js';
import { useSnapshot } from 'valtio';

import Account from './components/account';
import Compose from './components/compose';
import Drafts from './components/drafts';
import Icon from './components/icon';
import Link from './components/link';
import Loader from './components/loader';
import MediaModal from './components/media-modal';
import Modal from './components/modal';
import NotFound from './pages/404';
import AccountStatuses from './pages/account-statuses';
import Bookmarks from './pages/bookmarks';
import Favourites from './pages/favourites';
import Following from './pages/following';
import Hashtags from './pages/hashtags';
import Home from './pages/home';
import Lists from './pages/lists';
import Login from './pages/login';
import Notifications from './pages/notifications';
import Public from './pages/public';
import Settings from './pages/settings';
import Status from './pages/status';
import Welcome from './pages/welcome';
import { api, initAccount, initClient, initInstance } from './utils/api';
import { getAccessToken } from './utils/auth';
import states, { saveStatus } from './utils/states';
import store from './utils/store';
import { getCurrentAccount } from './utils/store-utils';

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

        setIsLoggedIn(true);
        setUIState('default');
      })();
    } else {
      const account = getCurrentAccount();
      if (account) {
        store.session.set('currentAccount', account.info.id);
        const { masto } = api({ account });
        initInstance(masto);
        setIsLoggedIn(true);
      }

      setUIState('default');
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
      const page = document.getElementById(locationDeckMap[location.pathname]);
      console.debug('FOCUS', location.pathname, page);
      if (page) {
        page.focus();
      }
    }, 100);
    return () => clearTimeout(timer);
  };
  useEffect(focusDeck, [location]);
  useEffect(() => {
    if (
      !snapStates.showCompose &&
      !snapStates.showSettings &&
      !snapStates.showAccount
    ) {
      focusDeck();
    }
  }, [snapStates.showCompose, snapStates.showSettings, snapStates.showAccount]);

  useEffect(() => {
    // HACK: prevent this from running again due to HMR
    if (states.init) return;
    if (isLoggedIn) {
      requestAnimationFrame(startVisibility);
      states.init = true;
    }
  }, [isLoggedIn]);

  const { prevLocation } = snapStates;
  const backgroundLocation = useRef(prevLocation || null);
  const isModalPage = /^\/s\//i.test(location.pathname);
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

  console.log('nonRootLocation', nonRootLocation, 'location', location);

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
        {isLoggedIn && <Route path="/l/f" element={<Following />} />}
        {isLoggedIn && <Route path="/b" element={<Bookmarks />} />}
        {isLoggedIn && <Route path="/f" element={<Favourites />} />}
        {isLoggedIn && <Route path="/l/:id" element={<Lists />} />}
        {isLoggedIn && (
          <Route path="/t/:instance?/:hashtag" element={<Hashtags />} />
        )}
        {isLoggedIn && (
          <Route path="/a/:instance?/:id" element={<AccountStatuses />} />
        )}
        <Route path="/p/l?/:instance" element={<Public />} />
        {/* <Route path="/:anything" element={<NotFound />} /> */}
      </Routes>
      <Routes>
        <Route path="/s/:instance?/:id" element={<Status />} />
      </Routes>
      <nav id="tab-bar" hidden>
        <li>
          <Link to="/">
            <Icon icon="home" alt="Home" size="xl" />
          </Link>
        </li>
        <li>
          <Link to="/notifications">
            <Icon icon="notification" alt="Notifications" size="xl" />
          </Link>
        </li>
        <li>
          <Link to="/bookmarks">
            <Icon icon="bookmark" alt="Bookmarks" size="xl" />
          </Link>
        </li>
      </nav>
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
              const { newStatus } = results || {};
              states.showCompose = false;
              window.__COMPOSE__ = null;
              if (newStatus) {
                states.reloadStatusPage++;
                setTimeout(() => {
                  const toast = Toastify({
                    text: 'Status posted. Check it out.',
                    duration: 10_000, // 10 seconds
                    gravity: 'bottom',
                    position: 'center',
                    // destination: `/#/s/${newStatus.id}`,
                    onClick: () => {
                      toast.hideToast();
                      states.prevLocation = location;
                      navigate(`/s/${newStatus.id}`);
                    },
                  });
                  toast.showToast();
                }, 1000);
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
    </>
  );
}

let ws;
async function startStream() {
  const { masto } = api();
  if (
    ws &&
    (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)
  ) {
    return;
  }

  const stream = await masto.v1.stream.streamUser();
  console.log('STREAM START', { stream });
  ws = stream.ws;

  const handleNewStatus = debounce((status) => {
    console.log('UPDATE', status);
    if (document.visibilityState === 'hidden') return;

    const inHomeNew = states.homeNew.find((s) => s.id === status.id);
    const inHome = status.id === states.homeLast?.id;
    if (!inHomeNew && !inHome) {
      if (states.settings.boostsCarousel && status.reblog) {
        // do nothing
      } else {
        states.homeNew.unshift({
          id: status.id,
          reblog: status.reblog?.id,
          reply: !!status.inReplyToAccountId,
        });
        console.log('homeNew 1', [...states.homeNew]);
      }
    }

    saveStatus(status);
  }, 5000);
  stream.on('update', handleNewStatus);
  stream.on('status.update', (status) => {
    console.log('STATUS.UPDATE', status);
    saveStatus(status);
  });
  stream.on('delete', (statusID) => {
    console.log('DELETE', statusID);
    // delete states.statuses[statusID];
    const s = states.statuses[statusID];
    if (s) s._deleted = true;
  });
  stream.on('notification', (notification) => {
    console.log('NOTIFICATION', notification);

    const inNotificationsNew = states.notificationsNew.find(
      (n) => n.id === notification.id,
    );
    const inNotifications = notification.id === states.notificationsLast?.id;
    if (!inNotificationsNew && !inNotifications) {
      states.notificationsNew.unshift(notification);
    }

    saveStatus(notification.status, { override: false });
  });

  stream.ws.onclose = () => {
    console.log('STREAM CLOSED!');
    if (document.visibilityState !== 'hidden') {
      startStream();
    }
  };

  return {
    stream,
    stopStream: () => {
      stream.ws.close();
    },
  };
}

let lastHidden;
function startVisibility() {
  const { masto } = api();
  const handleVisible = (visible) => {
    if (!visible) {
      const timestamp = Date.now();
      lastHidden = timestamp;
    } else {
      const timestamp = Date.now();
      const diff = timestamp - lastHidden;
      const diffMins = Math.round(diff / 1000 / 60);
      console.log(`visible: ${visible}`, { lastHidden, diffMins });
      if (!lastHidden || diffMins > 1) {
        (async () => {
          try {
            const firstStatusID = states.homeLast?.id;
            const firstNotificationID = states.notificationsLast?.id;
            console.log({ states, firstNotificationID, firstStatusID });
            const fetchHome = masto.v1.timelines.listHome({
              limit: 5,
              ...(firstStatusID && { sinceId: firstStatusID }),
            });
            const fetchNotifications = masto.v1.notifications.list({
              limit: 1,
              ...(firstNotificationID && { sinceId: firstNotificationID }),
            });

            const newStatuses = await fetchHome;
            const hasOneAndReblog =
              newStatuses.length === 1 && newStatuses?.[0]?.reblog;
            if (newStatuses.length) {
              if (states.settings.boostsCarousel && hasOneAndReblog) {
                // do nothing
              } else {
                states.homeNew = newStatuses.map((status) => {
                  saveStatus(status);
                  return {
                    id: status.id,
                    reblog: status.reblog?.id,
                    reply: !!status.inReplyToAccountId,
                  };
                });
                console.log('homeNew 2', [...states.homeNew]);
              }
            }

            const newNotifications = await fetchNotifications;
            if (newNotifications.length) {
              const notification = newNotifications[0];
              const inNotificationsNew = states.notificationsNew.find(
                (n) => n.id === notification.id,
              );
              const inNotifications =
                notification.id === states.notificationsLast?.id;
              if (!inNotificationsNew && !inNotifications) {
                states.notificationsNew.unshift(notification);
              }

              saveStatus(notification.status, { override: false });
            }
          } catch (e) {
            // Silently fail
            console.error(e);
          } finally {
            startStream();
          }
        })();
      }
    }
  };

  const handleVisibilityChange = () => {
    const hidden = document.visibilityState === 'hidden';
    handleVisible(!hidden);
    console.log('VISIBILITY: ' + (hidden ? 'hidden' : 'visible'));
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
  requestAnimationFrame(handleVisibilityChange);
  return {
    stop: () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    },
  };
}

export { App };
