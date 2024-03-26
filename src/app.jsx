import './app.css';

import debounce from 'just-debounce-it';
import { lazy, Suspense } from 'preact/compat';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import { matchPath, Route, Routes, useLocation } from 'react-router-dom';
import 'swiped-events';
import { subscribe } from 'valtio';

import BackgroundService from './components/background-service';
import ComposeButton from './components/compose-button';
import { ICONS } from './components/ICONS';
import KeyboardShortcutsHelp from './components/keyboard-shortcuts-help';
import Loader from './components/loader';
// import Modals from './components/modals';
import NotificationService from './components/notification-service';
import SearchCommand from './components/search-command';
import Shortcuts from './components/shortcuts';
import NotFound from './pages/404';
import AccountStatuses from './pages/account-statuses';
import Bookmarks from './pages/bookmarks';
// import Catchup from './pages/catchup';
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
import Search from './pages/search';
import StatusRoute from './pages/status-route';
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
import focusDeck from './utils/focus-deck';
import states, { initStates, statusKey } from './utils/states';
import store from './utils/store';
import { getCurrentAccount } from './utils/store-utils';
import './utils/toast-alert';

const Catchup = lazy(() => import('./pages/catchup'));
const Modals = lazy(() => import('./components/modals'));

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
setInterval(() => {
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
}, 15 * 60 * 1000);

// Preload icons
// There's probably a better way to do this
// Related: https://github.com/vitejs/vite/issues/10600
setTimeout(() => {
  for (const icon in ICONS) {
    queueMicrotask(() => {
      if (Array.isArray(ICONS[icon])) {
        ICONS[icon][0]?.();
      } else {
        ICONS[icon]?.();
      }
    });
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
      .setAttribute('content', theme || 'dark light');

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

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [uiState, setUIState] = useState('loading');

  useEffect(() => {
    const instanceURL = store.local.get('instanceURL');
    const code = decodeURIComponent(
      (window.location.search.match(/code=([^&]+)/) || [, ''])[1],
    );

    if (code) {
      console.log({ code });
      // Clear the code from the URL
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname || '/',
      );

      const clientID = store.session.get('clientID');
      const clientSecret = store.session.get('clientSecret');
      const vapidKey = store.session.get('vapidKey');

      (async () => {
        setUIState('loading');
        const { access_token: accessToken } = await getAccessToken({
          instanceURL,
          client_id: clientID,
          client_secret: clientSecret,
          code,
        });

        const client = initClient({ instance: instanceURL, accessToken });
        await Promise.allSettled([
          initInstance(client, instanceURL),
          initAccount(client, instanceURL, accessToken, vapidKey),
        ]);
        initStates();
        initPreferences(client);

        setIsLoggedIn(true);
        setUIState('default');
      })();
    } else {
      window.__IGNORE_GET_ACCOUNT_ERROR__ = true;
      const account = getCurrentAccount();
      if (account) {
        store.session.set('currentAccount', account.info.id);
        const { client } = api({ account });
        const { instance } = client;
        // console.log('masto', masto);
        initStates();
        initPreferences(client);
        setUIState('loading');
        (async () => {
          try {
            await initInstance(client, instance);
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
  // useLayoutEffect(() => {
  //   states.currentLocation = location.pathname;
  // }, [location.pathname]);

  useEffect(focusDeck, [location, isLoggedIn]);

  if (/\/https?:/.test(location.pathname)) {
    return <HttpRoute />;
  }

  return (
    <>
      <PrimaryRoutes isLoggedIn={isLoggedIn} loading={uiState === 'loading'} />
      <SecondaryRoutes isLoggedIn={isLoggedIn} />
      {uiState === 'default' && (
        <Routes>
          <Route path="/:instance?/s/:id" element={<StatusRoute />} />
        </Routes>
      )}
      {isLoggedIn && <ComposeButton />}
      {isLoggedIn && <Shortcuts />}
      <Suspense>
        <Modals />
      </Suspense>
      {isLoggedIn && <NotificationService />}
      <BackgroundService isLoggedIn={isLoggedIn} />
      {uiState !== 'loading' && <SearchCommand onClose={focusDeck} />}
      <KeyboardShortcutsHelp />
    </>
  );
}

function PrimaryRoutes({ isLoggedIn, loading }) {
  const location = useLocation();
  const nonRootLocation = useMemo(() => {
    const { pathname } = location;
    return !/^\/(login|welcome)/i.test(pathname);
  }, [location]);

  return (
    <Routes location={nonRootLocation || location}>
      <Route
        path="/"
        element={
          isLoggedIn ? (
            <Home />
          ) : loading ? (
            <Loader id="loader-root" />
          ) : (
            <Welcome />
          )
        }
      />
      <Route path="/login" element={<Login />} />
      <Route path="/welcome" element={<Welcome />} />
    </Routes>
  );
}

function getPrevLocation() {
  return states.prevLocation || null;
}
function SecondaryRoutes({ isLoggedIn }) {
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
      {isLoggedIn && (
        <>
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/mentions" element={<Mentions />} />
          <Route path="/following" element={<Following />} />
          <Route path="/b" element={<Bookmarks />} />
          <Route path="/f" element={<Favourites />} />
          <Route path="/l">
            <Route index element={<Lists />} />
            <Route path=":id" element={<List />} />
          </Route>
          <Route path="/fh" element={<FollowedHashtags />} />
          <Route path="/ft" element={<Filters />} />
          <Route
            path="/catchup"
            element={
              <Suspense>
                <Catchup />
              </Suspense>
            }
          />
        </>
      )}
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
