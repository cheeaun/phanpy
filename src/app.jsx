import './app.css';
import 'toastify-js/src/toastify.css';

import debounce from 'just-debounce-it';
import { login } from 'masto';
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
import Modal from './components/modal';
import Bookmarks from './pages/bookmarks';
import Home from './pages/home';
import Login from './pages/login';
import Notifications from './pages/notifications';
import Settings from './pages/settings';
import Status from './pages/status';
import Welcome from './pages/welcome';
import { getAccessToken } from './utils/auth';
import states, { saveStatus } from './utils/states';
import store from './utils/store';

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
        .setAttribute('content', theme);
    }
  }, []);

  useEffect(() => {
    const instanceURL = store.local.get('instanceURL');
    const accounts = store.local.getJSON('accounts') || [];
    const code = (window.location.search.match(/code=([^&]+)/) || [])[1];

    if (code) {
      console.log({ code });
      // Clear the code from the URL
      window.history.replaceState({}, document.title, '/');

      const clientID = store.session.get('clientID');
      const clientSecret = store.session.get('clientSecret');

      (async () => {
        setUIState('loading');
        const tokenJSON = await getAccessToken({
          instanceURL,
          client_id: clientID,
          client_secret: clientSecret,
          code,
        });
        const { access_token: accessToken } = tokenJSON;
        store.session.set('accessToken', accessToken);

        window.masto = await login({
          url: `https://${instanceURL}`,
          accessToken,
          disableVersionCheck: true,
          timeout: 30_000,
        });

        const mastoAccount = await masto.v1.accounts.verifyCredentials();

        // console.log({ tokenJSON, mastoAccount });

        let account = accounts.find((a) => a.info.id === mastoAccount.id);
        if (account) {
          account.info = mastoAccount;
          account.instanceURL = instanceURL.toLowerCase();
          account.accessToken = accessToken;
        } else {
          account = {
            info: mastoAccount,
            instanceURL,
            accessToken,
          };
          accounts.push(account);
        }

        store.local.setJSON('accounts', accounts);
        store.session.set('currentAccount', account.info.id);

        setIsLoggedIn(true);
        setUIState('default');
      })();
    } else if (accounts.length) {
      const currentAccount = store.session.get('currentAccount');
      const account =
        accounts.find((a) => a.info.id === currentAccount) || accounts[0];
      const instanceURL = account.instanceURL;
      const accessToken = account.accessToken;
      store.session.set('currentAccount', account.info.id);

      (async () => {
        try {
          setUIState('loading');
          window.masto = await login({
            url: `https://${instanceURL}`,
            accessToken,
            disableVersionCheck: true,
            timeout: 30_000,
          });
          setIsLoggedIn(true);
        } catch (e) {
          setIsLoggedIn(false);
        }
        setUIState('default');
      })();
    } else {
      setUIState('default');
    }
  }, []);

  let location = useLocation();
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
      requestAnimationFrame(() => {
        startStream();
        startVisibility();

        // Collect instance info
        (async () => {
          const info = await masto.v1.instances.fetch();
          console.log(info);
          const { uri, domain } = info;
          const instances = store.local.getJSON('instances') || {};
          instances[(domain || uri).toLowerCase()] = info;
          store.local.setJSON('instances', instances);
        })();
      });
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
    return !/\/(login|welcome)$/.test(pathname);
  }, [location]);

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
        {isLoggedIn && <Route path="/bookmarks" element={<Bookmarks />} />}
      </Routes>
      <Routes>
        {isLoggedIn && <Route path="/s/:id" element={<Status />} />}
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
          <Account account={snapStates.showAccount} />
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
    </>
  );
}

async function startStream() {
  const stream = await masto.v1.stream.streamUser();
  console.log('STREAM START', { stream });
  const handleNewStatus = debounce((status) => {
    console.log('UPDATE', status);

    const inHomeNew = states.homeNew.find((s) => s.id === status.id);
    const inHome = states.home.find((s) => s.id === status.id);
    if (!inHomeNew && !inHome) {
      states.homeNew.unshift({
        id: status.id,
        reblog: status.reblog?.id,
        reply: !!status.inReplyToAccountId,
      });
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
    const inNotifications = states.notifications.find(
      (n) => n.id === notification.id,
    );
    if (!inNotificationsNew && !inNotifications) {
      states.notificationsNew.unshift(notification);
    }

    saveStatus(notification.status, { override: false });
  });

  stream.ws.onclose = () => {
    console.log('STREAM CLOSED!');

    requestAnimationFrame(() => {
      startStream();
    });
  };

  return {
    stream,
    stopStream: () => {
      stream.ws.close();
    },
  };
}

function startVisibility() {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      const timestamp = Date.now();
      store.session.set('lastHidden', timestamp);
    } else {
      const timestamp = Date.now();
      const lastHidden = store.session.get('lastHidden');
      const diff = timestamp - lastHidden;
      const diffMins = Math.round(diff / 1000 / 60);
      if (diffMins > 1) {
        console.log('visible', { lastHidden, diffMins });
        setTimeout(() => {
          // Buffer for WS reconnect
          (async () => {
            try {
              const firstStatusID = states.home[0]?.id;
              const firstNotificationID = states.notifications[0]?.id;
              const fetchHome = masto.v1.timelines.listHome({
                limit: 1,
                ...(firstStatusID && { sinceId: firstStatusID }),
              });
              const fetchNotifications = masto.v1.notifications.list({
                limit: 1,
                ...(firstNotificationID && { sinceId: firstNotificationID }),
              });

              const newStatuses = await fetchHome;
              if (
                newStatuses.length &&
                newStatuses[0].id !== states.home[0].id
              ) {
                states.homeNew = newStatuses.map((status) => {
                  saveStatus(status);
                  return {
                    id: status.id,
                    reblog: status.reblog?.id,
                    reply: !!status.inReplyToAccountId,
                  };
                });
              }

              const newNotifications = await fetchNotifications;
              if (newNotifications.length) {
                const notification = newNotifications[0];
                const inNotificationsNew = states.notificationsNew.find(
                  (n) => n.id === notification.id,
                );
                const inNotifications = states.notifications.find(
                  (n) => n.id === notification.id,
                );
                if (!inNotificationsNew && !inNotifications) {
                  states.notificationsNew.unshift(notification);
                }

                saveStatus(notification.status, { override: false });
              }
            } catch (e) {
              // Silently fail
              console.error(e);
            }
          })();
        }, 100);
      }
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
  return {
    stop: () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    },
  };
}

export { App };
