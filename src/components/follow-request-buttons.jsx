import { useState } from 'preact/hooks';

import { api } from '../utils/api';

import Loader from './loader';

function FollowRequestButtons({ accountID, onChange }) {
  const { masto } = api();
  const [uiState, setUIState] = useState('default');
  return (
    <p class="follow-request-buttons">
      <button
        type="button"
        disabled={uiState === 'loading'}
        onClick={() => {
          setUIState('loading');
          (async () => {
            try {
              await masto.v1.followRequests.authorize(accountID);
              onChange();
            } catch (e) {
              console.error(e);
              setUIState('default');
            }
          })();
        }}
      >
        Accept
      </button>{' '}
      <button
        type="button"
        disabled={uiState === 'loading'}
        class="light danger"
        onClick={() => {
          setUIState('loading');
          (async () => {
            try {
              await masto.v1.followRequests.reject(accountID);
              onChange();
            } catch (e) {
              console.error(e);
              setUIState('default');
            }
          })();
        }}
      >
        Reject
      </button>
      <Loader hidden={uiState !== 'loading'} />
    </p>
  );
}

export default FollowRequestButtons;
