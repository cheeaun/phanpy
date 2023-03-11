import { useHotkeys } from 'react-hotkeys-hook';

import { api } from '../utils/api';

import AccountInfo from './account-info';

function AccountSheet({ account, instance: propInstance, onClose }) {
  const { masto, instance, authenticated } = api({ instance: propInstance });
  const isString = typeof account === 'string';

  const escRef = useHotkeys('esc', onClose, [onClose]);

  return (
    <div
      ref={escRef}
      class="sheet"
      onClick={(e) => {
        const accountBlock = e.target.closest('.account-block');
        if (accountBlock) {
          onClose();
        }
      }}
    >
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
