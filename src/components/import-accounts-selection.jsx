import './import-accounts-selection.css';

import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { useMemo, useState } from 'preact/hooks';

import states from '../utils/states';
import { getAccounts, saveAccounts } from '../utils/store-utils';

import Avatar from './avatar';
import Icon from './icon';
import Loader from './loader';
import NameText from './name-text';

function ImportAccountsSelection({ accounts: importedAccounts, onClose }) {
  const { t } = useLingui();
  const existingAccounts = getAccounts();

  const { accountsToImport } = useMemo(() => {
    if (!importedAccounts) return { accountsToImport: [] };

    const statusOrder = { duplicate: 0, new: 1 };
    const accountsToImport = importedAccounts
      .map((account) => {
        const existing = existingAccounts.find(
          (a) =>
            a.info.id === account.info.id &&
            a.instanceURL === account.instanceURL,
        );
        const status = existing ? 'duplicate' : 'new';
        return {
          ...account,
          __status: status,
        };
      })
      .sort((a, b) => {
        return statusOrder[a.__status] - statusOrder[b.__status];
      });

    return { accountsToImport };
  }, [importedAccounts, existingAccounts]);

  const [selectedAccounts, setSelectedAccounts] = useState(() => {
    const initialSelection = {};
    accountsToImport.forEach((a) => {
      if (a.__status === 'duplicate') {
        initialSelection[a.info.id + a.instanceURL] = false;
      } else {
        initialSelection[a.info.id + a.instanceURL] = true;
      }
    });
    return initialSelection;
  });

  const [uiState, setUIState] = useState('default');

  const handleImportSelection = () => {
    setUIState('importing');
    const newAccounts = [
      ...existingAccounts,
      ...importedAccounts.filter(
        (account) => selectedAccounts[account.info.id + account.instanceURL],
      ),
    ];
    saveAccounts(newAccounts);
    onClose();
    states.showImportExportAccounts = false;
    states.showAccounts = true;
  };

  const selectedCount = Object.values(selectedAccounts).filter(Boolean).length;

  return (
    <div id="import-accounts-selection-container" class="sheet">
      {!!onClose && (
        <button
          type="button"
          class="sheet-close"
          onClick={onClose}
          disabled={uiState === 'importing'}
        >
          <Icon icon="x" alt={t`Close`} />
        </button>
      )}
      <header>
        <b>
          <Trans>Select accounts to import</Trans>
        </b>
      </header>
      <main>
        <div class="import-selection">
          {accountsToImport.filter((a) => a.__status !== 'duplicate').length >
            3 && (
            <div class="accounts-list-header">
              <label class="account-item">
                <input
                  type="checkbox"
                  checked={
                    accountsToImport.filter((a) => a.__status !== 'duplicate')
                      .length > 0 &&
                    accountsToImport
                      .filter((a) => a.__status !== 'duplicate')
                      .every((a) => selectedAccounts[a.info.id + a.instanceURL])
                  }
                  onChange={(e) => {
                    const newSelection = { ...selectedAccounts };
                    const shouldSelect = e.target.checked;
                    accountsToImport.forEach((a) => {
                      if (a.__status !== 'duplicate') {
                        newSelection[a.info.id + a.instanceURL] = shouldSelect;
                      }
                    });
                    setSelectedAccounts(newSelection);
                  }}
                  disabled={uiState === 'importing'}
                />
                <span class="account-info">
                  <Trans>Select all</Trans>
                </span>
              </label>
            </div>
          )}
          <ul class="accounts-list">
            {accountsToImport.map((account) => {
              const key = account.info.id + account.instanceURL;
              const isSelected = selectedAccounts[key];
              const { __status: status } = account;
              return (
                <li key={key}>
                  <label class="account-item">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        setSelectedAccounts({
                          ...selectedAccounts,
                          [key]: e.target.checked,
                        });
                      }}
                      disabled={
                        uiState === 'importing' || status === 'duplicate'
                      }
                    />
                    <Avatar url={account.info.avatarStatic} size="xl" />
                    <div class="account-info">
                      <NameText
                        account={{
                          ...account.info,
                          acct: /@/.test(account.info.acct)
                            ? account.info.acct
                            : `${account.info.acct}@${account.instanceURL}`,
                        }}
                        showAcct
                      />
                    </div>
                    <div class="account-meta">
                      {status === 'duplicate' && (
                        <span class="tag collapsed">
                          <Trans>Existing</Trans>
                        </span>
                      )}
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>

          <footer>
            <button
              type="button"
              class="light"
              onClick={onClose}
              disabled={uiState === 'importing'}
            >
              <Trans>Cancel</Trans>
            </button>
            <Loader hidden={uiState !== 'importing'} />
            <button
              type="button"
              disabled={selectedCount === 0 || uiState === 'importing'}
              onClick={handleImportSelection}
            >
              <Plural
                value={selectedCount}
                one="Import # account"
                other="Import # accounts"
              />
            </button>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default ImportAccountsSelection;
