import { Trans } from '@lingui/react/macro';
import { useState } from 'preact/hooks';

import { api } from '../utils/api';

import Icon from './icon';
import Loader from './loader';
import MenuConfirm from './menu-confirm';

function CollectionAccountActions({
  account,
  relationship,
  instance,
  isSelf,
  isCurator,
  onRelationshipChange,
  onSelfRemove,
}) {
  const { masto } = api({ instance });
  const [uiState, setUIState] = useState('default');

  if (isSelf) {
    if (isCurator) return null;
    return (
      <div class="collection-account-actions">
        {uiState === 'loading' ? (
          <Loader abrupt />
        ) : (
          <MenuConfirm
            portal
            confirmLabel={
              <>
                <Icon icon="user-x" />
                <span>
                  <Trans>Remove me from this collection?</Trans>
                </span>
              </>
            }
            className="danger"
            menuItemClassName="danger"
            menuFooter={
              <div class="footer">
                <Icon icon="info" />
                <Trans>
                  The curator won't be able to re-add you to this collection for
                  24 hours. Block them to prevent them from adding you to any
                  collections.
                </Trans>
              </div>
            }
            onClick={async () => {
              setUIState('loading');
              try {
                if (onSelfRemove) {
                  await onSelfRemove();
                }
                setUIState('default');
              } catch (e) {
                console.error(e);
                setUIState('default');
              }
            }}
          >
            <button
              type="button"
              class="light danger small"
              disabled={uiState === 'loading'}
            >
              <Trans>Remove me…</Trans>
            </button>
          </MenuConfirm>
        )}
      </div>
    );
  }

  if (!relationship) return null;
  if (relationship.following || relationship.requested) return null;

  return (
    <div class="collection-account-actions">
      {uiState === 'loading' ? (
        <Loader abrupt />
      ) : (
        <button
          type="button"
          class="small"
          disabled={uiState === 'loading'}
          onClick={async () => {
            setUIState('loading');
            try {
              const newRelationship = await masto.v1.accounts
                .$select(account.id)
                .follow();
              setUIState('default');
              if (onRelationshipChange) {
                onRelationshipChange(newRelationship);
              }
            } catch (e) {
              console.error(e);
              setUIState('default');
            }
          }}
        >
          <Icon icon="follow" />{' '}
          <span>
            <Trans>Follow</Trans>
          </span>
        </button>
      )}
    </div>
  );
}

export default CollectionAccountActions;
