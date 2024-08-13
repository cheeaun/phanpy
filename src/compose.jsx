import './index.css';
import './app.css';
import './polyfills';

import { i18n } from '@lingui/core';
import { t, Trans } from '@lingui/macro';
import { I18nProvider } from '@lingui/react';
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';

import ComposeSuspense from './components/compose-suspense';
import { initActivateLang } from './utils/lang';
import { initStates } from './utils/states';
import useTitle from './utils/useTitle';

initActivateLang();

if (window.opener) {
  console = window.opener.console;
}

function App() {
  const [uiState, setUIState] = useState('default');

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
    initStates();
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

render(
  <I18nProvider i18n={i18n}>
    <App />
  </I18nProvider>,
  document.getElementById('app-standalone'),
);
