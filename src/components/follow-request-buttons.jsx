import { useState } from 'preact/hooks';

import { api } from '../utils/api';

import Icon from './icon';
import Loader from './loader';

function FollowRequestButtons({ accountID, onChange }) {
  const { masto } = api();
  const [uiState, setUIState] = useState('default');
  const [requestState, setRequestState] = useState(null); // accept, reject
  const [relationship, setRelationship] = useState(null);

  const hasRelationship = relationship !== null;

  return (
    <p class="follow-request-buttons">
      <button
        type="button"
        disabled={uiState === 'loading' || hasRelationship}
        onClick={() => {
          setUIState('loading');
          setRequestState('accept');
          (async () => {
            try {
              const rel = await masto.v1.followRequests
                .$select(accountID)
                .authorize();
              if (!rel?.followedBy) {
                throw new Error('Follow request not accepted');
              }
              setRelationship(rel);
              onChange();
            } catch (e) {
              console.error(e);
            }
            setUIState('default');
          })();
        }}
      >
        Accept
      </button>{' '}
      <button
        type="button"
        disabled={uiState === 'loading' || hasRelationship}
        class="light danger"
        onClick={() => {
          setUIState('loading');
          setRequestState('reject');
          (async () => {
            try {
              const rel = await masto.v1.followRequests
                .$select(accountID)
                .reject();
              if (rel?.followedBy) {
                throw new Error('Follow request not rejected');
              }
              setRelationship(rel);
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
      <span class="follow-request-states">
        {hasRelationship && requestState ? (
          requestState === 'accept' ? (
            <Icon icon="check-circle" alt="Accepted" class="follow-accepted" />
          ) : (
            <Icon icon="x-circle" alt="Rejected" class="follow-rejected" />
          )
        ) : (
          <Loader hidden={uiState !== 'loading'} />
        )}
      </span>
    </p>
  );
}

export default FollowRequestButtons;
