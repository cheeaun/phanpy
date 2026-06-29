import './collection-add-account.css';

import { ph } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useDebouncedCallback } from 'use-debounce';

import { api } from '../utils/api';
import { fetchRelationships } from '../utils/relationships';
import showToast from '../utils/show-toast';

import AccountBlock from './account-block';
import Icon from './icon';
import Loader from './loader';

function getAccountGroup(account, relationship) {
  const fa = account.featureApproval;
  const canBeAdded = ['automatic', 'manual'].includes(fa?.currentUser);
  if (canBeAdded) return 'available';
  const canBeAddedByFollowers =
    fa?.automatic?.includes('followers') || fa?.manual?.includes('followers');
  if (canBeAddedByFollowers && !relationship?.following) return 'mustFollow';
  return 'disabled';
}

function CollectionAddAccount({
  collectionId,
  instance,
  existingAccountIds = new Set(),
  onAdded = () => {},
  onClose = () => {},
}) {
  const { t } = useLingui();
  const { masto } = api({ instance });
  const [uiState, setUIState] = useState('default');
  const [accounts, setAccounts] = useState([]);
  const [relationshipsMap, setRelationshipsMap] = useState({});
  const [addingIds, setAddingIds] = useState(new Set());

  const loadRelationships = async (accounts) => {
    if (!accounts?.length) return;
    const relationships = await fetchRelationships(accounts, relationshipsMap);
    if (relationships) {
      setRelationshipsMap((prev) => ({
        ...prev,
        ...relationships,
      }));
    }
  };

  const loadAccounts = (term) => {
    if (!term) return;
    setUIState('loading');
    (async () => {
      try {
        const accounts = await masto.v1.accounts.search.list({
          q: term,
          limit: 30,
          resolve: true,
        });
        setAccounts(accounts);
        loadRelationships(accounts);
        setUIState('default');
      } catch (e) {
        setUIState('error');
        console.error(e);
      }
    })();
  };

  const debouncedLoadAccounts = useDebouncedCallback(loadAccounts, 1000);

  const inputRef = useRef();
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleAdd = (account) => {
    if (addingIds.has(account.id)) return;
    setAddingIds((prev) => new Set([...prev, account.id]));
    (async () => {
      try {
        const result = await masto.v1.collections
          .$select(collectionId)
          .items.create({
            accountId: account.id,
          });
        onAdded(account, result.collectionItem);
        showToast(
          t`@${ph({ username: account.username })} added to collection`,
        );
      } catch (e) {
        console.error(e);
        showToast(t`Unable to add account`);
      } finally {
        setAddingIds((prev) => {
          const next = new Set(prev);
          next.delete(account.id);
          return next;
        });
      }
    })();
  };

  const { sortedAccounts, footnoteGroups } = useMemo(() => {
    const available = [];
    const others = [];
    const groups = [];
    for (const account of accounts) {
      const relationship = relationshipsMap[account.id];
      const group = getAccountGroup(account, relationship);
      if (group === 'available') {
        available.push(account);
      } else {
        others.push(account);
        if (!groups.includes(group)) {
          groups.push(group);
        }
      }
    }
    return {
      sortedAccounts: [...available, ...others],
      footnoteGroups: groups,
    };
  }, [accounts, relationshipsMap]);

  return (
    <div id="collection-add-account-sheet" class="sheet">
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" alt={t`Close`} />
        </button>
      )}
      <header>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            debouncedLoadAccounts.flush?.();
          }}
        >
          <input
            ref={inputRef}
            required
            type="search"
            class="block"
            placeholder={t`Search accounts`}
            onInput={(e) => {
              const { value } = e.target;
              debouncedLoadAccounts(value);
            }}
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellCheck="false"
            dir="auto"
            enterKeyHint="search"
          />
        </form>
      </header>
      <main>
        {accounts?.length > 0 ? (
          <ul class={`accounts-list ${uiState === 'loading' ? 'loading' : ''}`}>
            {sortedAccounts.map((account) => {
              const relationship = relationshipsMap[account.id];
              const isExisting = existingAccountIds.has(account.id);
              const isAdding = addingIds.has(account.id);
              const group = getAccountGroup(account, relationship);
              const canAdd = !isExisting && group === 'available';
              return (
                <li
                  key={account.id}
                  class={group !== 'available' ? 'disabled' : ''}
                >
                  <AccountBlock
                    avatarSize="xxl"
                    account={account}
                    relationship={relationship}
                    showStats
                    showActivity
                  />
                  {isExisting ? (
                    <button type="button" class="plain" disabled>
                      <Icon icon="check-circle" size="xl" alt="" />
                    </button>
                  ) : canAdd ? (
                    <button
                      type="button"
                      class="plain2"
                      disabled={isAdding}
                      onClick={() => handleAdd(account)}
                    >
                      {isAdding ? (
                        <Loader abrupt />
                      ) : (
                        <Icon icon="plus" size="xl" alt={t`Add`} />
                      )}
                    </button>
                  ) : (
                    <span class="dummy-button-wrap">
                      <span class="dummy-button">
                        <span class="dummy-button-circle">
                          {footnoteGroups.indexOf(group) + 1}
                        </span>
                      </span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : uiState === 'loading' ? (
          <div class="ui-state">
            <Loader abrupt />
          </div>
        ) : uiState === 'error' ? (
          <div class="ui-state">
            <p>
              <Trans>Error loading accounts</Trans>
            </p>
          </div>
        ) : null}
      </main>
      {footnoteGroups.length > 0 && (
        <footer class="footnotes">
          <ol>
            {footnoteGroups.map((group) => (
              <li key={group}>
                {group === 'disabled' ? (
                  <Trans>
                    These accounts may have opted out of discovery or be on a
                    server that doesn't support collections.
                  </Trans>
                ) : (
                  <Trans>
                    These accounts review all follow requests. Followers can add
                    them to collections.
                  </Trans>
                )}
              </li>
            ))}
          </ol>
        </footer>
      )}
    </div>
  );
}

export default CollectionAddAccount;
