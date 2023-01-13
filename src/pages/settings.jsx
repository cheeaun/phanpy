import './settings.css';

import { useRef, useState } from 'preact/hooks';

import Avatar from '../components/avatar';
import Icon from '../components/icon';
import NameText from '../components/name-text';
import RelativeTime from '../components/relative-time';
import states from '../utils/states';
import store from '../utils/store';

/*
  Settings component that shows these settings:
  - Accounts list for switching
  - Dark/light/auto theme switch (done with adding/removing 'is-light' or 'is-dark' class on the body)
*/

function Settings({ onClose }) {
  // Accounts
  const accounts = store.local.getJSON('accounts');
  const currentAccount = store.session.get('currentAccount');
  const currentTheme = store.local.get('theme') || 'auto';
  const themeFormRef = useRef();
  const moreThanOneAccount = accounts.length > 1;
  const [currentDefault, setCurrentDefault] = useState(0);

  return (
    <div id="settings-container" class="sheet" tabIndex="-1">
      <main>
        {/* <button type="button" class="close-button plain large" onClick={onClose}>
        <Icon icon="x" alt="Close" />
      </button> */}
        <h2>Accounts</h2>
        <ul class="accounts-list">
          {accounts.map((account, i) => {
            const isCurrent = account.info.id === currentAccount;
            const isDefault = i === (currentDefault || 0);
            return (
              <li>
                <div>
                  {moreThanOneAccount && (
                    <span class={`current ${isCurrent ? 'is-current' : ''}`}>
                      <Icon icon="check-circle" alt="Current" />
                    </span>
                  )}
                  <Avatar url={account.info.avatarStatic} size="xxl" />
                  <NameText
                    account={account.info}
                    showAcct
                    onClick={() => {
                      states.showAccount = `${account.info.username}@${account.instanceURL}`;
                    }}
                  />
                </div>
                <div class="actions">
                  {isDefault && moreThanOneAccount && (
                    <>
                      <span class="tag">Default</span>{' '}
                    </>
                  )}
                  {!isCurrent && (
                    <button
                      type="button"
                      class="light"
                      onClick={() => {
                        store.session.set('currentAccount', account.info.id);
                        location.reload();
                      }}
                    >
                      <Icon icon="transfer" /> Switch
                    </button>
                  )}
                  <div>
                    {!isDefault && moreThanOneAccount && (
                      <button
                        type="button"
                        class="plain small"
                        onClick={() => {
                          // Move account to the top of the list
                          accounts.splice(i, 1);
                          accounts.unshift(account);
                          store.local.setJSON('accounts', accounts);
                          setCurrentDefault(i);
                        }}
                      >
                        Set as default
                      </button>
                    )}
                    {isCurrent && (
                      <>
                        {' '}
                        <button
                          type="button"
                          class="plain small"
                          onClick={() => {
                            const yes = confirm(
                              'Are you sure you want to log out?',
                            );
                            if (!yes) return;
                            accounts.splice(i, 1);
                            store.local.setJSON('accounts', accounts);
                            location.reload();
                          }}
                        >
                          Log out
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {moreThanOneAccount && (
          <p>
            <small>
              Note: <i>Default</i> account will always be used for first load.
              Switched accounts will persist during the session.
            </small>
          </p>
        )}
        <p style={{ textAlign: 'end' }}>
          <a href="/#/login" class="button" onClick={onClose}>
            Add new account
          </a>
        </p>
        <h2>Theme</h2>
        <form
          ref={themeFormRef}
          onInput={(e) => {
            console.log(e);
            e.preventDefault();
            const formData = new FormData(themeFormRef.current);
            const theme = formData.get('theme');
            const html = document.documentElement;

            if (theme === 'auto') {
              html.classList.remove('is-light', 'is-dark');
            } else {
              html.classList.toggle('is-light', theme === 'light');
              html.classList.toggle('is-dark', theme === 'dark');
            }
            document
              .querySelector('meta[name="color-scheme"]')
              .setAttribute('content', theme);

            if (theme === 'auto') {
              store.local.del('theme');
            } else {
              store.local.set('theme', theme);
            }
          }}
        >
          <div class="radio-group">
            <label>
              <input
                type="radio"
                name="theme"
                value="light"
                defaultChecked={currentTheme === 'light'}
              />
              <span>Light</span>
            </label>
            <label>
              <input
                type="radio"
                name="theme"
                value="dark"
                defaultChecked={currentTheme === 'dark'}
              />
              <span>Dark</span>
            </label>
            <label>
              <input
                type="radio"
                name="theme"
                value="auto"
                defaultChecked={
                  currentTheme !== 'light' && currentTheme !== 'dark'
                }
              />
              <span>Auto</span>
            </label>
          </div>
        </form>
        <h2>Hidden features</h2>
        <p>
          <button
            type="button"
            class="light"
            onClick={() => {
              states.showDrafts = true;
              states.showSettings = false;
            }}
          >
            Unsent drafts
          </button>
        </p>
        <h2>About</h2>
        <p>
          <a href="https://github.com/cheeaun/phanpy" target="_blank">
            Built
          </a>{' '}
          by{' '}
          <a
            href="https://mastodon.social/@cheeaun"
            // target="_blank"
            onClick={(e) => {
              e.preventDefault();
              states.showAccount = 'cheeaun@mastodon.social';
            }}
          >
            @cheeaun
          </a>
          .
        </p>
        {__BUILD_TIME__ && (
          <p>
            Last build: <RelativeTime datetime={new Date(__BUILD_TIME__)} />{' '}
            {__COMMIT_HASH__ && (
              <>
                (
                <a
                  href={`https://github.com/cheeaun/phanpy/commit/${__COMMIT_HASH__}`}
                  target="_blank"
                >
                  <code>{__COMMIT_HASH__}</code>
                </a>
                )
              </>
            )}
          </p>
        )}
      </main>
    </div>
  );
}

export default Settings;
