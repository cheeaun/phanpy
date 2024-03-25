import './index.css';

import './app.css';

import { render } from 'preact';
import { lazy } from 'preact/compat';
import { useEffect, useState } from 'preact/hooks';

import IntlSegmenterSuspense from './components/intl-segmenter-suspense';
// import Compose from './components/compose';
import useTitle from './utils/useTitle';

const Compose = lazy(() => import('./components/compose'));

if (window.opener) {
  console = window.opener.console;
}

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
    <IntlSegmenterSuspense>
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
    </IntlSegmenterSuspense>
  );
}

render(<App />, document.getElementById('app-standalone'));
