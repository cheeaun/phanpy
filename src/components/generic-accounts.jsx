import './generic-accounts.css';

import { useEffect, useRef, useState } from 'preact/hooks';
import { InView } from 'react-intersection-observer';
import { useSnapshot } from 'valtio';

import states from '../utils/states';
import useLocationChange from '../utils/useLocationChange';

import AccountBlock from './account-block';
import Icon from './icon';
import Loader from './loader';

export default function GenericAccounts({ onClose = () => {} }) {
  const snapStates = useSnapshot(states);
  const [uiState, setUIState] = useState('default');
  const [accounts, setAccounts] = useState([]);
  const [showMore, setShowMore] = useState(false);

  useLocationChange(onClose);

  if (!snapStates.showGenericAccounts) {
    return null;
  }

  const {
    id,
    heading,
    fetchAccounts,
    accounts: staticAccounts,
    showReactions,
  } = snapStates.showGenericAccounts;

  const loadAccounts = (firstLoad) => {
    if (!fetchAccounts) return;
    if (firstLoad) setAccounts([]);
    setUIState('loading');
    (async () => {
      try {
        const { done, value } = await fetchAccounts(firstLoad);
        if (Array.isArray(value)) {
          if (firstLoad) {
            setAccounts(value);
          } else {
            setAccounts((prev) => [...prev, ...value]);
          }
          setShowMore(!done);
        } else {
          setShowMore(false);
        }
        setUIState('default');
      } catch (e) {
        console.error(e);
        setUIState('error');
      }
    })();
  };

  const firstLoad = useRef(true);
  useEffect(() => {
    if (staticAccounts?.length > 0) {
      setAccounts(staticAccounts);
    } else {
      loadAccounts(true);
      firstLoad.current = false;
    }
  }, [staticAccounts, fetchAccounts]);

  useEffect(() => {
    if (firstLoad.current) return;
    // reloadGenericAccounts contains value like {id: 'mute', counter: 1}
    // We only need to reload if the id matches
    if (snapStates.reloadGenericAccounts?.id === id) {
      loadAccounts(true);
    }
  }, [snapStates.reloadGenericAccounts.counter]);

  return (
    <div id="generic-accounts-container" class="sheet" tabindex="-1">
      <button type="button" class="sheet-close" onClick={onClose}>
        <Icon icon="x" />
      </button>
      <header>
        <h2>{heading || 'Accounts'}</h2>
      </header>
      <main>
        {accounts.length > 0 ? (
          <>
            <ul class="accounts-list">
              {accounts.map((account) => (
                <li key={account.id + (account._types || '')}>
                  {showReactions && account._types?.length > 0 && (
                    <div class="reactions-block">
                      {account._types.map((type) => (
                        <Icon
                          icon={
                            {
                              reblog: 'rocket',
                              favourite: 'heart',
                            }[type]
                          }
                          class={`${type}-icon`}
                        />
                      ))}
                    </div>
                  )}
                  <AccountBlock account={account} />
                </li>
              ))}
            </ul>
            {uiState === 'default' ? (
              showMore ? (
                <InView
                  onChange={(inView) => {
                    if (inView) {
                      loadAccounts();
                    }
                  }}
                >
                  <button
                    type="button"
                    class="plain block"
                    onClick={() => loadAccounts()}
                  >
                    Show more&hellip;
                  </button>
                </InView>
              ) : (
                <p class="ui-state insignificant">The end.</p>
              )
            ) : (
              uiState === 'loading' && (
                <p class="ui-state">
                  <Loader abrupt />
                </p>
              )
            )}
          </>
        ) : uiState === 'loading' ? (
          <p class="ui-state">
            <Loader abrupt />
          </p>
        ) : uiState === 'error' ? (
          <p class="ui-state">Error loading accounts</p>
        ) : (
          <p class="ui-state insignificant">Nothing to show</p>
        )}
      </main>
    </div>
  );
}
