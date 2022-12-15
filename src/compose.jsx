import './index.css';

import './app.css';

import '@github/time-elements';
import { login } from 'masto';
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';

import Compose from './components/compose';
import store from './utils/store';

if (window.opener) {
  console = window.opener.console;
}

(async () => {
  if (window.masto) return;
  console.warn('window.masto not found. Trying to log in...');
  try {
    const accounts = store.local.getJSON('accounts') || [];
    const currentAccount = store.session.get('currentAccount');
    const account =
      accounts.find((a) => a.info.id === currentAccount) || accounts[0];
    const instanceURL = account.instanceURL;
    const accessToken = account.accessToken;
    window.masto = await login({
      url: `https://${instanceURL}`,
      accessToken,
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

  useEffect(() => {
    if (uiState === 'closed') {
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
