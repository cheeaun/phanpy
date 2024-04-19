import './accounts.css';

import { useAutoAnimate } from '@formkit/auto-animate/preact';
import { Menu, MenuDivider, MenuItem } from '@szhsin/react-menu';
import { useReducer } from 'preact/hooks';

import Avatar from '../components/avatar';
import Icon from '../components/icon';
import Link from '../components/link';
import Menu2 from '../components/menu2';
import MenuConfirm from '../components/menu-confirm';
import NameText from '../components/name-text';
import { api } from '../utils/api';
import states from '../utils/states';
import store from '../utils/store';
import { getCurrentAccountID, setCurrentAccountID } from '../utils/store-utils';

function Accounts({ onClose }) {
  const { masto } = api();
  // Accounts
  const accounts = store.local.getJSON('accounts');
  const currentAccount = getCurrentAccountID();
  const moreThanOneAccount = accounts.length > 1;

  const [_, reload] = useReducer((x) => x + 1, 0);
  const [accountsListParent] = useAutoAnimate();

  return (
    <div id="accounts-container" class="sheet" tabIndex="-1">
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" />
        </button>
      )}
      <header class="header-grid">
        <h2>Accounts</h2>
      </header>
      <main>
        <section>
          <ul class="accounts-list" ref={accountsListParent}>
            {accounts.map((account, i) => {
              const isCurrent = account.info.id === currentAccount;
              const isDefault = i === 0; // first account is always default
              return (
                <li key={account.info.id}>
                  <div>
                    {moreThanOneAccount && (
                      <span class={`current ${isCurrent ? 'is-current' : ''}`}>
                        <Icon icon="check-circle" alt="Current" />
                      </span>
                    )}
                    <Avatar
                      url={account.info.avatarStatic}
                      size="xxl"
                      onDblClick={async () => {
                        if (isCurrent) {
                          try {
                            const info = await masto.v1.accounts
                              .$select(account.info.id)
                              .fetch();
                            console.log('fetched account info', info);
                            account.info = info;
                            store.local.setJSON('accounts', accounts);
                            reload();
                          } catch (e) {}
                        }
                      }}
                    />
                    <NameText
                      account={
                        moreThanOneAccount
                          ? {
                              ...account.info,
                              acct: /@/.test(account.info.acct)
                                ? account.info.acct
                                : `${account.info.acct}@${account.instanceURL}`,
                            }
                          : account.info
                      }
                      showAcct
                      onClick={() => {
                        if (isCurrent) {
                          states.showAccount = `${account.info.username}@${account.instanceURL}`;
                        } else {
                          setCurrentAccountID(account.info.id);
                          location.reload();
                        }
                      }}
                    />
                  </div>
                  <div class="actions">
                    {isDefault && moreThanOneAccount && (
                      <>
                        <span class="tag">Default</span>{' '}
                      </>
                    )}
                    <Menu2
                      align="end"
                      menuButton={
                        <button
                          type="button"
                          title="More"
                          class="plain more-button"
                        >
                          <Icon icon="more" size="l" alt="More" />
                        </button>
                      }
                    >
                      <MenuItem
                        onClick={() => {
                          states.showAccount = `${account.info.username}@${account.instanceURL}`;
                        }}
                      >
                        <Icon icon="user" />
                        <span>View profile…</span>
                      </MenuItem>
                      <MenuDivider />
                      {moreThanOneAccount && (
                        <MenuItem
                          disabled={isDefault}
                          onClick={() => {
                            // Move account to the top of the list
                            accounts.splice(i, 1);
                            accounts.unshift(account);
                            store.local.setJSON('accounts', accounts);
                            reload();
                          }}
                        >
                          <Icon icon="check-circle" />
                          <span>Set as default</span>
                        </MenuItem>
                      )}
                      <MenuConfirm
                        subMenu
                        confirmLabel={
                          <>
                            <Icon icon="exit" />
                            <span>Log out @{account.info.acct}?</span>
                          </>
                        }
                        disabled={!isCurrent}
                        menuItemClassName="danger"
                        onClick={() => {
                          // const yes = confirm('Log out?');
                          // if (!yes) return;
                          accounts.splice(i, 1);
                          store.local.setJSON('accounts', accounts);
                          // location.reload();
                          location.href = location.pathname || '/';
                        }}
                      >
                        <Icon icon="exit" />
                        <span>Log out…</span>
                      </MenuConfirm>
                    </Menu2>
                  </div>
                </li>
              );
            })}
          </ul>
          <p>
            <Link to="/login" class="button plain2" onClick={onClose}>
              <Icon icon="plus" /> <span>Add an existing account</span>
            </Link>
          </p>
          {moreThanOneAccount && (
            <p>
              <small>
                Note: <i>Default</i> account will always be used for first load.
                Switched accounts will persist during the session.
              </small>
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

export default Accounts;
