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
  useParams,
} from 'react-router-dom';
import 'swiped-events';
import { useSnapshot } from 'valtio';

import AccountSheet from './components/account-sheet';
import Compose from './components/compose';
import Drafts from './components/drafts';
import Icon, { ICONS } from './components/icon';
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
import HttpRoute from './pages/HttpRoute';
import List from './pages/list';
import Lists from './pages/lists';
import Login from './pages/login';
import Mentions from './pages/mentions';
import Notifications from './pages/notifications';
import Public from './pages/public';
import Search from './pages/search';
import Settings from './pages/settings';
import Status from './pages/status';
import Trending from './pages/trending';
import Welcome from './pages/welcome';
import {
  api,
  initAccount,
  initClient,
  initInstance,
  initPreferences,
} from './utils/api';
import { getAccessToken } from './utils/auth';
import openCompose from './utils/open-compose';
import showToast from './utils/show-toast';
import states, { initStates, saveStatus } from './utils/states';
import store from './utils/store';
import { getCurrentAccount } from './utils/store-utils';
import useInterval from './utils/useInterval';
import usePageVisibility from './utils/usePageVisibility';

window.__STATES__ = states;

// Preload icons
// There's probably a better way to do this
// Related: https://github.com/vitejs/vite/issues/10600
setTimeout(() => {
  for (const icon in ICONS) {
    if (Array.isArray(ICONS[icon])) {
      ICONS[icon][0]?.();
    } else {
      ICONS[icon]?.();
    }
  }
}, 5000);

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
    const textSize = store.local.get('textSize');
    if (textSize) {
      document.documentElement.style.setProperty(
        '--text-size',
        `${textSize}px`,
      );
    }
  }, []);

  useEffect(() => {
    const instanceURL = store.local.get('instanceURL');
    const code = decodeURIComponent(
      (window.location.search.match(/code=([^&]+)/) || [, ''])[1],
    );

    if (code) {
      console.log({ code });
      // Clear the code from the URL
      window.history.replaceState({}, document.title, location.pathname || '/');

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
          initInstance(masto, instanceURL),
          initAccount(masto, instanceURL, accessToken),
        ]);
        initStates();
        initPreferences(masto);

        setIsLoggedIn(true);
        setUIState('default');
      })();
    } else {
      const account = getCurrentAccount();
      if (account) {
        store.session.set('currentAccount', account.info.id);
        const { masto, instance } = api({ account });
        console.log('masto', masto);
        initPreferences(masto);
        setUIState('loading');
        (async () => {
          try {
            await initInstance(masto, instance);
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

  const focusDeck = () => {
    let timer = setTimeout(() => {
      const columns = document.getElementById('columns');
      if (columns) {
        // Focus first column
        // columns.querySelector('.deck-container')?.focus?.();
      } else {
        const backDrop = document.querySelector('.deck-backdrop');
        if (backDrop) return;
        // Focus last deck
        const pages = document.querySelectorAll('.deck-container');
        const page = pages[pages.length - 1]; // last one
        if (page && page.tabIndex === -1) {
          console.log('FOCUS', page);
          page.focus();
        }
      }
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

  if (/\/https?:/.test(location.pathname)) {
    return <HttpRoute />;
  }

  const nonRootLocation = useMemo(() => {
    const { pathname } = location;
    return !/^\/(login|welcome)/.test(pathname);
  }, [location]);

  // Change #app dataset based on snapStates.settings.shortcutsViewMode
  useEffect(() => {
    const $app = document.getElementById('app');
    if ($app) {
      $app.dataset.shortcutsViewMode = snapStates.settings.shortcutsViewMode;
    }
  }, [snapStates.settings.shortcutsViewMode]);

  // Add/Remove cloak class to body
  useEffect(() => {
    const $body = document.body;
    $body.classList.toggle('cloak', snapStates.settings.cloakMode);
  }, [snapStates.settings.cloakMode]);

  return (
    <>
      <Routes location={nonRootLocation || location}>
        <Route
          path="/"
          element={
            isLoggedIn ? (
              <Home />
            ) : uiState === 'loading' ? (
              <Loader id="loader-root" />
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
        {isLoggedIn && <Route path="/mentions" element={<Mentions />} />}
        {isLoggedIn && <Route path="/following" element={<Following />} />}
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
        <Route path="/:instance?/trending" element={<Trending />} />
        <Route path="/:instance?/search" element={<Search />} />
        {/* <Route path="/:anything" element={<NotFound />} /> */}
      </Routes>
      {uiState === 'default' && (
        <Routes>
          <Route path="/:instance?/s/:id" element={<StatusRoute />} />
        </Routes>
      )}
      {isLoggedIn && (
        <button
          type="button"
          id="compose-button"
          onClick={(e) => {
            if (e.shiftKey) {
              const newWin = openCompose();
              if (!newWin) {
                alert('Looks like your browser is blocking popups.');
                states.showCompose = true;
              }
            } else {
              states.showCompose = true;
            }
          }}
        >
          <Icon icon="quill" size="xl" alt="Compose" />
        </button>
      )}
      {isLoggedIn &&
        !snapStates.settings.shortcutsColumnsMode &&
        snapStates.settings.shortcutsViewMode !== 'multi-column' && (
          <Shortcuts />
        )}
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
                  text: 'Post published. Check it out.',
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
          <AccountSheet
            account={snapStates.showAccount?.account || snapStates.showAccount}
            instance={snapStates.showAccount?.instance}
            onClose={({ destination } = {}) => {
              states.showAccount = false;
              if (destination) {
                states.showAccounts = false;
              }
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
          <Drafts onClose={() => (states.showDrafts = false)} />
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
          class="light"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              states.showShortcutsSettings = false;
            }
          }}
        >
          <ShortcutsSettings
            onClose={() => (states.showShortcutsSettings = false)}
          />
        </Modal>
      )}
      <BackgroundService isLoggedIn={isLoggedIn} />
    </>
  );
}

function BackgroundService({ isLoggedIn }) {
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
}

function StatusRoute() {
  const params = useParams();
  const { id, instance } = params;
  return <Status id={id} instance={instance} />;
}

export { App };
