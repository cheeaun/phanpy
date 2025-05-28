import './accounts.css';

import { useAutoAnimate } from '@formkit/auto-animate/preact';
import { Trans, useLingui } from '@lingui/react/macro';
import { Menu, MenuDivider, MenuItem } from '@szhsin/react-menu';
import { useReducer } from 'preact/hooks';

import Avatar from '../components/avatar';
import Icon from '../components/icon';
import Link from '../components/link';
import MenuConfirm from '../components/menu-confirm';
import MenuLink from '../components/menu-link';
import Menu2 from '../components/menu2';
import NameText from '../components/name-text';
import RelativeTime from '../components/relative-time';
import { api } from '../utils/api';
import { revokeAccessToken } from '../utils/auth';
import niceDateTime from '../utils/nice-date-time';
import states from '../utils/states';
import store from '../utils/store';
import {
  getAccounts,
  getCurrentAccountID,
  saveAccounts,
  setCurrentAccountID,
} from '../utils/store-utils';

const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

function Accounts({ onClose }) {
  const { t } = useLingui();
  const { masto } = api();
  // Accounts
  const accounts = getAccounts();
  const currentAccount = getCurrentAccountID();
  const moreThanOneAccount = accounts.length > 1;

  const [_, reload] = useReducer((x) => x + 1, 0);
  const [accountsListParent] = useAutoAnimate();

  return (
    <div id="accounts-container" class="sheet" tabIndex="-1">
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" alt={t`Close`} />
        </button>
      )}
      <header class="header-grid">
        <h2>
          <Trans>Accounts</Trans>
        </h2>
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
                        <Icon icon="check-circle" alt={t`Current`} />
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
                            saveAccounts(accounts);
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
                        <span class="tag">
                          <Trans>Default</Trans>
                        </span>{' '}
                      </>
                    )}
                    <Menu2
                      align="end"
                      menuButton={
                        <button type="button" class="plain more-button">
                          <Icon icon="more" size="l" alt={t`More`} />
                        </button>
                      }
                    >
                      {moreThanOneAccount && (
                        <>
                          <MenuItem
                            disabled={isCurrent}
                            onClick={() => {
                              setCurrentAccountID(account.info.id);
                              location.reload();
                            }}
                          >
                            <Icon icon="transfer" />{' '}
                            <Trans>Switch to this account</Trans>
                          </MenuItem>
                          {!isStandalone && !isCurrent && (
                            <MenuLink
                              href={`./?account=${account.info.id}`}
                              target="_blank"
                            >
                              <Icon icon="external" />
                              <span>
                                <Trans>Switch in new tab/window</Trans>
                              </span>
                            </MenuLink>
                          )}
                          <MenuDivider />
                        </>
                      )}
                      <MenuItem
                        onClick={() => {
                          states.showAccount = `${account.info.username}@${account.instanceURL}`;
                        }}
                      >
                        <Icon icon="user" />
                        <span>
                          <Trans>View profile…</Trans>
                        </span>
                      </MenuItem>
                      <MenuDivider />
                      {moreThanOneAccount && (
                        <>
                          <MenuItem
                            disabled={isDefault}
                            onClick={() => {
                              // Move account to the top of the list
                              accounts.splice(i, 1);
                              accounts.unshift(account);
                              saveAccounts(accounts);
                              reload();
                            }}
                          >
                            <Icon icon="check-circle" />
                            <span>
                              <Trans>Set as default</Trans>
                            </span>
                          </MenuItem>
                          <MenuItem
                            disabled={i <= 1}
                            onClick={() => {
                              // Move account one position up
                              accounts.splice(i, 1);
                              accounts.splice(i - 1, 0, account);
                              saveAccounts(accounts);
                              reload();
                            }}
                          >
                            <Icon icon="arrow-up" />
                            <span>
                              <Trans>Move up</Trans>
                            </span>
                          </MenuItem>
                          <MenuItem
                            disabled={i === 0 || i === accounts.length - 1}
                            onClick={() => {
                              // Move account one position down
                              accounts.splice(i, 1);
                              accounts.splice(i + 1, 0, account);
                              saveAccounts(accounts);
                              reload();
                            }}
                          >
                            <Icon icon="arrow-down" />
                            <span>
                              <Trans>Move down</Trans>
                            </span>
                          </MenuItem>
                          <MenuDivider />
                        </>
                      )}
                      <MenuConfirm
                        subMenu
                        confirmLabel={
                          <>
                            <Icon icon="exit" />
                            <span>
                              <Trans>
                                Log out{' '}
                                <span class="bidi-isolate">
                                  @{account.info.acct}
                                </span>
                                ?
                              </Trans>
                            </span>
                          </>
                        }
                        disabled={!isCurrent}
                        menuItemClassName="danger"
                        onClick={async () => {
                          // const yes = confirm('Log out?');
                          // if (!yes) return;
                          await revokeAccessToken({
                            instanceURL: account.instanceURL,
                            client_id: account.clientId,
                            client_secret: account.clientSecret,
                            token: account.accessToken,
                          });
                          accounts.splice(i, 1);
                          saveAccounts(accounts);
                          // location.reload();
                          location.href = location.pathname || '/';
                        }}
                      >
                        <Icon icon="exit" />
                        <span>
                          <Trans>Log out…</Trans>
                        </span>
                      </MenuConfirm>
                      {!!account?.createdAt && (
                        <div class="footer">
                          <Icon icon="account-add" />
                          <span>
                            <Trans>
                              Connected on {niceDateTime(account.createdAt)} (
                              <RelativeTime datetime={account.createdAt} />)
                            </Trans>
                          </span>
                        </div>
                      )}
                    </Menu2>
                  </div>
                </li>
              );
            })}
          </ul>
          <p>
            <Link to="/login" class="button plain2" onClick={onClose}>
              <Icon icon="plus" />{' '}
              <span>
                <Trans>Add an existing account</Trans>
              </span>
            </Link>
          </p>
          {moreThanOneAccount && (
            <p>
              <small>
                <Trans>
                  Note: <i>Default</i> account will always be used for first
                  load. Switched accounts will persist during the session.
                </Trans>
              </small>
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

export default Accounts;
