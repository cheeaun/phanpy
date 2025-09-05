import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useHotkeys } from 'react-hotkeys-hook';
import { useDebouncedCallback } from 'use-debounce';

import { api } from '../utils/api';
import { fetchRelationships } from '../utils/relationships';

import AccountBlock from './account-block';
import Icon from './icon';
import Loader from './loader';

function MentionModal({
  onClose = () => {},
  onSelect = () => {},
  defaultSearchTerm,
}) {
  const { t } = useLingui();
  const { masto } = api();
  const [uiState, setUIState] = useState('default');
  const [accounts, setAccounts] = useState([]);
  const [relationshipsMap, setRelationshipsMap] = useState({});

  const [selectedIndex, setSelectedIndex] = useState(0);

  const loadRelationships = async (accounts) => {
    if (!accounts?.length) return;
    const relationships = await fetchRelationships(accounts, relationshipsMap);
    if (relationships) {
      setRelationshipsMap({
        ...relationshipsMap,
        ...relationships,
      });
    }
  };

  const loadAccounts = (term) => {
    if (!term) return;
    setUIState('loading');
    (async () => {
      try {
        const accounts = await masto.v1.accounts.search.list({
          q: term,
          limit: 40,
          resolve: false,
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

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const inputRef = useRef();
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      // Put cursor at the end
      if (inputRef.current.value) {
        inputRef.current.selectionStart = inputRef.current.value.length;
        inputRef.current.selectionEnd = inputRef.current.value.length;
      }
    }
  }, []);

  useEffect(() => {
    if (defaultSearchTerm) {
      loadAccounts(defaultSearchTerm);
    }
  }, [defaultSearchTerm]);

  const selectAccount = (account) => {
    const socialAddress = account.acct;
    onSelect(socialAddress);
    onClose();
  };

  useHotkeys(
    'enter',
    () => {
      const selectedAccount = accounts[selectedIndex];
      if (selectedAccount) {
        selectAccount(selectedAccount);
      }
    },
    {
      preventDefault: true,
      enableOnFormTags: ['input'],
      useKey: true,
      ignoreEventWhen: (e) => e.metaKey || e.ctrlKey || e.altKey || e.shiftKey,
    },
  );

  const listRef = useRef();
  useHotkeys(
    'down',
    () => {
      if (selectedIndex < accounts.length - 1) {
        setSelectedIndex(selectedIndex + 1);
      } else {
        setSelectedIndex(0);
      }
      setTimeout(() => {
        const selectedItem = listRef.current.querySelector('.selected');
        if (selectedItem) {
          selectedItem.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center',
          });
        }
      }, 1);
    },
    {
      preventDefault: true,
      enableOnFormTags: ['input'],
      useKey: true,
      ignoreEventWhen: (e) => e.metaKey || e.ctrlKey || e.altKey || e.shiftKey,
    },
  );

  useHotkeys(
    'up',
    () => {
      if (selectedIndex > 0) {
        setSelectedIndex(selectedIndex - 1);
      } else {
        setSelectedIndex(accounts.length - 1);
      }
      setTimeout(() => {
        const selectedItem = listRef.current.querySelector('.selected');
        if (selectedItem) {
          selectedItem.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center',
          });
        }
      }, 1);
    },
    {
      preventDefault: true,
      enableOnFormTags: ['input'],
      useKey: true,
      ignoreEventWhen: (e) => e.metaKey || e.ctrlKey || e.altKey || e.shiftKey,
    },
  );

  return (
    <div id="mention-sheet" class="sheet">
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
            // const searchTerm = inputRef.current.value;
            // debouncedLoadAccounts(searchTerm);
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
            defaultValue={defaultSearchTerm || ''}
          />
        </form>
      </header>
      <main>
        {accounts?.length > 0 ? (
          <ul
            ref={listRef}
            class={`accounts-list ${uiState === 'loading' ? 'loading' : ''}`}
          >
            {accounts.map((account, i) => {
              const relationship = relationshipsMap[account.id];
              return (
                <li
                  key={account.id}
                  class={i === selectedIndex ? 'selected' : ''}
                >
                  <AccountBlock
                    avatarSize="xxl"
                    account={account}
                    relationship={relationship}
                    showStats
                    showActivity
                  />
                  <button
                    type="button"
                    class="plain2"
                    onClick={() => {
                      selectAccount(account);
                    }}
                  >
                    <Icon icon="plus" size="xl" alt={t`Add`} />
                  </button>
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
    </div>
  );
}

export default MentionModal;
