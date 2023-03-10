import './account.css';

import { useEffect, useRef, useState } from 'preact/hooks';
import { useHotkeys } from 'react-hotkeys-hook';

import { api } from '../utils/api';
import emojifyText from '../utils/emojify-text';
import enhanceContent from '../utils/enhance-content';
import handleContentLinks from '../utils/handle-content-links';
import niceDateTime from '../utils/nice-date-time';
import shortenNumber from '../utils/shorten-number';
import states, { hideAllModals } from '../utils/states';
import store from '../utils/store';

import AccountBlock from './account-block';
import Avatar from './avatar';
import Icon from './icon';
import Link from './link';

function Account({ account, instance: propInstance, onClose }) {
  const { masto, instance, authenticated } = api({ instance: propInstance });
  const [uiState, setUIState] = useState('default');
  const isString = typeof account === 'string';
  const [info, setInfo] = useState(isString ? null : account);

  useEffect(() => {
    if (isString) {
      setUIState('loading');
      (async () => {
        try {
          const info = await masto.v1.accounts.lookup({
            acct: account,
            skip_webfinger: false,
          });
          setInfo(info);
          setUIState('default');
        } catch (e) {
          try {
            const result = await masto.v2.search({
              q: account,
              type: 'accounts',
              limit: 1,
              resolve: authenticated,
            });
            if (result.accounts.length) {
              setInfo(result.accounts[0]);
              setUIState('default');
              return;
            }
            setInfo(null);
            setUIState('error');
          } catch (err) {
            console.error(err);
            setInfo(null);
            setUIState('error');
          }
        }
      })();
    } else {
      setInfo(account);
    }
  }, [account]);

  const {
    acct,
    avatar,
    avatarStatic,
    bot,
    createdAt,
    displayName,
    emojis,
    fields,
    followersCount,
    followingCount,
    group,
    header,
    headerStatic,
    id,
    lastStatusAt,
    locked,
    note,
    statusesCount,
    url,
    username,
  } = info || {};

  const escRef = useHotkeys('esc', onClose, [onClose]);

  return (
    <div
      ref={escRef}
      id="account-container"
      class={`sheet ${uiState === 'loading' ? 'skeleton' : ''}`}
    >
      {uiState === 'error' && (
        <div class="ui-state">
          <p>Unable to load account.</p>
          <p>
            <a href={account} target="_blank">
              Go to account page <Icon icon="external" />
            </a>
          </p>
        </div>
      )}
      {uiState === 'loading' ? (
        <>
          <header>
            <AccountBlock avatarSize="xxxl" skeleton />
          </header>
          <main>
            <div class="note">
              <p>████████ ███████</p>
              <p>███████████████ ███████████████</p>
            </div>
            <p class="stats">
              <span>██ Posts</span>
              <span>██ Following</span>
              <span>██ Followers</span>
            </p>
          </main>
        </>
      ) : (
        info && (
          <>
            {header && !/missing\.png$/.test(header) && (
              <img
                src={header}
                alt=""
                class="header-banner"
                onError={(e) => {
                  e.target.src = headerStatic;
                }}
              />
            )}
            <header>
              <AccountBlock
                account={info}
                instance={instance}
                avatarSize="xxxl"
                external
              />
            </header>
            <main tabIndex="-1">
              {bot && (
                <>
                  <span class="tag">
                    <Icon icon="bot" /> Automated
                  </span>
                </>
              )}
              <div
                class="note"
                onClick={handleContentLinks({
                  instance,
                })}
                dangerouslySetInnerHTML={{
                  __html: enhanceContent(note, { emojis }),
                }}
              />
              {fields?.length > 0 && (
                <div class="profile-metadata">
                  {fields.map(({ name, value, verifiedAt }) => (
                    <div
                      class={`profile-field ${
                        verifiedAt ? 'profile-verified' : ''
                      }`}
                      key={name}
                    >
                      <b>
                        <span
                          dangerouslySetInnerHTML={{
                            __html: emojifyText(name, emojis),
                          }}
                        />{' '}
                        {!!verifiedAt && <Icon icon="check-circle" size="s" />}
                      </b>
                      <p
                        dangerouslySetInnerHTML={{
                          __html: enhanceContent(value, { emojis }),
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
              <p class="stats">
                <Link
                  to={instance ? `/${instance}/a/${id}` : `/a/${id}`}
                  onClick={() => {
                    hideAllModals();
                  }}
                >
                  Posts
                  <br />
                  <b title={statusesCount}>
                    {shortenNumber(statusesCount)}
                  </b>{' '}
                </Link>
                <span>
                  Following
                  <br />
                  <b title={followingCount}>
                    {shortenNumber(followingCount)}
                  </b>{' '}
                </span>
                <span>
                  Followers
                  <br />
                  <b title={followersCount}>
                    {shortenNumber(followersCount)}
                  </b>{' '}
                </span>
                {!!createdAt && (
                  <span>
                    Joined
                    <br />
                    <b>
                      <time datetime={createdAt}>
                        {niceDateTime(createdAt, {
                          hideTime: true,
                        })}
                      </time>
                    </b>
                  </span>
                )}
              </p>
              <RelatedActions
                info={info}
                instance={instance}
                authenticated={authenticated}
              />
            </main>
          </>
        )
      )}
    </div>
  );
}

function RelatedActions({ info, instance, authenticated }) {
  if (!info) return null;
  const {
    masto: currentMasto,
    instance: currentInstance,
    authenticated: currentAuthenticated,
  } = api();
  const sameInstance = instance === currentInstance;

  const [relationshipUIState, setRelationshipUIState] = useState('default');
  const [relationship, setRelationship] = useState(null);
  const [familiarFollowers, setFamiliarFollowers] = useState([]);

  const { id, locked } = info;
  const accountID = useRef(id);

  const {
    following,
    showingReblogs,
    notifying,
    followedBy,
    blocking,
    blockedBy,
    muting,
    mutingNotifications,
    requested,
    domainBlocking,
    endorsed,
  } = relationship || {};

  useEffect(() => {
    if (info) {
      const currentAccount = store.session.get('currentAccount');
      let currentID;
      (async () => {
        if (sameInstance && authenticated) {
          currentID = id;
        } else if (!sameInstance && currentAuthenticated) {
          // Grab this account from my logged-in instance
          const acctHasInstance = info.acct.includes('@');
          try {
            const results = await currentMasto.v2.search({
              q: acctHasInstance ? info.acct : `${info.username}@${instance}`,
              type: 'accounts',
              limit: 1,
              resolve: true,
            });
            console.log('🥏 Fetched account from logged-in instance', results);
            currentID = results.accounts[0].id;
          } catch (e) {
            console.error(e);
          }
        }

        if (!currentID) return;

        if (currentAccount === currentID) {
          // It's myself!
          return;
        }

        accountID.current = currentID;

        setRelationshipUIState('loading');
        setFamiliarFollowers([]);

        const fetchRelationships = currentMasto.v1.accounts.fetchRelationships([
          currentID,
        ]);
        const fetchFamiliarFollowers =
          currentMasto.v1.accounts.fetchFamiliarFollowers(currentID);

        try {
          const relationships = await fetchRelationships;
          console.log('fetched relationship', relationships);
          if (relationships.length) {
            const relationship = relationships[0];
            setRelationship(relationship);

            if (!relationship.following) {
              try {
                const followers = await fetchFamiliarFollowers;
                console.log('fetched familiar followers', followers);
                setFamiliarFollowers(followers[0].accounts.slice(0, 10));
              } catch (e) {
                console.error(e);
              }
            }
          }
          setRelationshipUIState('default');
        } catch (e) {
          console.error(e);
          setRelationshipUIState('error');
        }
      })();
    }
  }, [info, authenticated]);

  return (
    <>
      {familiarFollowers?.length > 0 && (
        <p class="common-followers">
          Common followers{' '}
          <span class="ib">
            {familiarFollowers.map((follower) => (
              <a
                href={follower.url}
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.preventDefault();
                  states.showAccount = {
                    account: follower,
                    instance,
                  };
                }}
              >
                <Avatar
                  url={follower.avatarStatic}
                  size="l"
                  alt={`${follower.displayName} @${follower.acct}`}
                />
              </a>
            ))}
          </span>
        </p>
      )}
      <p class="actions">
        {followedBy ? <span class="tag">Following you</span> : <span />}{' '}
        {relationshipUIState !== 'loading' && relationship && (
          <button
            type="button"
            class={`${following || requested ? 'light swap' : ''}`}
            data-swap-state={following || requested ? 'danger' : ''}
            disabled={relationshipUIState === 'loading'}
            onClick={() => {
              setRelationshipUIState('loading');

              (async () => {
                try {
                  let newRelationship;

                  if (following || requested) {
                    const yes = confirm(
                      requested
                        ? 'Withdraw follow request?'
                        : `Unfollow @${info.acct || info.username}?`,
                    );

                    if (yes) {
                      newRelationship = await currentMasto.v1.accounts.unfollow(
                        accountID.current,
                      );
                    }
                  } else {
                    newRelationship = await currentMasto.v1.accounts.follow(
                      accountID.current,
                    );
                  }

                  if (newRelationship) setRelationship(newRelationship);
                  setRelationshipUIState('default');
                } catch (e) {
                  alert(e);
                  setRelationshipUIState('error');
                }
              })();
            }}
          >
            {following ? (
              <>
                <span>Following</span>
                <span>Unfollow…</span>
              </>
            ) : requested ? (
              <>
                <span>Requested</span>
                <span>Withdraw…</span>
              </>
            ) : locked ? (
              <>
                <Icon icon="lock" /> <span>Follow</span>
              </>
            ) : (
              'Follow'
            )}
          </button>
        )}
      </p>
    </>
  );
}

export default Account;
