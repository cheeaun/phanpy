import './index.css';

import './app.css';

import { createClient } from 'masto';
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';

import Compose from './components/compose';
import { getCurrentAccount } from './utils/store-utils';
import useTitle from './utils/useTitle';

if (window.opener) {
  console = window.opener.console;
}

(() => {
  if (window.masto) return;
  console.warn('window.masto not found. Trying to log in...');
  try {
    const { instanceURL, accessToken } = getCurrentAccount();
    window.masto = createClient({
      url: `https://${instanceURL}`,
      accessToken,
      disableVersionCheck: true,
      timeout: 30_000,
    });
    console.info('Logged in successfully.');
  } catch (e) {
    console.error(e);
    alert('Failed to log in. Please try again.');
  }
})();

function App() {
  const [uiState, setUIState] = useState('default');

  const { editStatus, replyToStatus, draftStatus } = window.__COMPOSE__ || {};

  useTitle(
    editStatus
      ? 'Editing source status'
      : replyToStatus
      ? `Replying to @${
          replyToStatus.account?.acct || replyToStatus.account?.username
        }`
      : 'Compose',
  );

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
        <p>You may close this page now.</p>
        <p>
          <button
            onClick={() => {
              window.close();
            }}
          >
            Close window
          </button>
        </p>
      </div>
    );
  }

  console.debug('OPEN COMPOSE');

  return (
    <Compose
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

render(<App />, document.getElementById('app-standalone'));
