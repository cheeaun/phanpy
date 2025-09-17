import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useReducer, useState } from 'preact/hooks';

import { api } from '../utils/api';
import { getLists } from '../utils/lists';

import Icon from './icon';
import ListAddEdit from './list-add-edit';
import Loader from './loader';
import Modal from './modal';

function AddRemoveListsSheet({ accountID, onClose }) {
  const { t } = useLingui();
  const { masto } = api();
  const [uiState, setUIState] = useState('default');
  const [lists, setLists] = useState([]);
  const [listsContainingAccount, setListsContainingAccount] = useState([]);
  const [reloadCount, reload] = useReducer((c) => c + 1, 0);

  useEffect(() => {
    setUIState('loading');
    (async () => {
      try {
        const lists = await getLists();
        setLists(lists);
        const listsContainingAccount = await masto.v1.accounts
          .$select(accountID)
          .lists.list();
        console.log({ lists, listsContainingAccount });
        setListsContainingAccount(listsContainingAccount);
        setUIState('default');
      } catch (e) {
        console.error(e);
        setUIState('error');
      }
    })();
  }, [reloadCount]);

  const [showListAddEditModal, setShowListAddEditModal] = useState(false);

  return (
    <div class="sheet" id="list-add-remove-container">
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" alt={t`Close`} />
        </button>
      )}
      <header>
        <h2>
          <Trans>Add/Remove from Lists</Trans>
        </h2>
      </header>
      <main>
        {lists.length > 0 ? (
          <ul class="list-add-remove">
            {lists.map((list) => {
              const inList = listsContainingAccount.some(
                (l) => l.id === list.id,
              );
              return (
                <li>
                  <button
                    type="button"
                    class={`light ${inList ? 'checked' : ''}`}
                    disabled={uiState === 'loading'}
                    onClick={() => {
                      setUIState('loading');
                      (async () => {
                        try {
                          if (inList) {
                            await masto.v1.lists
                              .$select(list.id)
                              .accounts.remove({
                                accountIds: [accountID],
                              });
                          } else {
                            await masto.v1.lists
                              .$select(list.id)
                              .accounts.create({
                                accountIds: [accountID],
                              });
                          }
                          // setUIState('default');
                          reload();
                        } catch (e) {
                          console.error(e);
                          setUIState('error');
                          alert(
                            inList
                              ? t`Unable to remove from list.`
                              : t`Unable to add to list.`,
                          );
                        }
                      })();
                    }}
                  >
                    <Icon icon="check-circle" alt="☑️" />
                    <span>{list.title}</span>
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
            <Trans>Unable to load lists.</Trans>
          </p>
        ) : (
          <p class="ui-state">
            <Trans>No lists.</Trans>
          </p>
        )}
        <button
          type="button"
          class="plain2"
          onClick={() => setShowListAddEditModal(true)}
          disabled={uiState !== 'default'}
        >
          <Icon icon="plus" size="l" />{' '}
          <span>
            <Trans>New list</Trans>
          </span>
        </button>
      </main>
      {showListAddEditModal && (
        <Modal
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowListAddEditModal(false);
            }
          }}
        >
          <ListAddEdit
            list={showListAddEditModal?.list}
            onClose={(result) => {
              if (result.state === 'success') {
                reload();
              }
              setShowListAddEditModal(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

export default AddRemoveListsSheet;
