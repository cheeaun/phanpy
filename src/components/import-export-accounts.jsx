import './import-export-accounts.css';

import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'preact/hooks';

import showToast from '../utils/show-toast';
import { getAccounts } from '../utils/store-utils';

import Icon from './icon';
import ImportAccountsSelection from './import-accounts-selection';
import Modal from './modal';

export default function ImportExportAccounts({ onClose }) {
  const { t } = useLingui();
  const accounts = getAccounts();
  const [uiState, setUIState] = useState('default');
  const [importedAccounts, setImportedAccounts] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const handleExport = async () => {
    setUIState('exporting');
    try {
      const accounts = getAccounts();
      const accountsToExport = accounts.map((account) => {
        const { accessToken, ...rest } = account;
        return rest;
      });

      const exportData = {
        accounts: accountsToExport,
        createdAt: Date.now(),
      };
      const json = JSON.stringify(exportData);

      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
        2,
        '0',
      )}-${String(now.getDate()).padStart(2, '0')}_${String(
        now.getHours(),
      ).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
      a.download = `accounts-${date}.phanpy.json`;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (e) {
      console.error(e);
      showToast(t`Export failed`);
      setUIState('error');
    }
  };

  const processFile = async (file) => {
    if (!file) return;

    setUIState('importing');
    try {
      const text = await file.text();
      const json = JSON.parse(text);

      const accounts = json?.accounts;
      if (!Array.isArray(accounts)) throw new Error('Invalid backup file');

      setImportedAccounts(accounts);
      setUIState('default');
    } catch (e) {
      console.error(e);
      showToast(t`Import failed`);
      setUIState('error');
    }
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    processFile(file);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const onDragLeave = () => {
    setDragOver(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    processFile(file);
  };

  return (
    <div
      id="import-export-accounts-container"
      class="sheet"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" alt={t`Close`} />
        </button>
      )}
      <header>
        <h2>
          <Trans>
            Import/Export <small class="ib insignificant">Accounts</small>
          </Trans>
        </h2>
      </header>
      <main>
        <section>
          <label
            class={`section-button button-import button plain4 ${
              dragOver ? 'drag-over' : ''
            }`}
            tabindex="0"
          >
            <Icon icon="arrow-down-circle" size="xxl" />
            <b>
              <Trans>Import</Trans>
            </b>
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              disabled={uiState === 'importing'}
              style={{ display: 'none' }}
            />
            <div>
              <small class="insignificant">Select file…</small>
            </div>
          </label>{' '}
          <button
            type="button"
            class="section-button button-export plain4"
            onClick={handleExport}
            disabled={uiState === 'exporting' || accounts.length === 0}
          >
            <Icon icon="arrow-up-circle" size="xxl" />
            <b>
              <Trans>Export</Trans>
            </b>
            <div>
              <small class="insignificant">
                <Plural
                  value={accounts.length}
                  one="# account"
                  other="# accounts"
                />
              </small>
            </div>
          </button>
        </section>

        <p class="insignificant">
          <small>
            <Trans>
              No login information or account access details are stored in the
              exported files. You will need to log in again for each account
              after importing.
            </Trans>
          </small>
        </p>
      </main>
      {importedAccounts && (
        <Modal
          onClose={() => {
            setImportedAccounts(null);
          }}
        >
          <ImportAccountsSelection
            accounts={importedAccounts}
            onClose={() => {
              setImportedAccounts(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
