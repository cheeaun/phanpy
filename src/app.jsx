import './app.css';

import { useLingui } from '@lingui/react';
import debounce from 'just-debounce-it';
import { lazy, memo, Suspense } from 'preact/compat';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  matchPath,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';

import 'swiped-events';

import { subscribe } from 'valtio';
import { unstable_enableOp } from 'valtio/vanilla';

// https://github.com/pmndrs/valtio/releases/tag/v2.3.0
// Necessary for subscribe() to work properly
unstable_enableOp(true);

import BackgroundService from './components/background-service';
import ComposeButton from './components/compose-button';
import { ICONS } from './components/ICONS';
import KeyboardShortcutsHelp from './components/keyboard-shortcuts-help';
import Loader from './components/loader';
import Modals from './components/modals';
import NavigationCommand from './components/navigation-command';
import NotificationService from './components/notification-service';
import SearchCommand from './components/search-command';
import Shortcuts from './components/shortcuts';
import NotFound from './pages/404';
import AccountStatuses from './pages/account-statuses';
import AnnualReport from './pages/annual-report';
import Bookmarks from './pages/bookmarks';
import Catchup from './pages/catchup';
import Favourites from './pages/favourites';
import Filters from './pages/filters';
import FollowedHashtags from './pages/followed-hashtags';
import Following from './pages/following';
import Hashtag from './pages/hashtag';
import Home from './pages/home';
import HttpRoute from './pages/http-route';
import List from './pages/list';
import Lists from './pages/lists';
import Login from './pages/login';
import Mentions from './pages/mentions';
import Notifications from './pages/notifications';
import Public from './pages/public';
import ScheduledPosts from './pages/scheduled-posts';
import Search from './pages/search';
import StatusRoute from './pages/status-route';
import Trending from './pages/trending';
import Welcome from './pages/welcome';
import {
  api,
  hasInstance,
  hasPreferences,
  initAccount,
  initClient,
  initInstance,
  initPreferences,
} from './utils/api';
import { getAccessToken } from './utils/auth';
import { AuthProvider, useAuth } from './utils/auth-context';
import focusDeck from './utils/focus-deck';
import states, { hideAllModals, initStates, statusKey } from './utils/states';
import store from './utils/store';
import {
  getAccount,
  getCredentialApplication,
  getCurrentAccount,
  getVapidKey,
  setCurrentAccountID,
} from './utils/store-utils';

import './utils/toast-alert';

// Lazy load Sandbox component only in development
const Sandbox =
  import.meta.env.DEV || import.meta.env.PHANPY_DEV
    ? lazy(() => import('./pages/sandbox'))
    : () => null;

// Lazy load MockHome component only in development (not PHANPY_DEV)
const MockHome = lazy(() => import('./pages/mock-home'));

// Lazy load YearInPosts component
const YearInPosts = lazy(() => import('./pages/year-in-posts'));

// QR Scan Test component for development
function QrScanTest() {
  useEffect(() => {
    states.showQrScannerModal = {
      onClose: ({ text } = {}) => {
        hideAllModals();
        location.hash = text ? `/${text}` : '/';
      },
    };
  }, []);

  return null;
}

window.__STATES__ = states;
window.__STATES_STATS__ = () => {
  const keys = [
    'statuses',
    'accounts',
    'spoilers',
    'unfurledLinks',
    'statusQuotes',
  ];
  const counts = {};
  keys.forEach((key) => {
    counts[key] = Object.keys(states[key]).length;
  });
  console.warn('STATE stats', counts);

  const { statuses } = states;
  const unmountedPosts = [];
  for (const key in statuses) {
    const $post = document.querySelector(
      `[data-state-post-id~="${key}"], [data-state-post-ids~="${key}"]`,
    );
    if (!$post) {
      unmountedPosts.push(key);
    }
  }
  console.warn('Unmounted posts', unmountedPosts.length, unmountedPosts);
};

// Experimental "garbage collection" for states
// Every 15 minutes
// Only posts for now
setInterval(
  () => {
    if (!window.__IDLE__) return;
    const { statuses, unfurledLinks, notifications } = states;
    let keysCount = 0;
    const { instance } = api();
    for (const key in statuses) {
      if (!window.__IDLE__) break;
      try {
        const $post = document.querySelector(
          `[data-state-post-id~="${key}"], [data-state-post-ids~="${key}"]`,
        );
        const postInNotifications = notifications.some(
          (n) => key === statusKey(n.status?.id, instance),
        );
        if (!$post && !postInNotifications) {
          delete states.statuses[key];
          delete states.statusQuotes[key];
          for (const link in unfurledLinks) {
            const unfurled = unfurledLinks[link];
            const sKey = statusKey(unfurled.id, unfurled.instance);
            if (sKey === key) {
              delete states.unfurledLinks[link];
              break;
            }
          }
          keysCount++;
        }
      } catch (e) {}
    }
    if (keysCount) {
      console.info(`GC: Removed ${keysCount} keys`);
    }
  },
  15 * 60 * 1000,
);

// Preload icons
// There's probably a better way to do this
// Related: https://github.com/vitejs/vite/issues/10600
setTimeout(() => {
  for (const icon in ICONS) {
    setTimeout(() => {
      if (Array.isArray(ICONS[icon])) {
        ICONS[icon][0]?.();
      } else if (typeof ICONS[icon] === 'object') {
        ICONS[icon].module?.();
      } else {
        ICONS[icon]?.();
      }
    }, 1);
  }
}, 5000);

(() => {
  window.__IDLE__ = true;
  const nonIdleEvents = [
    'mousemove',
    'mousedown',
    'resize',
    'keydown',
    'touchstart',
    'pointerdown',
    'pointermove',
    'wheel',
  ];
  const setIdle = () => {
    window.__IDLE__ = true;
  };
  const IDLE_TIME = 3_000; // 3 seconds
  const debouncedSetIdle = debounce(setIdle, IDLE_TIME);
  const onNonIdle = () => {
    window.__IDLE__ = false;
    debouncedSetIdle();
  };
  nonIdleEvents.forEach((event) => {
    window.addEventListener(event, onNonIdle, {
      passive: true,
      capture: true,
    });
  });
  window.addEventListener('blur', setIdle, {
    passive: true,
  });
  // When cursor leaves the window, set idle
  document.documentElement.addEventListener(
    'mouseleave',
    (e) => {
      if (!e.relatedTarget && !e.toElement) {
        setIdle();
      }
    },
    {
      passive: true,
    },
  );
  // document.addEventListener(
  //   'visibilitychange',
  //   () => {
  //     if (document.visibilityState === 'visible') {
  //       onNonIdle();
  //     }
  //   },
  //   {
  //     passive: true,
  //   },
  // );
})();

// Possible fix for iOS PWA theme-color bug
// It changes when loading web pages in "webview"
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
if (isIOS) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // Don't reset theme color if media modal is showing
      // Media modal will set its own theme color based on the media's color
      const showingMediaModal =
        document.getElementsByClassName('media-modal-container').length > 0;
      if (showingMediaModal) return;

      const theme = store.local.get('theme');
      let $meta;
      if (theme) {
        // Get current meta
        $meta = document.querySelector(
          `meta[name="theme-color"][data-theme-setting="manual"]`,
        );
        if ($meta) {
          const color = $meta.content;
          const tempColor =
            theme === 'light'
              ? $meta.dataset.themeLightColorTemp
              : $meta.dataset.themeDarkColorTemp;
          $meta.content = tempColor || '';
          setTimeout(() => {
            $meta.content = color;
          }, 10);
        }
      } else {
        // Get current color scheme
        const colorScheme = window.matchMedia('(prefers-color-scheme: dark)')
          .matches
          ? 'dark'
          : 'light';
        // Get current theme-color
        $meta = document.querySelector(
          `meta[name="theme-color"][media*="${colorScheme}"]`,
        );
        if ($meta) {
          const color = $meta.dataset.content;
          const tempColor = $meta.dataset.contentTemp;
          $meta.content = tempColor || '';
          setTimeout(() => {
            $meta.content = color;
          }, 10);
        }
      }
    }
  });
}

{
  const theme = store.local.get('theme');
  // If there's a theme, it's NOT auto
  if (theme) {
    // dark | light
    document.documentElement.classList.add(`is-${theme}`);
    document
      .querySelector('meta[name="color-scheme"]')
      .setAttribute('content', theme || 'light dark');

    // Enable manual theme <meta>
    const $manualMeta = document.querySelector(
      'meta[data-theme-setting="manual"]',
    );
    if ($manualMeta) {
      $manualMeta.name = 'theme-color';
      $manualMeta.content =
        theme === 'light'
          ? $manualMeta.dataset.themeLightColor
          : $manualMeta.dataset.themeDarkColor;
    }
    // Disable auto theme <meta>s
    const $autoMetas = document.querySelectorAll(
      'meta[data-theme-setting="auto"]',
    );
    $autoMetas.forEach((m) => {
      m.name = '';
    });
  }
  const textSize = store.local.get('textSize');
  if (textSize) {
    document.documentElement.style.setProperty('--text-size', `${textSize}px`);
  }
}

subscribe(states, (changes) => {
  for (const [action, path, value, prevValue] of changes) {
    // Change #app dataset based on settings.shortcutsViewMode
    if (path.join('.') === 'settings.shortcutsViewMode') {
      const $app = document.getElementById('app');
      if ($app) {
        $app.dataset.shortcutsViewMode = states.shortcuts?.length ? value : '';
      }
    }

    // Add/Remove cloak class to body
    if (path.join('.') === 'settings.cloakMode') {
      const $body = document.body;
      $body.classList.toggle('cloak', value);
    }
  }
});

const BENCHES = new Map();
window.__BENCH_RESULTS = new Map();
window.__BENCHMARK = {
  start(name) {
    if (!import.meta.env.DEV && !import.meta.env.PHANPY_DEV) return;
    // If already started, ignore
    if (BENCHES.has(name)) return;
    const start = performance.now();
    BENCHES.set(name, start);
  },
  end(name) {
    if (!import.meta.env.DEV && !import.meta.env.PHANPY_DEV) return;
    const start = BENCHES.get(name);
    if (start) {
      const end = performance.now();
      const duration = end - start;
      __BENCH_RESULTS.set(name, duration);
      BENCHES.delete(name);
    }
  },
};

if (import.meta.env.DEV) {
  // If press shift down, set --time-scale to 10 in root
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Shift') {
      document.documentElement.classList.add('slow-mo');
    }
  });
  document.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') {
      document.documentElement.classList.remove('slow-mo');
    }
  });
}

{
  // Temporary Experiments
  // May be removed in the future
  document.body.classList.toggle(
    'exp-tab-bar-v2',
    store.local.get('experiments-tabBarV2') ?? false,
  );
}

// const isPWA = true; // testing
const isPWA =
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;
const PATH_RESTORE_TIME_LIMIT = 1 * 60 * 60 * 1000; // 1 hour, should be good enough

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    const account = getCurrentAccount();
    return !!account;
  });
  const [uiState, setUIState] = useState('loading');
  __BENCHMARK.start('app-init');
  __BENCHMARK.start('time-to-following');
  __BENCHMARK.start('time-to-home');
  __BENCHMARK.start('time-to-isLoggedIn');
  useLingui();

  useEffect(() => {
    const instanceURL = store.local.get('instanceURL');
    const code = decodeURIComponent(
      (window.location.search.match(/code=([^&]+)/) || [, ''])[1],
    );

    if (code) {
      console.log({ code });

      const isPopup = window.opener && !window.opener.closed;

      if (isPopup) {
        try {
          window.opener.postMessage(
            {
              type: 'oauth-callback',
              code: code,
            },
            window.location.origin,
          );
          setTimeout(() => {
            window.close();
          }, 100);
        } catch (e) {
          console.error('Failed to send message to parent window:', e);
          window.close();
        }
        return;
      }

      // Clear the code from the URL
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname || '/',
      );

      const {
        client_id: clientID,
        client_secret: clientSecret,
        vapid_key,
      } = getCredentialApplication(instanceURL) || {};
      const vapidKey = getVapidKey(instanceURL) || vapid_key;
      const verifier = store.sessionCookie.get('codeVerifier');

      (async () => {
        setUIState('loading');
        const { access_token: accessToken } = await getAccessToken({
          instanceURL,
          client_id: clientID,
          client_secret: clientSecret,
          code,
          code_verifier: verifier || undefined,
        });

        if (accessToken) {
          const client = initClient({ instance: instanceURL, accessToken });
          await Promise.allSettled([
            initPreferences(client),
            initInstance(client, instanceURL),
            initAccount(client, instanceURL, accessToken, vapidKey),
          ]);
          initStates();
          window.__IGNORE_GET_ACCOUNT_ERROR__ = true;

          setIsLoggedIn(true);
          setUIState('default');

          // Redirect after successful login
          const redirectPath = store.session.get('loginRedirect');
          if (redirectPath) {
            store.session.del('loginRedirect');
            window.location.hash = redirectPath;
          }
        } else {
          setUIState('error');
        }
        __BENCHMARK.end('app-init');
      })();
    } else {
      window.__IGNORE_GET_ACCOUNT_ERROR__ = true;
      const searchAccount = decodeURIComponent(
        (window.location.search.match(/account=([^&]+)/) || [, ''])[1],
      );
      let account;
      if (searchAccount) {
        account = getAccount(searchAccount);
        console.log('searchAccount', searchAccount, account);
        if (account) {
          setCurrentAccountID(account.info.id);
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname || '/',
          );
        }
      }
      if (!account) {
        account = getCurrentAccount();
      }
      if (account) {
        setCurrentAccountID(account.info.id);
        const { client } = api({ account });
        const { instance } = client;
        // console.log('masto', masto);
        initStates();
        setUIState('loading');
        (async () => {
          try {
            if (hasPreferences() && hasInstance(instance)) {
              // Non-blocking
              initPreferences(client);
              initInstance(client, instance);
            } else {
              await Promise.allSettled([
                initPreferences(client),
                initInstance(client, instance),
              ]);
            }
          } catch (e) {
          } finally {
            setIsLoggedIn(true);
            setUIState('default');
            __BENCHMARK.end('app-init');
          }
        })();
      } else {
        setUIState('default');
        __BENCHMARK.end('app-init');
      }
    }

    // Cleanup
    store.sessionCookie.del('clientID');
    store.sessionCookie.del('clientSecret');
    store.sessionCookie.del('codeVerifier');
  }, []);

  let location = useLocation();
  states.currentLocation = location.pathname;
  // useLayoutEffect(() => {
  //   states.currentLocation = location.pathname;
  // }, [location.pathname]);

  useEffect(focusDeck, [location, isLoggedIn]);

  // Save last page for PWA restoration
  const restoredRef = useRef(false);
  const lastPathKey = 'pwaLastPath';
  useEffect(() => {
    if (!restoredRef.current) return;
    // console.log('location.pathname', location.pathname);
    if (isPWA && isLoggedIn) {
      if (isRootPath(location.pathname)) {
        store.local.del(lastPathKey);
      } else {
        store.local.setJSON(lastPathKey, {
          path: location.pathname + location.search,
          lastAccessed: Date.now(),
        });
      }
    }
  }, [location.pathname, location.search, isLoggedIn]);

  // Restore last page on PWA reopen
  useEffect(() => {
    if (restoredRef.current) return;
    const isRootPath = !location.pathname || location.pathname === '/';
    if (!isRootPath) return;
    if (isPWA && isLoggedIn && uiState === 'default') {
      const lastPath = store.local.getJSON(lastPathKey);
      if (lastPath) {
        setTimeout(() => {
          if (lastPath?.path) {
            const timeSinceLastAccess =
              Date.now() - (lastPath.lastAccessed || 0);
            if (timeSinceLastAccess < PATH_RESTORE_TIME_LIMIT) {
              window.location.hash = lastPath.path;
            }
          }
          store.local.del(lastPathKey);
        }, 300);
      }
      restoredRef.current = true;
    }
  }, [uiState, isLoggedIn]);

  // Signal to service worker that this client is ready to receive share data
  useEffect(() => {
    if (
      'serviceWorker' in navigator &&
      (isPWA || import.meta.env.DEV) &&
      uiState === 'default'
    ) {
      navigator.serviceWorker
        .getRegistration()
        .then(function (registration) {
          console.log('💪 Got SW registration', registration);
          if (registration && registration.active) {
            console.log('💪 Sending client-ready message to SW');
            registration.active.postMessage({ type: 'client-ready' });
          }
        })
        .catch(function (err) {
          console.error('Could not get registration', err);
        });
    }
  }, [isPWA, uiState]);

  if (/\/https?:/.test(location.pathname)) {
    return <HttpRoute />;
  }

  if (uiState === 'loading') {
    return <Loader id="loader-root" />;
  }

  return (
    <AuthProvider value={isLoggedIn}>
      <PrimaryRoutes />
      <SecondaryRoutes />
      <Routes>
        <Route path="/:instance?/s/:id" element={<StatusRoute />} />
      </Routes>
      {isLoggedIn && <ComposeButton />}
      {isLoggedIn && <Shortcuts />}
      <Modals />
      {isLoggedIn && <NotificationService />}
      <BackgroundService />
      {isLoggedIn && <NavigationCommand />}
      <SearchCommand onClose={focusDeck} />
      <KeyboardShortcutsHelp />
    </AuthProvider>
  );
}

function Root() {
  const isLoggedIn = useAuth();
  if (isLoggedIn) {
    __BENCHMARK.end('time-to-isLoggedIn');
  }
  return isLoggedIn ? <Home /> : <Welcome />;
}

function isRootPath(pathname) {
  return /^\/(login|welcome|_sandbox|_qr-scan|_mock)/i.test(pathname);
}

const PrimaryRoutes = memo(() => {
  const location = useLocation();
  const nonRootLocation = useMemo(() => {
    const { pathname } = location;
    return !isRootPath(pathname);
  }, [location]);

  return (
    <Routes location={nonRootLocation || location}>
      <Route path="/" element={<Root />} />
      <Route path="/login" element={<Login />} />
      <Route path="/welcome" element={<Welcome />} />
      <Route
        path="/_mock/home"
        element={
          <Suspense>
            <MockHome />
          </Suspense>
        }
      />
      {(import.meta.env.DEV || import.meta.env.PHANPY_DEV) && (
        <>
          <Route
            path="/_sandbox"
            element={
              <Suspense fallback={<Loader id="loader-sandbox" />}>
                <Sandbox />
              </Suspense>
            }
          />
          <Route path="/_qr-scan" element={<QrScanTest />} />
        </>
      )}
    </Routes>
  );
});

// Auth route wrapper that redirects to login if not authenticated
function AuthRoute({ children }) {
  const isLoggedIn = useAuth();
  const location = useLocation();

  if (!isLoggedIn) {
    const redirectPath = location.pathname + location.search;
    store.session.set('loginRedirect', redirectPath);
    return <Navigate to="/login" replace />;
  }
  return children;
}

function getPrevLocation() {
  return states.prevLocation || null;
}
function SecondaryRoutes() {
  // const snapStates = useSnapshot(states);
  const location = useLocation();
  // const prevLocation = snapStates.prevLocation;
  const backgroundLocation = useRef(getPrevLocation());

  const isModalPage = useMemo(() => {
    return (
      matchPath('/:instance/s/:id', location.pathname) ||
      matchPath('/s/:id', location.pathname)
    );
  }, [location.pathname, matchPath]);

  // Persist prevLocation to sessionStorage while on a status/post page so it
  // survives a page reload. Clear it when navigating away.
  useEffect(() => {
    if (isModalPage) {
      if (states.prevLocation) {
        store.session.setJSON('prevLocation', {
          pathname: states.prevLocation.pathname,
          search: states.prevLocation.search,
        });
      }
    } else {
      if (states.prevLocation) {
        states.prevLocation = null;
      }
      store.session.del('prevLocation');
    }
  }, [isModalPage]);

  if (isModalPage) {
    if (!backgroundLocation.current)
      backgroundLocation.current = getPrevLocation();
  } else {
    backgroundLocation.current = null;
  }
  console.debug({
    backgroundLocation: backgroundLocation.current,
    location,
  });

  return (
    <Routes location={backgroundLocation.current || location}>
      <Route
        path="/notifications"
        element={
          <AuthRoute>
            <Notifications />
          </AuthRoute>
        }
      />
      <Route
        path="/mentions"
        element={
          <AuthRoute>
            <Mentions />
          </AuthRoute>
        }
      />
      <Route
        path="/following"
        element={
          <AuthRoute>
            <Following />
          </AuthRoute>
        }
      />
      <Route
        path="/b"
        element={
          <AuthRoute>
            <Bookmarks />
          </AuthRoute>
        }
      />
      <Route
        path="/f"
        element={
          <AuthRoute>
            <Favourites />
          </AuthRoute>
        }
      />
      <Route path="/l">
        <Route
          index
          element={
            <AuthRoute>
              <Lists />
            </AuthRoute>
          }
        />
        <Route
          path=":id"
          element={
            <AuthRoute>
              <List />
            </AuthRoute>
          }
        />
      </Route>
      <Route
        path="/fh"
        element={
          <AuthRoute>
            <FollowedHashtags />
          </AuthRoute>
        }
      />
      <Route
        path="/sp"
        element={
          <AuthRoute>
            <ScheduledPosts />
          </AuthRoute>
        }
      />
      <Route
        path="/ft"
        element={
          <AuthRoute>
            <Filters />
          </AuthRoute>
        }
      />
      <Route
        path="/catchup"
        element={
          <AuthRoute>
            <Catchup />
          </AuthRoute>
        }
      />
      <Route
        path="/yip"
        element={
          <AuthRoute>
            <Suspense
              fallback={
                <div
                  id="year-in-posts-page"
                  class="deck-container"
                  tabIndex="-1"
                >
                  {/* Prevent flash of no background as this is lazy-loaded */}
                  <Loader />
                </div>
              }
            >
              <YearInPosts />
            </Suspense>
          </AuthRoute>
        }
      />
      <Route
        path="/annual_report/:year"
        element={
          <AuthRoute>
            <AnnualReport />
          </AuthRoute>
        }
      />
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
  );
}

export { App };
