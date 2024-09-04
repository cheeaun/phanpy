import './index.css';
import './app.css';
import './polyfills';

import { i18n } from '@lingui/core';
import { t, Trans } from '@lingui/macro';
import { I18nProvider } from '@lingui/react';
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';

import ComposeSuspense from './components/compose-suspense';
import Loader from './components/loader';
import { initActivateLang } from './utils/lang';
import { initStates } from './utils/states';
import { getCurrentAccount, setCurrentAccountID } from './utils/store-utils';
import useTitle from './utils/useTitle';

initActivateLang();

if (window.opener) {
  console = window.opener.console;
}

function App() {
  const [uiState, setUIState] = useState('default');
  const [isLoggedIn, setIsLoggedIn] = useState(null);

  const { editStatus, replyToStatus, draftStatus } = window.__COMPOSE__ || {};

  useTitle(
    editStatus
      ? t`Editing source status`
      : replyToStatus
      ? t`Replying to @${
          replyToStatus.account?.acct || replyToStatus.account?.username
        }`
      : t`Compose`,
  );

  useEffect(() => {
    const account = getCurrentAccount();
    setIsLoggedIn(!!account);
    if (account) {
      initStates();
    }
  }, []);

  useEffect(() => {
    if (uiState === 'closed') {
      try {
        // Focus parent window
        window.opener.focus();
      } catch (e) {}
      window.close();
    }
  }, [uiState]);

  if (uiState === 'closed') {
    return (
      <div class="box">
        <p>
          <Trans>You may close this page now.</Trans>
        </p>
        <p>
          <button
            onClick={() => {
              window.close();
            }}
          >
            <Trans>Close window</Trans>
          </button>
        </p>
      </div>
    );
  }

  console.debug('OPEN COMPOSE');

  if (isLoggedIn === false) {
    return (
      <div class="box">
        <h1>
          <Trans>Error</Trans>
        </h1>
        <p>
          <Trans>Login required.</Trans>
        </p>
        <p>
          <a href="/">
            <Trans>Go home</Trans>
          </a>
        </p>
      </div>
    );
  }

  if (isLoggedIn) {
    return (
      <ComposeSuspense
        editStatus={editStatus}
        replyToStatus={replyToStatus}
        draftStatus={draftStatus}
        standalone
        hasOpener={window.opener}
        onClose={(results) => {
          const { newStatus, fn = () => {} } = results || {};
          try {
            if (newStatus) {
              window.opener.__STATES__.reloadStatusPage++;
            }
            fn();
            setUIState('closed');
          } catch (e) {}
        }}
      />
    );
  }

  return (
    <div class="box">
      <Loader />
    </div>
  );
}

render(
  <I18nProvider i18n={i18n}>
    <App />
  </I18nProvider>,
  document.getElementById('app-standalone'),
);
