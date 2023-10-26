import './app.css';

import debounce from 'just-debounce-it';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import { matchPath, Route, Routes, useLocation } from 'react-router-dom';
import 'swiped-events';
import { subscribe, useSnapshot } from 'valtio';

import BackgroundService from './components/background-service';
import ComposeButton from './components/compose-button';
import { ICONS } from './components/icon';
import KeyboardShortcutsHelp from './components/keyboard-shortcuts-help';
import Loader from './components/loader';
import Modals from './components/modals';
import NotificationService from './components/notification-service';
import SearchCommand from './components/search-command';
import Shortcuts from './components/shortcuts';
import NotFound from './pages/404';
import AccountStatuses from './pages/account-statuses';
import Bookmarks from './pages/bookmarks';
import Favourites from './pages/favourites';
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
import states, { initStates } from './utils/states';
import store from './utils/store';
import { getCurrentAccount } from './utils/store-utils';
import './utils/toast-alert';

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

(() => {
  window.__IDLE__ = false;
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
  const IDLE_TIME = 5_000; // 5 seconds
  const setIdle = debounce(() => {
    window.__IDLE__ = true;
  }, IDLE_TIME);
  const onNonIdle = () => {
    window.__IDLE__ = false;
    setIdle();
  };
  nonIdleEvents.forEach((event) => {
    window.addEventListener(event, onNonIdle, {
      passive: true,
      capture: true,
    });
  });
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
      <Modals />
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
    return !/^\/(login|welcome)/.test(pathname);
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
          <Route path="/ft" element={<FollowedHashtags />} />
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
