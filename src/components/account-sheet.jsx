import { useEffect } from 'preact/hooks';

import { api } from '../utils/api';
import states from '../utils/states';

import AccountInfo from './account-info';
import Icon from './icon';

function AccountSheet({ account, instance: propInstance, onClose }) {
  const { masto, instance, authenticated } = api({ instance: propInstance });
  const isString = typeof account === 'string';

  useEffect(() => {
    if (!isString) {
      states.accounts[`${account.id}@${instance}`] = account;
    }
  }, [account]);

  return (
    <div
      class="sheet"
      onClick={(e) => {
        const accountBlock = e.target.closest('.account-block');
        if (accountBlock) {
          onClose({
            destination: 'account-statuses',
          });
        }
      }}
    >
      {!!onClose && (
        <button type="button" class="sheet-close outer" onClick={onClose}>
          <Icon icon="x" />
        </button>
      )}
      <AccountInfo
        instance={instance}
        authenticated={authenticated}
        account={account}
        fetchAccount={async () => {
          if (isString) {
            try {
              const info = await masto.v1.accounts.lookup({
                acct: account,
                skip_webfinger: false,
              });
              return info;
            } catch (e) {
              const result = await masto.v2.search({
                q: account,
                type: 'accounts',
                limit: 1,
                resolve: authenticated,
              });
              if (result.accounts.length) {
                return result.accounts[0];
              } else if (/https?:\/\/[^/]+\/@/.test(account)) {
                const accountURL = new URL(account);
                const acct = accountURL.pathname.replace(/^\//, '');
                const result = await masto.v2.search({
                  q: acct,
                  type: 'accounts',
                  limit: 1,
                  resolve: authenticated,
                });
                if (result.accounts.length) {
                  return result.accounts[0];
                }
              }
            }
          } else {
            return account;
          }
        }}
      />
    </div>
  );
}

export default AccountSheet;
