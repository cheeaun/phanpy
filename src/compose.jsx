import './index.css';
import './app.css';
import './polyfills';

import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';

import ComposeSuspense from './components/compose-suspense';
import { IconSpriteProvider } from './components/icon-sprite-manager';
import Loader from './components/loader';
import { initActivateLang } from './utils/lang';
import { initPWAViewport } from './utils/pwa-viewport';
import { initStates } from './utils/states';
import { getCurrentAccount } from './utils/store-utils';
import useTitle from './utils/useTitle';

initActivateLang();
initPWAViewport();

if (window.opener) {
  console = window.opener.console;
}

function App() {
  const { t } = useLingui();
  const [uiState, setUIState] = useState('default');
  const [isLoggedIn, setIsLoggedIn] = useState(null);

  const { editStatus, replyToStatus, replyMode, draftStatus, quoteStatus } =
    window.__COMPOSE__ || {};

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
        replyMode={replyMode || 'all'}
        draftStatus={draftStatus}
        quoteStatus={quoteStatus}
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
    <IconSpriteProvider>
      <App />
    </IconSpriteProvider>
  </I18nProvider>,
  document.getElementById('app-standalone'),
);
