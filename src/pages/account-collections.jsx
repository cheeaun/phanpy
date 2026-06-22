import './account-collections.css';

import { ph } from '@lingui/core/macro';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useSnapshot } from 'valtio';

import CollectionAddEdit from '../components/collection-add-edit';
import CollectionCard from '../components/collection-card';
import Icon from '../components/icon';
import Link from '../components/link';
import Loader from '../components/loader';
import Modal from '../components/modal';
import NavMenu from '../components/nav-menu';
import { api } from '../utils/api';
import { COLLECTIONS_LIMIT } from '../utils/collections';
import states from '../utils/states';
import { getCurrentAccountID } from '../utils/store-utils';
import useTitle from '../utils/useTitle';

import { memFetchAccount } from './account-statuses';

function AccountCollections() {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { id: uid, ...params } = useParams();
  const [searchParams] = useSearchParams();
  const ic = searchParams.get('ic');
  const isInCollections = ic != null;

  const snapStates = useSnapshot(states);
  const { instance, masto } = api({
    instance: params?.instance,
  });
  const { instance: currentInstance } = api();

  // Fetch account info (for title)
  const [account, setAccount] = useState();
  useEffect(() => {
    let aborted = false;
    setAccount(undefined);
    (async () => {
      try {
        const acc = await memFetchAccount(uid, masto);
        if (aborted) return;
        setAccount(acc);
      } catch (e) {
        if (aborted) return;
        console.error(e);
      }
    })();
    return () => {
      aborted = true;
    };
  }, [uid, masto]);

  const { acct } = account || {};

  // Redirect ?ic=1 to plain /c if not self
  const isSelf = uid === getCurrentAccountID() && instance === currentInstance;
  useEffect(() => {
    if (isInCollections && !isSelf) {
      navigate(`/${instance}/a/${uid}/c`, { replace: true });
    }
  }, [isInCollections, isSelf, navigate, instance, uid]);

  let title = t`Collections`;
  if (account?.acct) {
    if (isInCollections) {
      title = t`Collections featuring you`;
    } else if (!isSelf) {
      const acctDisplay = (/@/.test(account.acct) ? '' : '@') + account.acct;
      title = t`Collections by ${ph({ username: acctDisplay })}`;
    }
  }
  useTitle(title, '/:instance?/a/:id/c');

  const [collections, setCollections] = useState([]);
  const [uiState, setUIState] = useState('loading');

  const [showMore, setShowMore] = useState(false);
  const collectionsIterator = useRef();
  const collectionsReqId = useRef(0);
  const fetchCollections = async (firstLoad) => {
    if (firstLoad || !collectionsIterator.current) {
      const listFn = isInCollections
        ? masto.v1.accounts.$select(uid).inCollections
        : masto.v1.accounts.$select(uid).collections;
      collectionsIterator.current = listFn
        .list({ limit: COLLECTIONS_LIMIT })
        .values();
    }
    const result = await collectionsIterator.current.next();
    return { ...result, value: result.value?.collections ?? [] };
  };

  const loadCollections = async (firstLoad) => {
    const reqId = ++collectionsReqId.current;
    setUIState('loading');
    try {
      let { done, value: cols } = await fetchCollections(firstLoad);
      if (reqId !== collectionsReqId.current) return;
      if (done) {
        setShowMore(false);
        if (firstLoad) setCollections([]);
      } else {
        if (firstLoad) {
          setCollections(cols);
        } else {
          setCollections((prev) => [...prev, ...cols]);
        }
        setShowMore(cols.length >= COLLECTIONS_LIMIT);
      }
      setUIState('default');
    } catch (e) {
      if (reqId !== collectionsReqId.current) return;
      console.error(e);
      setUIState('error');
    }
  };

  useEffect(() => {
    loadCollections(true);
  }, [uid, isInCollections, masto]);

  const basePath = `/${instance}/a/${uid}/c`;

  const [showNewCollectionModal, setShowNewCollectionModal] = useState(false);

  return (
    <div id="account-collections-page" class="deck-container" tabIndex="-1">
      <div class="timeline-deck deck">
        <header>
          <div class="header-grid">
            <div class="header-side">
              <NavMenu />
              {isSelf && (
                <Link to="/" class="button plain">
                  <Icon icon="home" size="l" alt={t`Home`} />
                </Link>
              )}
            </div>
            {!!account && !isSelf ? (
              <h1 class="header-double-lines">
                <b>
                  <Trans>Collections</Trans>
                </b>
                <div>
                  <Link
                    class="insignificant"
                    to={`/${instance}/a/${uid}`}
                    onClick={(e) => {
                      if (isSelf) return;
                      e.preventDefault();
                      e.stopPropagation();
                      states.showAccount = {
                        account,
                        instance,
                      };
                    }}
                  >
                    <span class="bidi-isolate">@{acct}</span>
                  </Link>
                </div>
              </h1>
            ) : (
              <h1>
                <Trans>Collections</Trans>
              </h1>
            )}
            <div class="header-side">
              {isSelf && !isInCollections && (
                <button
                  type="button"
                  class="plain"
                  onClick={() => setShowNewCollectionModal(true)}
                >
                  <Icon icon="plus" size="l" alt={t`New collection`} />
                </button>
              )}
            </div>
          </div>
        </header>
        <main>
          {isSelf && (
            <div class="filter-bar">
              <Icon icon="collections" size="l" class="insignificant" />{' '}
              <Link to={basePath} class={!isInCollections ? 'is-active' : ''}>
                <Trans>Created by you</Trans>
              </Link>{' '}
              <Link
                to={`${basePath}?ic=1`}
                class={isInCollections ? 'is-active' : ''}
              >
                <Trans>Featuring you</Trans>
              </Link>
            </div>
          )}

          {collections.length > 0 ? (
            <>
              <ul class="collections-list">
                {collections.map((collection) => (
                  <li key={collection.id}>
                    <CollectionCard
                      collection={collection}
                      size="l"
                      instance={instance}
                      creatorAccount={
                        collection.accountId
                          ? snapStates.accounts[collection.accountId]
                          : null
                      }
                      showMeta={!isInCollections}
                    />
                  </li>
                ))}
              </ul>
              {showMore &&
                (uiState === 'loading' ? (
                  <div class="ui-state">
                    <Loader abrupt />
                  </div>
                ) : (
                  <div class="ui-state">
                    <button
                      type="button"
                      class="light"
                      onClick={() => loadCollections()}
                    >
                      <Trans>Show more…</Trans>
                    </button>
                  </div>
                ))}
              {collections.length > 1 && (
                <footer class="ui-state insignificant">
                  <small>
                    <Plural
                      value={collections.length}
                      one="# collection"
                      other="# collections"
                    />
                  </small>
                </footer>
              )}
            </>
          ) : uiState === 'loading' ? (
            <p class="ui-state">
              <Loader />
            </p>
          ) : uiState === 'error' ? (
            <p class="ui-state insignificant">
              <Trans>Unable to load collections.</Trans>
            </p>
          ) : !account ? (
            <p class="ui-state">
              <Loader />
            </p>
          ) : (
            <p class="ui-state insignificant">
              {isInCollections
                ? t`No collections featuring you yet.`
                : t`No collections yet.`}
            </p>
          )}
        </main>
      </div>
      {showNewCollectionModal && (
        <Modal
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowNewCollectionModal(false);
            }
          }}
        >
          <CollectionAddEdit
            onClose={(result) => {
              if (result?.state === 'success' && result.collection) {
                const collectionId = result.collection.id;
                navigate(`/${instance}/c/${collectionId}`);
              }
              setShowNewCollectionModal(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

export default AccountCollections;
