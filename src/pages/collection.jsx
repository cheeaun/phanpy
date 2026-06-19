import './collection.css';

import { msg, ph } from '@lingui/core/macro';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import {
  MenuDivider,
  MenuHeader,
  MenuItem,
  MenuRadioGroup,
} from '@szhsin/react-menu';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import punycode from 'punycode/';
import { useParams } from 'react-router-dom';

import AccountBlock from '../components/account-block';
import CollectionAccountActions from '../components/collection-account-actions';
import CollectionAddEdit from '../components/collection-add-edit';
import CollectionManageAccounts from '../components/collection-manage-accounts';
import EmojiText from '../components/emoji-text';
import Icon from '../components/icon';
import Link from '../components/link';
import Loader from '../components/loader';
import MenuConfirm from '../components/menu-confirm';
import MenuLink from '../components/menu-link';
import Menu2 from '../components/menu2';
import Modal from '../components/modal';
import NameText from '../components/name-text';
import NavMenu from '../components/nav-menu';
import RelativeTime from '../components/relative-time';
import ReportCollection from '../components/report-collection';
import { api } from '../utils/api';
import { fetchRelationships } from '../utils/relationships';
import showCompose from '../utils/show-compose';
import showToast from '../utils/show-toast';
import { getCurrentAccountID } from '../utils/store-utils';
import useTitle from '../utils/useTitle';

function niceCollectionURL(url) {
  if (!url) return;
  const urlObj = URL.parse(url);
  if (!urlObj) return;
  const { host, pathname } = urlObj;
  const path = pathname.replace(/\/$/, '');
  try {
    return (
      <>
        {punycode.toUnicode(host)}
        <span class="more-insignificant">{path}</span>
      </>
    );
  } catch {
    return url;
  }
}

const SORTS = [
  { key: 'date_added', label: msg`Date added` },
  {
    key: 'name',
    label: msg({ id: 'sort.name', message: 'Name', comment: 'Sort by name' }),
  },
  { key: 'last_active', label: msg`Last active` },
  { key: 'most_followers', label: msg`Most followers` },
];

function Collection() {
  const { _, t } = useLingui();
  const { id: cid, instance: targetInstance } = useParams();
  const [sortKey, setSortKey] = useState('date_added');
  const [showEditCollectionModal, setShowEditCollectionModal] = useState(false);
  const [showManageAccountsModal, setShowManageAccountsModal] = useState(false);
  const manageAccountsRef = useRef(null);
  const [showReportCollectionModal, setShowReportCollectionModal] =
    useState(false);

  const { masto, instance } = api({ instance: targetInstance });
  const {
    masto: currentMasto,
    instance: currentInstance,
    authenticated,
  } = api();
  const sameInstance = instance === currentInstance;

  const [data, setData] = useState();
  const collection = data?.collection || {};
  const accounts = data?.accounts || [];

  const [showSensitiveContent, setShowSensitiveContent] = useState(false);
  const [uiState, setUIState] = useState('loading');
  const [revoking, setRevoking] = useState(false);
  const [relationshipsMap, setRelationshipsMap] = useState({});

  useEffect(() => {
    let aborted = false;
    setUIState('loading');
    (async () => {
      try {
        const result = await masto.v1.collections.$select(cid).fetch();
        if (aborted) return;
        if (!result) {
          setUIState('error');
          return;
        }
        setData(result);
        setUIState('default');
      } catch (e) {
        if (aborted) return;
        console.error(e);
        setUIState('error');
      }
    })();
    return () => {
      aborted = true;
    };
  }, [cid, targetInstance]);

  useEffect(() => {
    if (!accounts?.length) return;
    const { instance: currentInstance, authenticated } = api();
    if (!authenticated || instance !== currentInstance) return;
    let aborted = false;
    (async () => {
      const relationships = await fetchRelationships(
        accounts,
        relationshipsMap,
      );
      if (aborted) return;
      if (relationships) {
        setRelationshipsMap((prev) => ({
          ...prev,
          ...relationships,
        }));
      }
    })();
    return () => {
      aborted = true;
    };
  }, [accounts]);

  const accountsMap = useMemo(() => {
    return accounts.reduce((acc, account) => {
      if (account?.id) acc[account.id] = account;
      return acc;
    }, {});
  }, [accounts]);

  const curator = accountsMap[collection.accountId] || null;
  const collectionURLInfo = useMemo(() => {
    const u = URL.parse(collection?.url);
    if (!u) return {};
    const path = u.pathname;
    const match = path.match(/\/collections\/([^/]+)/i);
    if (match) return { hostname: u.hostname, id: match[1] };
    return {};
  }, [collection?.url]);

  const curatorAcct = useMemo(() => {
    if (!curator?.acct) return '';
    if (curator.acct.includes('@')) return curator.acct;
    const curatorURL = URL.parse(curator?.url);
    const domain =
      curatorURL?.hostname || collectionURLInfo?.hostname || instance;
    return domain ? `${curator.acct}@${domain}` : curator.acct;
  }, [curator?.acct, curator?.url, collectionURLInfo?.hostname, instance]);

  useTitle(
    curatorAcct
      ? `${collection?.name || t`Collection`} — @${curatorAcct}`
      : collection?.name || t`Collection`,
    '/:instance?/c/:id',
  );

  const currentAccountId = getCurrentAccountID();

  const isCurator = curator?.id === currentAccountId;

  const ownCollectionItem = useMemo(() => {
    if (!collection?.items || !currentAccountId) return null;
    return (
      collection.items.find((item) => item.accountId === currentAccountId) ||
      null
    );
  }, [collection, currentAccountId]);

  const handleRevoke = async () => {
    if (!ownCollectionItem) return;
    setRevoking(true);
    try {
      await masto.v1.collections
        .$select(collection.id)
        .items.$select(ownCollectionItem.id)
        .revoke();
      setData((prev) => {
        const col = prev?.collection || prev;
        if (!col) return prev;
        return {
          ...prev,
          collection: {
            ...col,
            items: col.items.filter((i) => i.id !== ownCollectionItem.id),
          },
        };
      });
      showToast(t`Removed from collection`);
    } catch (e) {
      console.error(e);
      showToast(t`Unable to remove from collection`);
    }
    setRevoking(false);
  };

  const sortedItems = useMemo(() => {
    const items = collection?.items || [];
    if (sortKey === 'date_added') return items;
    const arr = [...items];
    switch (sortKey) {
      case 'name':
        arr.sort((a, b) => {
          const aa = accountsMap[a.accountId] || {};
          const bb = accountsMap[b.accountId] || {};
          const an = aa.displayName || aa.username || aa.acct || '';
          const bn = bb.displayName || bb.username || bb.acct || '';
          return an.localeCompare(bn);
        });
        break;
      case 'last_active':
        arr.sort((a, b) => {
          const aa = accountsMap[a.accountId] || {};
          const bb = accountsMap[b.accountId] || {};
          const at = aa.lastStatusAt ? new Date(aa.lastStatusAt).getTime() : 0;
          const bt = bb.lastStatusAt ? new Date(bb.lastStatusAt).getTime() : 0;
          return bt - at;
        });
        break;
      case 'most_followers':
        arr.sort((a, b) => {
          const aa = accountsMap[a.accountId] || {};
          const bb = accountsMap[b.accountId] || {};
          return (bb.followersCount || 0) - (aa.followersCount || 0);
        });
        break;
    }
    return arr;
  }, [collection?.items, accountsMap, sortKey]);

  const collectionLang = collection?.language;

  return (
    <>
      <div id="collection-page" class="deck-container" tabIndex="-1">
        <div class="timeline-deck deck">
          <header>
            <div class="header-grid">
              <div class="header-side">
                <NavMenu />
                {isCurator && (
                  <Link
                    to={
                      instance
                        ? `/${instance}/a/${curator.id}/c`
                        : `/a/${curator.id}/c`
                    }
                    class="button plain"
                    aria-label={t`Collections`}
                  >
                    <Icon icon="collections" size="l" />
                  </Link>
                )}
              </div>
              <h1 class="header-account" dir="auto" lang={collectionLang}>
                {uiState === 'loading'
                  ? '…'
                  : collection?.name || t`Collection`}
              </h1>
              <div class="header-side">
                <Menu2
                  portal
                  setDownOverflow
                  overflow="auto"
                  position="anchor"
                  menuButton={
                    <button type="button" class="plain">
                      <Icon icon="more" size="l" alt={t`More`} />
                    </button>
                  }
                >
                  {uiState !== 'loading' && (
                    <MenuItem href={collection?.url} target="_blank">
                      <Icon icon="external" />
                      <small
                        class="menu-double-lines should-cloak"
                        style={{
                          maxWidth: '16em',
                        }}
                      >
                        {niceCollectionURL(collection?.url)}
                      </small>
                    </MenuItem>
                  )}
                  {authenticated && (
                    <MenuItem
                      disabled={uiState === 'loading'}
                      onClick={() =>
                        showCompose({
                          draftStatus: {
                            status: `\n\n${collection?.url || window.location.href}`,
                          },
                        })
                      }
                    >
                      <Icon icon="quill" />
                      <span>
                        <Trans>Post collection</Trans>
                      </span>
                    </MenuItem>
                  )}
                  <div class="menu-horizontal">
                    <MenuItem
                      disabled={uiState === 'loading'}
                      onClick={() => {
                        try {
                          const url = collection?.url || window.location.href;
                          navigator.clipboard.writeText(url);
                          showToast(t`Link copied`);
                        } catch (e) {
                          console.error(e);
                          showToast(t`Unable to copy link`);
                        }
                      }}
                    >
                      <Icon icon="link" />
                      <span>
                        <Trans>Copy</Trans>
                      </span>
                    </MenuItem>
                    {navigator?.share && (
                      <MenuItem
                        disabled={uiState === 'loading'}
                        onClick={() => {
                          try {
                            const url = collection?.url || window.location.href;
                            navigator.share({ url });
                          } catch (e) {
                            console.error(e);
                          }
                        }}
                      >
                        <Icon icon="share" />
                        <span>
                          <Trans>Share…</Trans>
                        </span>
                      </MenuItem>
                    )}
                  </div>
                  <MenuDivider />
                  <MenuHeader className="plain">
                    <Trans>Sort</Trans>
                  </MenuHeader>
                  <MenuRadioGroup
                    value={sortKey}
                    onRadioChange={({ value }) => setSortKey(value)}
                  >
                    {SORTS.map((s) => (
                      <MenuItem
                        type="radio"
                        key={s.key}
                        value={s.key}
                        disabled={
                          uiState === 'loading' ||
                          (collection?.items?.length || 0) <= 2 ||
                          (collection?.sensitive &&
                            !isCurator &&
                            !showSensitiveContent)
                        }
                      >
                        <Icon
                          icon={
                            sortKey === s.key ? 'check-circle' : 'round-line'
                          }
                          alt=""
                        />{' '}
                        <span>{_(s.label)}</span>
                      </MenuItem>
                    ))}
                  </MenuRadioGroup>
                  {isCurator && (
                    <>
                      <MenuDivider />
                      <MenuItem
                        disabled={uiState === 'loading'}
                        onClick={() => setShowEditCollectionModal(true)}
                      >
                        <Icon icon="pencil" />
                        <span>
                          <Trans>Edit</Trans>
                        </span>
                      </MenuItem>
                      <MenuItem
                        disabled={uiState === 'loading'}
                        onClick={() => setShowManageAccountsModal(true)}
                      >
                        <Icon icon="group" />
                        <span>
                          <Trans>Manage accounts</Trans>
                        </span>
                      </MenuItem>
                    </>
                  )}
                  {!isCurator &&
                    (ownCollectionItem || (authenticated && sameInstance)) && (
                      <MenuDivider />
                    )}
                  {ownCollectionItem && !isCurator && (
                    <MenuConfirm
                      subMenu
                      disabled={uiState === 'loading' || revoking}
                      confirmLabel={
                        <>
                          <Icon icon="user-x" />
                          <span>
                            <Trans>Remove me from this collection?</Trans>
                          </span>
                        </>
                      }
                      itemProps={{ className: 'danger' }}
                      menuItemClassName="danger"
                      menuFooter={
                        <div class="footer">
                          <Icon icon="info" />
                          <Trans>
                            The curator won't be able to re-add you to this
                            collection for 24 hours. Block them to prevent them
                            from adding you to any collections.
                          </Trans>
                        </div>
                      }
                      onClick={handleRevoke}
                    >
                      <Icon icon="user-x" />
                      <span>
                        <Trans>Remove me…</Trans>
                      </span>
                    </MenuConfirm>
                  )}
                  {!isCurator && authenticated && sameInstance && (
                    <MenuItem
                      className="danger"
                      disabled={uiState === 'loading'}
                      onClick={() => setShowReportCollectionModal(true)}
                    >
                      <Icon icon="flag" />
                      <span>
                        <Trans>Report collection…</Trans>
                      </span>
                    </MenuItem>
                  )}
                  {authenticated &&
                    (!sameInstance ||
                      collectionURLInfo?.hostname !== instance) && (
                      <>
                        <MenuDivider />
                        <MenuHeader className="plain">
                          <Trans>Experimental</Trans>
                        </MenuHeader>
                        {!sameInstance ? (
                          <MenuItem
                            disabled={uiState === 'loading'}
                            onClick={() => {
                              setUIState('loading');
                              (async () => {
                                try {
                                  const results =
                                    await currentMasto.v2.search.list({
                                      q: collection.url,
                                      resolve: true,
                                      limit: 1,
                                    });
                                  if (results?.collections?.length) {
                                    const collectionResult =
                                      results.collections[0];
                                    location.hash = currentInstance
                                      ? `/${currentInstance}/c/${collectionResult.id}`
                                      : `/c/${collectionResult.id}`;
                                  } else {
                                    throw new Error('No results');
                                  }
                                } catch (e) {
                                  setUIState('default');
                                  showToast(t`Error: ${e}`);
                                  console.error(e);
                                }
                              })();
                            }}
                          >
                            <Icon icon="transfer" />
                            <small class="menu-double-lines">
                              <Trans>
                                Switch to my server (<b>{currentInstance}</b>)
                              </Trans>
                            </small>
                          </MenuItem>
                        ) : (
                          <MenuLink
                            to={`/${collectionURLInfo.hostname}/c/${collectionURLInfo.id}`}
                          >
                            <Icon icon="transfer" />
                            <small class="menu-double-lines">
                              <Trans>
                                Switch to collection's server (
                                {ph({
                                  serverDomain: collectionURLInfo.hostname,
                                })}
                                )
                              </Trans>
                            </small>
                          </MenuLink>
                        )}
                      </>
                    )}
                </Menu2>
              </div>
            </div>
          </header>

          <main>
            {uiState === 'loading' ? (
              <p class="ui-state">
                <Loader />
              </p>
            ) : uiState === 'error' ? (
              <p class="ui-state">
                <Trans>Unable to load collection.</Trans>
              </p>
            ) : (
              <>
                <section class="collection-meta">
                  <h2 lang={collectionLang}>{collection.name}</h2>
                  {collection.description && (
                    <p lang={collectionLang}>
                      <EmojiText
                        text={collection.description}
                        emojis={collection.emojis}
                        resolverURL={collection.url}
                      />
                    </p>
                  )}
                  {!!curator && (
                    <p class="sub-meta insignificant">
                      <small>
                        <Trans>
                          <Link
                            _t="link"
                            to={
                              instance
                                ? `/${instance}/a/${curator.id}/c`
                                : `/a/${curator.id}/c`
                            }
                          >
                            <Icon _t="icon" icon="collections" /> Collection
                          </Link>{' '}
                          by{' '}
                          <NameText
                            _t="name"
                            account={{ ...curator, acct: curatorAcct }}
                            instance={instance}
                            showAvatar
                          />
                        </Trans>
                      </small>
                    </p>
                  )}
                </section>

                {collection.sensitive && !isCurator && !showSensitiveContent ? (
                  <div class="collection-sensitive-container">
                    <button
                      type="button"
                      class="light"
                      onClick={() => setShowSensitiveContent(true)}
                    >
                      <Icon icon="eye-close" />{' '}
                      <span>
                        <Trans>Show content</Trans>
                      </span>
                    </button>
                  </div>
                ) : (
                  <>
                    {sortedItems.length > 0 ? (
                      <ul class="accounts-list">
                        {sortedItems.map((item) => {
                          const account = accountsMap[item.accountId];
                          if (!account) return null;
                          return (
                            <li key={item.id} tabIndex="-1">
                              <AccountBlock
                                account={account}
                                instance={instance}
                                showActivity
                                showStats
                                avatarSize="xxl"
                                relationship={relationshipsMap[account.id]}
                              />
                              {!!currentAccountId && sameInstance && (
                                <CollectionAccountActions
                                  account={account}
                                  relationship={relationshipsMap[account.id]}
                                  instance={instance}
                                  isSelf={account.id === currentAccountId}
                                  isCurator={isCurator}
                                  onRelationshipChange={(newRelationship) => {
                                    setRelationshipsMap((prev) => ({
                                      ...prev,
                                      [account.id]: newRelationship,
                                    }));
                                  }}
                                  onSelfRemove={handleRevoke}
                                />
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div class="ui-state">
                        <p class="insignificant">
                          <Trans>No accounts in this collection yet.</Trans>
                        </p>
                        {isCurator && (
                          <p>
                            <button
                              type="button"
                              class="light"
                              onClick={() => {
                                setShowManageAccountsModal(true);
                                setTimeout(
                                  () =>
                                    manageAccountsRef.current?.openAddAccount(),
                                  400,
                                );
                              }}
                            >
                              <Icon icon="plus" /> <Trans>Add account</Trans>
                            </button>
                          </p>
                        )}
                      </div>
                    )}
                    {(sortedItems.length > 1 ||
                      collection?.updatedAt ||
                      collection?.discoverable !== undefined) && (
                      <footer class="ui-state">
                        <small class="insignificant">
                          {sortedItems.length > 1 && (
                            <>
                              <Plural
                                value={sortedItems.length}
                                one="# account"
                                other="# accounts"
                              />
                              <br />
                            </>
                          )}
                          {collection?.updatedAt && (
                            <Trans>
                              Last updated:{' '}
                              <RelativeTime
                                _t="relativeTime"
                                datetime={collection.updatedAt}
                                format="micro"
                              />
                            </Trans>
                          )}
                          {collection?.discoverable === false && (
                            <>
                              {collection?.updatedAt && ' · '}
                              <Trans>Unlisted</Trans>
                            </>
                          )}
                          {collection?.discoverable !== false && (
                            <>
                              {collection?.updatedAt && ' · '}
                              <Trans>Public</Trans>
                            </>
                          )}
                          {collection?.sensitive && (
                            <>
                              <br />
                              <Icon icon="alert" size="s" />{' '}
                              <Trans>Marked as sensitive</Trans>
                            </>
                          )}
                        </small>
                      </footer>
                    )}
                  </>
                )}
              </>
            )}
          </main>
        </div>
        {accounts.length > 0 &&
          !(collection?.sensitive && !isCurator && !showSensitiveContent) && (
            <div id="collection-page-bg" aria-hidden="true">
              {accounts
                .filter(Boolean)
                .slice(0, 4)
                .map((a) => (
                  <img
                    key={a.id}
                    src={a.avatarStatic || a.avatar}
                    alt=""
                    decoding="async"
                    loading="lazy"
                  />
                ))}
            </div>
          )}
      </div>
      {showEditCollectionModal && (
        <Modal
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowEditCollectionModal(false);
            }
          }}
        >
          <CollectionAddEdit
            collection={collection}
            onClose={(result) => {
              if (result?.state === 'success' && result.collection) {
                setData((prev) => {
                  const col = prev?.collection || prev;
                  if (!col) return prev;
                  return {
                    ...prev,
                    collection: result.collection,
                  };
                });
              } else if (result?.state === 'deleted') {
                location.hash = instance
                  ? `/${instance}/a/${currentAccountId}/c`
                  : `/a/${currentAccountId}/c`;
              }
              setShowEditCollectionModal(false);
            }}
          />
        </Modal>
      )}
      {showManageAccountsModal && (
        <Modal
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowManageAccountsModal(false);
            }
          }}
        >
          <CollectionManageAccounts
            ref={manageAccountsRef}
            collection={collection}
            accounts={accounts}
            instance={instance}
            onClose={() => setShowManageAccountsModal(false)}
            onDataChange={({ collectionItems, accounts: updatedAccounts }) => {
              setData((prev) => ({
                ...prev,
                collection: {
                  ...(prev?.collection || prev),
                  items: collectionItems,
                },
                accounts: updatedAccounts,
              }));
            }}
          />
        </Modal>
      )}
      {showReportCollectionModal && (
        <Modal
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowReportCollectionModal(false);
            }
          }}
        >
          <ReportCollection
            collection={collection}
            domain={curator?.acct?.split('@')[1]}
            onClose={() => setShowReportCollectionModal(false)}
          />
        </Modal>
      )}
    </>
  );
}

export default Collection;
