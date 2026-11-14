import './add-remove-collections-sheet.css';

import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useReducer, useState } from 'preact/hooks';

import { api } from '../utils/api';
import { COLLECTIONS_LIMIT } from '../utils/collections';
import showToast from '../utils/show-toast';
import { getCurrentAccountID } from '../utils/store-utils';

import CollectionAddEdit from './collection-add-edit';
import Icon from './icon';
import Loader from './loader';
import Modal from './modal';

function AddRemoveCollectionsSheet({ accountID, onClose }) {
  const { t } = useLingui();
  const { masto } = api();
  const currentAccountID = getCurrentAccountID();
  const [uiState, setUIState] = useState('default');
  const [collections, setCollections] = useState([]);
  const [reloadCount, reload] = useReducer((c) => c + 1, 0);

  useEffect(() => {
    setUIState('loading');
    (async () => {
      try {
        const collectionsIterator = masto.v1.accounts
          .$select(currentAccountID)
          .collections.list({ limit: COLLECTIONS_LIMIT })
          .values();
        const { value } = await collectionsIterator.next();
        setCollections(value?.collections ?? []);
        setUIState('default');
      } catch (e) {
        console.error(e);
        setUIState('error');
      }
    })();
  }, [reloadCount]);

  const [showCollectionAddEditModal, setShowCollectionAddEditModal] =
    useState(false);

  return (
    <div class="sheet" id="collection-add-remove-container">
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" alt={t`Close`} />
        </button>
      )}
      <header>
        <h2>
          <Trans>Add/Remove from Collections</Trans>
        </h2>
      </header>
      <main>
        {collections.length > 0 ? (
          <ul class="collection-add-remove">
            {collections.map((collection) => {
              const inCollection = collection.items?.some(
                (item) => item.accountId === accountID,
              );
              return (
                <li key={collection.id}>
                  <button
                    type="button"
                    class={`light ${inCollection ? 'checked' : ''}`}
                    disabled={uiState === 'loading'}
                    onClick={() => {
                      setUIState('loading');
                      (async () => {
                        try {
                          if (inCollection) {
                            const item = collection.items.find(
                              (i) => i.accountId === accountID,
                            );
                            await masto.v1.collections
                              .$select(collection.id)
                              .items.$select(item.id)
                              .remove();
                          } else {
                            await masto.v1.collections
                              .$select(collection.id)
                              .items.create({
                                accountId: accountID,
                              });
                          }
                          reload();
                        } catch (e) {
                          console.error(e);
                          setUIState('error');
                          showToast(
                            inCollection
                              ? t`Unable to remove from collection.`
                              : t`Unable to add to collection.`,
                          );
                        }
                      })();
                    }}
                  >
                    <Icon icon="check-circle" alt="☑️" />
                    <span>{collection.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : uiState === 'loading' ? (
          <p class="ui-state">
            <Loader abrupt />
          </p>
        ) : uiState === 'error' ? (
          <p class="ui-state">
            <Trans>Unable to load collections.</Trans>
          </p>
        ) : (
          <p class="ui-state">
            <Trans>No collections.</Trans>
          </p>
        )}
        <button
          type="button"
          class="plain2"
          onClick={() => setShowCollectionAddEditModal(true)}
          disabled={uiState !== 'default'}
        >
          <Icon icon="plus" size="l" />{' '}
          <span>
            <Trans>New collection</Trans>
          </span>
        </button>
      </main>
      {showCollectionAddEditModal && (
        <Modal
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCollectionAddEditModal(false);
            }
          }}
        >
          <CollectionAddEdit
            accountIds={[accountID]}
            onClose={(result) => {
              if (result.state === 'success') {
                reload();
              }
              setShowCollectionAddEditModal(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

export default AddRemoveCollectionsSheet;
