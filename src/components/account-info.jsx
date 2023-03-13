import './account-info.css';

import { useEffect, useRef, useState } from 'preact/hooks';

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

function AccountInfo({
  account,
  fetchAccount = () => {},
  standalone,
  instance,
  authenticated,
}) {
  const [uiState, setUIState] = useState('default');
  const isString = typeof account === 'string';
  const [info, setInfo] = useState(isString ? null : account);

  useEffect(() => {
    if (!isString) {
      setInfo(account);
      return;
    }
    setUIState('loading');
    (async () => {
      try {
        const info = await fetchAccount();
        states.accounts[`${info.id}@${instance}`] = info;
        setInfo(info);
        setUIState('default');
      } catch (e) {
        console.error(e);
        setInfo(null);
        setUIState('error');
      }
    })();
  }, [isString, account, fetchAccount]);

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

  const [headerCornerColors, setHeaderCornerColors] = useState([]);

  return (
    <div
      class={`account-container  ${uiState === 'loading' ? 'skeleton' : ''}`}
      style={{
        '--header-color-1': headerCornerColors[0],
        '--header-color-2': headerCornerColors[1],
        '--header-color-3': headerCornerColors[2],
        '--header-color-4': headerCornerColors[3],
      }}
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
              <span>
                Posts
                <br />
                ██
              </span>
              <span>
                Following
                <br />
                ██
              </span>
              <span>
                Followers
                <br />
                ██
              </span>
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
                  if (e.target.crossOrigin) {
                    if (e.target.src !== headerStatic) {
                      e.target.src = headerStatic;
                    } else {
                      e.target.removeAttribute('crossorigin');
                      e.target.src = header;
                    }
                  } else if (e.target.src !== headerStatic) {
                    e.target.src = headerStatic;
                  } else {
                    e.target.remove();
                  }
                }}
                crossOrigin="anonymous"
                onLoad={(e) => {
                  try {
                    // Get color from four corners of image
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = e.target.width;
                    canvas.height = e.target.height;
                    ctx.drawImage(e.target, 0, 0);
                    // const colors = [
                    //   ctx.getImageData(0, 0, 1, 1).data,
                    //   ctx.getImageData(e.target.width - 1, 0, 1, 1).data,
                    //   ctx.getImageData(0, e.target.height - 1, 1, 1).data,
                    //   ctx.getImageData(
                    //     e.target.width - 1,
                    //     e.target.height - 1,
                    //     1,
                    //     1,
                    //   ).data,
                    // ];
                    // Get 10x10 pixels from corners, get average color from each
                    const pixelDimension = 10;
                    const colors = [
                      ctx.getImageData(0, 0, pixelDimension, pixelDimension)
                        .data,
                      ctx.getImageData(
                        e.target.width - pixelDimension,
                        0,
                        pixelDimension,
                        pixelDimension,
                      ).data,
                      ctx.getImageData(
                        0,
                        e.target.height - pixelDimension,
                        pixelDimension,
                        pixelDimension,
                      ).data,
                      ctx.getImageData(
                        e.target.width - pixelDimension,
                        e.target.height - pixelDimension,
                        pixelDimension,
                        pixelDimension,
                      ).data,
                    ].map((data) => {
                      let r = 0;
                      let g = 0;
                      let b = 0;
                      let a = 0;
                      for (let i = 0; i < data.length; i += 4) {
                        r += data[i];
                        g += data[i + 1];
                        b += data[i + 2];
                        a += data[i + 3];
                      }
                      const dataLength = data.length / 4;
                      return [
                        r / dataLength,
                        g / dataLength,
                        b / dataLength,
                        a / dataLength,
                      ];
                    });
                    const rgbColors = colors.map((color) => {
                      const [r, g, b, a] = lightenRGB(color);
                      return `rgba(${r}, ${g}, ${b}, ${a})`;
                    });
                    setHeaderCornerColors(rgbColors);
                    console.log({ colors, rgbColors });
                  } catch (e) {
                    // Silently fail
                  }
                }}
              />
            )}
            <header>
              <AccountBlock
                account={info}
                instance={instance}
                avatarSize="xxxl"
                external={standalone}
                internal={!standalone}
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
                {standalone ? (
                  <span>
                    Posts
                    <br />
                    <b title={statusesCount}>
                      {shortenNumber(statusesCount)}
                    </b>{' '}
                  </span>
                ) : (
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
                )}
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

// Apply more alpha if high luminence
function lightenRGB([r, g, b]) {
  const luminence = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  console.log('luminence', luminence);
  // Follow this range
  // luminence = 0, alpha = 0.01
  // luminence = 220, alpha = 1
  let alpha;
  if (luminence >= 220) {
    alpha = 1;
  } else {
    alpha = (luminence / 255) * 0.99 + 0.01;
  }
  alpha = Math.min(1, alpha);
  return [r, g, b, alpha];
}

export default AccountInfo;
