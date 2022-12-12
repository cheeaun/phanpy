import './app.css';

import { createHashHistory } from 'history';
import { login } from 'masto/fetch';
import Router from 'preact-router';
import { useEffect, useLayoutEffect, useState } from 'preact/hooks';
import { useSnapshot } from 'valtio';

import Account from './components/account';
import Compose from './components/compose';
import Icon from './components/icon';
import Loader from './components/loader';
import Modal from './components/modal';
import Home from './pages/home';
import Login from './pages/login';
import Notifications from './pages/notifications';
import Settings from './pages/settings';
import Status from './pages/status';
import Welcome from './pages/welcome';
import { getAccessToken } from './utils/auth';
import states from './utils/states';
import store from './utils/store';

const { VITE_CLIENT_NAME: CLIENT_NAME } = import.meta.env;

window._STATES = states;

async function startStream() {
  const stream = await masto.stream.streamUser();
  console.log('STREAM START', { stream });
  stream.on('update', (status) => {
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

    states.statuses.set(status.id, status);
    if (status.reblog) {
      states.statuses.set(status.reblog.id, status.reblog);
    }
  });
  stream.on('status.update', (status) => {
    console.log('STATUS.UPDATE', status);
    states.statuses.set(status.id, status);
    if (status.reblog) {
      states.statuses.set(status.reblog.id, status.reblog);
    }
  });
  // Uncomment this once this bug is fixed: https://github.com/neet/masto.js/issues/750
  // stream.on('delete', (statusID) => {
  //   console.log('DELETE', statusID);
  //   states.statuses.delete(statusID);
  // });
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

    if (notification.status && !states.statuses.has(notification.status.id)) {
      states.statuses.set(notification.status.id, notification.status);
      if (
        notification.status.reblog &&
        !states.statuses.has(notification.status.reblog.id)
      ) {
        states.statuses.set(
          notification.status.reblog.id,
          notification.status.reblog,
        );
      }
    }
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

export function App() {
  const snapStates = useSnapshot(states);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [uiState, setUIState] = useState('default');

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
        });

        const mastoAccount = await masto.accounts.verifyCredentials();

        console.log({ tokenJSON, mastoAccount });

        let account = accounts.find((a) => a.info.id === mastoAccount.id);
        if (account) {
          account.info = mastoAccount;
          account.instanceURL = instanceURL;
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
          });
          setIsLoggedIn(true);
        } catch (e) {
          setIsLoggedIn(false);
        }
        setUIState('default');
      })();
    }
  }, []);

  const [currentDeck, setCurrentDeck] = useState('home');

  useEffect(() => {
    // HACK: prevent this from running again due to HMR
    if (states.init) return;

    if (isLoggedIn) {
      requestAnimationFrame(() => {
        startStream();

        // Collect instance info
        (async () => {
          const info = await masto.instances.fetch();
          console.log(info);
          const { uri } = info;
          const instances = store.local.getJSON('instances') || {};
          instances[uri] = info;
          store.local.setJSON('instances', instances);
        })();
      });
      states.init = true;
    }
  }, [isLoggedIn]);

  return (
    <>
      {isLoggedIn && currentDeck && (
        <>
          <button
            type="button"
            id="compose-button"
            onClick={() => (states.showCompose = true)}
          >
            <Icon icon="quill" size="xxl" alt="Compose" />
          </button>
          <div class="decks">
            {/* Home will never be unmounted */}
            <Home hidden={currentDeck !== 'home'} />
            {/* Notifications can be unmounted */}
            {currentDeck === 'notifications' && <Notifications />}
          </div>
        </>
      )}
      {!isLoggedIn && uiState === 'loading' && <Loader />}
      <Router
        history={createHashHistory()}
        onChange={(e) => {
          // Special handling for Home and Notifications
          const { url } = e;
          if (/notifications/i.test(url)) {
            setCurrentDeck('notifications');
          } else if (url === '/') {
            setCurrentDeck('home');
            document.title = `Home / ${CLIENT_NAME}`;
          } else if (url === '/login' || url === '/welcome') {
            setCurrentDeck(null);
          }
          states.history.push(url);
        }}
      >
        {!isLoggedIn && uiState !== 'loading' && <Welcome path="/" />}
        <Welcome path="/welcome" />
        {isLoggedIn && <Status path="/s/:id" />}
        <Login path="/login" />
      </Router>
      {!!snapStates.showCompose && (
        <Modal>
          <Compose
            replyToStatus={
              typeof snapStates.showCompose !== 'boolean'
                ? snapStates.showCompose.replyToStatus
                : null
            }
            onClose={(result) => {
              states.showCompose = false;
              if (result) {
                states.reloadStatusPage++;
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
    </>
  );
}
