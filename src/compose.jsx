import './index.css';

import './app.css';

import '@github/time-elements';
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';

import Compose from './components/compose';

if (window.opener) {
  console = window.opener.console;
}

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
      <div>
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

render(<App />, document.getElementById('app'));
