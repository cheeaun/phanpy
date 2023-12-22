import './generic-accounts.css';

import { useEffect, useRef, useState } from 'preact/hooks';
import { InView } from 'react-intersection-observer';
import { useSnapshot } from 'valtio';

import { api } from '../utils/api';
import { fetchRelationships } from '../utils/relationships';
import states from '../utils/states';
import useLocationChange from '../utils/useLocationChange';

import AccountBlock from './account-block';
import Icon from './icon';
import Loader from './loader';

export default function GenericAccounts({
  instance,
  excludeRelationshipAttrs = [],
  onClose = () => {},
}) {
  const { masto, instance: currentInstance } = api();
  const isCurrentInstance = instance ? instance === currentInstance : true;
  const snapStates = useSnapshot(states);
  ``;
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

  const [relationshipsMap, setRelationshipsMap] = useState({});

  const loadRelationships = async (accounts) => {
    if (!accounts?.length) return;
    if (!isCurrentInstance) return;
    const relationships = await fetchRelationships(accounts, relationshipsMap);
    if (relationships) {
      setRelationshipsMap({
        ...relationshipsMap,
        ...relationships,
      });
    }
  };

  const loadAccounts = (firstLoad) => {
    if (!fetchAccounts) return;
    if (firstLoad) setAccounts([]);
    setUIState('loading');
    (async () => {
      try {
        const { done, value } = await fetchAccounts(firstLoad);
        if (Array.isArray(value)) {
          if (firstLoad) {
            const accounts = [];
            for (let i = 0; i < value.length; i++) {
              const account = value[i];
              const theAccount = accounts.find(
                (a, j) => a.id === account.id && i !== j,
              );
              if (!theAccount) {
                accounts.push({
                  _types: [],
                  ...account,
                });
              } else {
                theAccount._types.push(...account._types);
              }
            }
            setAccounts(accounts);
          } else {
            // setAccounts((prev) => [...prev, ...value]);
            // Merge accounts by id and _types
            setAccounts((prev) => {
              const newAccounts = prev;
              for (const account of value) {
                const theAccount = newAccounts.find((a) => a.id === account.id);
                if (!theAccount) {
                  newAccounts.push(account);
                } else {
                  theAccount._types.push(...account._types);
                }
              }
              return newAccounts;
            });
          }
          setShowMore(!done);

          loadRelationships(value);
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
      loadRelationships(staticAccounts);
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
              {accounts.map((account) => {
                const relationship = relationshipsMap[account.id];
                const key = `${account.id}-${account._types?.length || ''}`;
                return (
                  <li key={key}>
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
                    <div class="account-relationships">
                      <AccountBlock
                        account={account}
                        showStats
                        relationship={relationship}
                        excludeRelationshipAttrs={excludeRelationshipAttrs}
                      />
                    </div>
                  </li>
                );
              })}
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
