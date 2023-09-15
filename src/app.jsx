import './app.css';

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import { matchPath, Route, Routes, useLocation } from 'react-router-dom';
import 'swiped-events';
import { useSnapshot } from 'valtio';

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

function App() {
  const snapStates = useSnapshot(states);
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

        const masto = initClient({ instance: instanceURL, accessToken });
        await Promise.allSettled([
          initInstance(masto, instanceURL),
          initAccount(masto, instanceURL, accessToken, vapidKey),
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

  useEffect(focusDeck, [location, isLoggedIn]);

  const prevLocation = snapStates.prevLocation;
  const backgroundLocation = useRef(prevLocation || null);
  const isModalPage = useMemo(() => {
    return (
      matchPath('/:instance/s/:id', location.pathname) ||
      matchPath('/s/:id', location.pathname)
    );
  }, [location.pathname, matchPath]);
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
      $app.dataset.shortcutsViewMode = snapStates.shortcuts?.length
        ? snapStates.settings.shortcutsViewMode
        : '';
    }
  }, [snapStates.shortcuts, snapStates.settings.shortcutsViewMode]);

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
      {isLoggedIn && <ComposeButton />}
      {isLoggedIn &&
        !snapStates.settings.shortcutsColumnsMode &&
        snapStates.settings.shortcutsViewMode !== 'multi-column' && (
          <Shortcuts />
        )}
      <Modals />
      <NotificationService />
      <BackgroundService isLoggedIn={isLoggedIn} />
      <SearchCommand onClose={focusDeck} />
      <KeyboardShortcutsHelp />
    </>
  );
}

export { App };
