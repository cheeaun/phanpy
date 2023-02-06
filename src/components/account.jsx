import './account.css';

import { useEffect, useState } from 'preact/hooks';

import { api } from '../utils/api';
import emojifyText from '../utils/emojify-text';
import enhanceContent from '../utils/enhance-content';
import handleContentLinks from '../utils/handle-content-links';
import shortenNumber from '../utils/shorten-number';
import states, { hideAllModals } from '../utils/states';
import store from '../utils/store';

import Avatar from './avatar';
import Icon from './icon';
import Link from './link';
import NameText from './name-text';

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
              resolve: true,
            });
            if (result.accounts.length) {
              setInfo(result.accounts[0]);
              setUIState('default');
              return;
            }
            setUIState('error');
          } catch (err) {
            console.error(err);
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

  const [relationshipUIState, setRelationshipUIState] = useState('default');
  const [relationship, setRelationship] = useState(null);
  const [familiarFollowers, setFamiliarFollowers] = useState([]);
  useEffect(() => {
    if (info && authenticated) {
      const currentAccount = store.session.get('currentAccount');
      if (currentAccount === id) {
        // It's myself!
        return;
      }
      setRelationshipUIState('loading');
      setFamiliarFollowers([]);

      (async () => {
        const fetchRelationships = masto.v1.accounts.fetchRelationships([id]);
        const fetchFamiliarFollowers =
          masto.v1.accounts.fetchFamiliarFollowers(id);

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

  return (
    <div
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
            <Avatar size="xxxl" />
            ███ ████████████
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
            <header>
              <Avatar url={avatar} size="xxxl" />
              <NameText account={info} instance={instance} showAcct external />
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
                  to={`/a/${id}`}
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
                        {Intl.DateTimeFormat('en', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        }).format(new Date(createdAt))}
                      </time>
                    </b>
                  </span>
                )}
              </p>
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
                                ? 'Are you sure that you want to withdraw follow request?'
                                : 'Are you sure that you want to unfollow this account?',
                            );
                            if (yes) {
                              newRelationship =
                                await masto.v1.accounts.unfollow(id);
                            }
                          } else {
                            newRelationship = await masto.v1.accounts.follow(
                              id,
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
            </main>
          </>
        )
      )}
    </div>
  );
}

export default Account;
