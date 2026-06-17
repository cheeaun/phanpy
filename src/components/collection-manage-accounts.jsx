import './collection-manage-accounts.css';

import { ph } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { forwardRef } from 'preact/compat';
import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'preact/hooks';

import { api } from '../utils/api';
import { fetchRelationships } from '../utils/relationships';
import showToast from '../utils/show-toast';

import AccountBlock from './account-block';
import CollectionAddAccount from './collection-add-account';
import Icon from './icon';
import Loader from './loader';
import MenuConfirm from './menu-confirm';
import Modal from './modal';

const CollectionManageAccounts = forwardRef(function CollectionManageAccounts(
  {
    collection,
    accounts = [],
    instance,
    onClose = () => {},
    onDataChange = () => {},
  },
  ref,
) {
  const { t } = useLingui();
  const { masto } = api({ instance });

  const [collectionItems, setCollectionItems] = useState(
    collection?.items || [],
  );
  const [showAddAccount, setShowAddAccount] = useState(false);

  useImperativeHandle(ref, () => ({
    openAddAccount: () => setShowAddAccount(true),
  }));
  const [removingItems, setRemovingItems] = useState(new Set());
  const [relationshipsMap, setRelationshipsMap] = useState({});

  const accountsMap = useMemo(() => {
    const map = {};
    for (const account of accounts) {
      map[account.id] = account;
    }
    return map;
  }, [accounts]);

  useEffect(() => {
    if (!accounts?.length) return;
    let aborted = false;
    fetchRelationships(accounts, relationshipsMap).then((relationships) => {
      if (aborted) return;
      if (relationships) {
        setRelationshipsMap((prev) => ({
          ...prev,
          ...relationships,
        }));
      }
    });
    return () => {
      aborted = true;
    };
  }, [accounts]);

  const handleRemove = (item, account) => {
    if (removingItems.has(item.id)) return;
    setRemovingItems((prev) => new Set([...prev, item.id]));
    (async () => {
      let success = false;
      try {
        await masto.v1.collections
          .$select(collection.id)
          .items.$select(item.id)
          .remove();
        success = true;
      } catch (e) {
        // Work around masto.js failing to parse 200 OK empty-body DELETE responses
        if (e?.name === 'MastoUnexpectedError') {
          success = true;
        } else {
          console.error(e);
          showToast(t`Unable to remove account`);
        }
      }
      if (success) {
        const newItems = collectionItems.filter((i) => i.id !== item.id);
        setCollectionItems(newItems);
        onDataChange({
          collectionItems: newItems,
          accounts,
        });
        showToast(
          t`@${ph({ username: account.username })} removed from collection`,
        );
      }
      setRemovingItems((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    })();
  };

  const existingAccountIds = useMemo(
    () => new Set(collectionItems.map((i) => i.accountId)),
    [collectionItems],
  );

  return (
    <div id="collection-manage-accounts-container" class="sheet">
      <button type="button" class="sheet-close" onClick={onClose}>
        <Icon icon="x" alt={t`Close`} />
      </button>
      <header>
        <h2>
          <Trans>Manage accounts</Trans>
        </h2>
      </header>
      <main>
        <ul class="accounts-list">
          {collectionItems.map((item) => {
            const account = accountsMap[item.accountId];
            if (!account) return null;
            const isRemoving = removingItems.has(item.id);
            return (
              <li key={item.id}>
                <div class="account-block-wrap">
                  <AccountBlock
                    account={account}
                    instance={instance}
                    relationship={relationshipsMap[account.id]}
                  />
                  {item.state === 'pending' && (
                    <span class="tag insignificant">
                      <Trans>Pending</Trans>
                    </span>
                  )}
                </div>
                <MenuConfirm
                  confirmLabel={
                    <span>
                      <Trans>
                        Remove{' '}
                        <span class="bidi-isolate">
                          {ph({
                            username: `@${account.username}`,
                          })}
                        </span>{' '}
                        from this collection?
                      </Trans>
                    </span>
                  }
                  menuItemClassName="danger"
                  align="end"
                  onClick={() => handleRemove(item, account)}
                >
                  <button
                    type="button"
                    class={`light ${isRemoving ? '' : 'danger'}`}
                    disabled={isRemoving}
                  >
                    {isRemoving ? <Loader abrupt /> : t`Remove…`}
                  </button>
                </MenuConfirm>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          class="light"
          onClick={() => setShowAddAccount(true)}
        >
          <Icon icon="plus" />{' '}
          <span>
            <Trans>Add account</Trans>
          </span>
        </button>
      </main>
      {showAddAccount && (
        <Modal
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddAccount(false);
            }
          }}
        >
          <CollectionAddAccount
            collectionId={collection.id}
            instance={instance}
            existingAccountIds={existingAccountIds}
            onAdded={(account, newItem) => {
              const newItems = [...collectionItems, newItem];
              const newAccounts = [...accounts, account];
              setCollectionItems(newItems);
              onDataChange({
                collectionItems: newItems,
                accounts: newAccounts,
              });
            }}
            onClose={() => setShowAddAccount(false)}
          />
        </Modal>
      )}
    </div>
  );
});

export default CollectionManageAccounts;
