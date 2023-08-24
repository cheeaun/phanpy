import './account-info.css';

import { Menu, MenuDivider, MenuItem, SubMenu } from '@szhsin/react-menu';
import { useEffect, useReducer, useRef, useState } from 'preact/hooks';

import { api } from '../utils/api';
import enhanceContent from '../utils/enhance-content';
import getHTMLText from '../utils/getHTMLText';
import handleContentLinks from '../utils/handle-content-links';
import niceDateTime from '../utils/nice-date-time';
import shortenNumber from '../utils/shorten-number';
import showToast from '../utils/show-toast';
import states, { hideAllModals } from '../utils/states';
import store from '../utils/store';
import { updateAccount } from '../utils/store-utils';

import AccountBlock from './account-block';
import Avatar from './avatar';
import EmojiText from './emoji-text';
import Icon from './icon';
import Link from './link';
import ListAddEdit from './list-add-edit';
import Loader from './loader';
import MenuConfirm from './menu-confirm';
import Modal from './modal';
import TranslationBlock from './translation-block';

const MUTE_DURATIONS = [
  1000 * 60 * 5, // 5 minutes
  1000 * 60 * 30, // 30 minutes
  1000 * 60 * 60, // 1 hour
  1000 * 60 * 60 * 6, // 6 hours
  1000 * 60 * 60 * 24, // 1 day
  1000 * 60 * 60 * 24 * 3, // 3 days
  1000 * 60 * 60 * 24 * 7, // 1 week
  0, // forever
];
const MUTE_DURATIONS_LABELS = {
  0: 'Forever',
  300_000: '5 minutes',
  1_800_000: '30 minutes',
  3_600_000: '1 hour',
  21_600_000: '6 hours',
  86_400_000: '1 day',
  259_200_000: '3 days',
  604_800_000: '1 week',
};

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
    // header,
    // headerStatic,
    id,
    lastStatusAt,
    locked,
    note,
    statusesCount,
    url,
    username,
  } = info || {};
  let headerIsAvatar = false;
  let { header, headerStatic } = info || {};
  if (!header || /missing\.png$/.test(header)) {
    if (avatar && !/missing\.png$/.test(avatar)) {
      header = avatar;
      headerIsAvatar = true;
      if (avatarStatic && !/missing\.png$/.test(avatarStatic)) {
        headerStatic = avatarStatic;
      }
    }
  }

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
              <div>
                <span>██</span> Followers
              </div>
              <div>
                <span>██</span> Following
              </div>
              <div>
                <span>██</span> Posts
              </div>
              <div>Joined ██</div>
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
                class={`header-banner ${
                  headerIsAvatar ? 'header-is-avatar' : ''
                }`}
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
                  e.target.classList.add('loaded');
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
              {group && (
                <>
                  <span class="tag">
                    <Icon icon="group" /> Group
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
                  {fields.map(({ name, value, verifiedAt }, i) => (
                    <div
                      class={`profile-field ${
                        verifiedAt ? 'profile-verified' : ''
                      }`}
                      key={name + i}
                    >
                      <b>
                        <EmojiText text={name} emojis={emojis} />{' '}
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
                <div>
                  <span title={followersCount}>
                    {shortenNumber(followersCount)}
                  </span>{' '}
                  Followers
                </div>
                <div class="insignificant">
                  <span title={followingCount}>
                    {shortenNumber(followingCount)}
                  </span>{' '}
                  Following
                  <br />
                </div>
                {standalone ? (
                  <div class="insignificant">
                    <span title={statusesCount}>
                      {shortenNumber(statusesCount)}
                    </span>{' '}
                    Posts
                  </div>
                ) : (
                  <Link
                    class="insignificant"
                    to={instance ? `/${instance}/a/${id}` : `/a/${id}`}
                    onClick={() => {
                      hideAllModals();
                    }}
                  >
                    <span title={statusesCount}>
                      {shortenNumber(statusesCount)}
                    </span>{' '}
                    Posts
                  </Link>
                )}
                {!!createdAt && (
                  <div class="insignificant">
                    Joined{' '}
                    <time datetime={createdAt}>
                      {niceDateTime(createdAt, {
                        hideTime: true,
                      })}
                    </time>
                  </div>
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

  const { id, acct, url, username, locked, lastStatusAt, note, fields } = info;
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

  const [currentInfo, setCurrentInfo] = useState(null);
  const [isSelf, setIsSelf] = useState(false);

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
            if (results.accounts.length) {
              currentID = results.accounts[0].id;
              setCurrentInfo(results.accounts[0]);
            }
          } catch (e) {
            console.error(e);
          }
        }

        if (!currentID) return;

        if (currentAccount === currentID) {
          // It's myself!
          setIsSelf(true);
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

  useEffect(() => {
    if (info && isSelf) {
      updateAccount(info);
    }
  }, [info, isSelf]);

  const loading = relationshipUIState === 'loading';
  const menuInstanceRef = useRef(null);

  const [showTranslatedBio, setShowTranslatedBio] = useState(false);
  const [showAddRemoveLists, setShowAddRemoveLists] = useState(false);

  return (
    <>
      <div
        class="common-followers shazam-container no-animation"
        hidden={!familiarFollowers?.length}
      >
        <div class="shazam-container-inner">
          <p>
            Followed by{' '}
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
                    squircle={follower?.bot}
                  />
                </a>
              ))}
            </span>
          </p>
        </div>
      </div>
      <p class="actions">
        <span>
          {followedBy ? (
            <span class="tag">Following you</span>
          ) : !!lastStatusAt ? (
            <small class="insignificant">
              Last post:{' '}
              {niceDateTime(lastStatusAt, {
                hideTime: true,
              })}
            </small>
          ) : (
            <span />
          )}
          {muting && <span class="tag danger">Muted</span>}
          {blocking && <span class="tag danger">Blocked</span>}
        </span>{' '}
        <span class="buttons">
          <Menu
            instanceRef={menuInstanceRef}
            portal={{
              target: document.body,
            }}
            containerProps={{
              style: {
                // Higher than the backdrop
                zIndex: 1001,
              },
              onClick: (e) => {
                if (e.target === e.currentTarget) {
                  menuInstanceRef.current?.closeMenu?.();
                }
              },
            }}
            align="center"
            position="anchor"
            overflow="auto"
            boundingBoxPadding="8 8 8 8"
            menuButton={
              <button
                type="button"
                title="More"
                class="plain"
                disabled={loading}
              >
                <Icon icon="more" size="l" alt="More" />
              </button>
            }
          >
            {currentAuthenticated && !isSelf && (
              <>
                <MenuItem
                  onClick={() => {
                    states.showCompose = {
                      draftStatus: {
                        status: `@${currentInfo?.acct || acct} `,
                      },
                    };
                  }}
                >
                  <Icon icon="at" />
                  <span>Mention @{username}</span>
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setShowTranslatedBio(true);
                  }}
                >
                  <Icon icon="translate" />
                  <span>Translate bio</span>
                </MenuItem>
                {/* Add/remove from lists is only possible if following the account */}
                {following && (
                  <MenuItem
                    onClick={() => {
                      setShowAddRemoveLists(true);
                    }}
                  >
                    <Icon icon="list" />
                    <span>Add/remove from Lists</span>
                  </MenuItem>
                )}
                <MenuDivider />
              </>
            )}
            <MenuItem href={url} target="_blank">
              <Icon icon="external" />
              <small class="menu-double-lines">{niceAccountURL(url)}</small>
            </MenuItem>
            <div class="menu-horizontal">
              <MenuItem
                onClick={() => {
                  // Copy url to clipboard
                  try {
                    navigator.clipboard.writeText(url);
                    showToast('Link copied');
                  } catch (e) {
                    console.error(e);
                    showToast('Unable to copy link');
                  }
                }}
              >
                <Icon icon="link" />
                <span>Copy</span>
              </MenuItem>
              {navigator?.share &&
                navigator?.canShare?.({
                  url,
                }) && (
                  <MenuItem
                    onClick={() => {
                      try {
                        navigator.share({
                          url,
                        });
                      } catch (e) {
                        console.error(e);
                        alert("Sharing doesn't seem to work.");
                      }
                    }}
                  >
                    <Icon icon="share" />
                    <span>Share…</span>
                  </MenuItem>
                )}
            </div>
            {!!relationship && (
              <>
                <MenuDivider />
                {muting ? (
                  <MenuItem
                    onClick={() => {
                      setRelationshipUIState('loading');
                      (async () => {
                        try {
                          const newRelationship =
                            await currentMasto.v1.accounts.unmute(
                              currentInfo?.id || id,
                            );
                          console.log('unmuting', newRelationship);
                          setRelationship(newRelationship);
                          setRelationshipUIState('default');
                          showToast(`Unmuted @${username}`);
                        } catch (e) {
                          console.error(e);
                          setRelationshipUIState('error');
                        }
                      })();
                    }}
                  >
                    <Icon icon="unmute" />
                    <span>Unmute @{username}</span>
                  </MenuItem>
                ) : (
                  <SubMenu
                    openTrigger="clickOnly"
                    direction="bottom"
                    overflow="auto"
                    shift={16}
                    label={
                      <>
                        <Icon icon="mute" />
                        <span class="menu-grow">Mute @{username}…</span>
                        <span
                          style={{
                            textOverflow: 'clip',
                          }}
                        >
                          <Icon icon="time" />
                          <Icon icon="chevron-right" />
                        </span>
                      </>
                    }
                  >
                    <div class="menu-wrap">
                      {MUTE_DURATIONS.map((duration) => (
                        <MenuItem
                          onClick={() => {
                            setRelationshipUIState('loading');
                            (async () => {
                              try {
                                const newRelationship =
                                  await currentMasto.v1.accounts.mute(
                                    currentInfo?.id || id,
                                    {
                                      duration,
                                    },
                                  );
                                console.log('muting', newRelationship);
                                setRelationship(newRelationship);
                                setRelationshipUIState('default');
                                showToast(
                                  `Muted @${username} for ${MUTE_DURATIONS_LABELS[duration]}`,
                                );
                              } catch (e) {
                                console.error(e);
                                setRelationshipUIState('error');
                                showToast(`Unable to mute @${username}`);
                              }
                            })();
                          }}
                        >
                          {MUTE_DURATIONS_LABELS[duration]}
                        </MenuItem>
                      ))}
                    </div>
                  </SubMenu>
                )}
                <MenuConfirm
                  subMenu
                  confirm={!blocking}
                  confirmLabel={
                    <>
                      <Icon icon="block" />
                      <span>Block @{username}?</span>
                    </>
                  }
                  menuItemClassName="danger"
                  onClick={() => {
                    // if (!blocking && !confirm(`Block @${username}?`)) {
                    //   return;
                    // }
                    setRelationshipUIState('loading');
                    (async () => {
                      try {
                        if (blocking) {
                          const newRelationship =
                            await currentMasto.v1.accounts.unblock(
                              currentInfo?.id || id,
                            );
                          console.log('unblocking', newRelationship);
                          setRelationship(newRelationship);
                          setRelationshipUIState('default');
                          showToast(`Unblocked @${username}`);
                        } else {
                          const newRelationship =
                            await currentMasto.v1.accounts.block(
                              currentInfo?.id || id,
                            );
                          console.log('blocking', newRelationship);
                          setRelationship(newRelationship);
                          setRelationshipUIState('default');
                          showToast(`Blocked @${username}`);
                        }
                      } catch (e) {
                        console.error(e);
                        setRelationshipUIState('error');
                        if (blocking) {
                          showToast(`Unable to unblock @${username}`);
                        } else {
                          showToast(`Unable to block @${username}`);
                        }
                      }
                    })();
                  }}
                >
                  {blocking ? (
                    <>
                      <Icon icon="unblock" />
                      <span>Unblock @{username}</span>
                    </>
                  ) : (
                    <>
                      <Icon icon="block" />
                      <span>Block @{username}…</span>
                    </>
                  )}
                </MenuConfirm>
                {/* <MenuItem>
                <Icon icon="flag" />
                <span>Report @{username}…</span>
              </MenuItem> */}
              </>
            )}
          </Menu>
          {!relationship && relationshipUIState === 'loading' && (
            <Loader abrupt />
          )}
          {!!relationship && (
            <MenuConfirm
              confirm={following || requested}
              confirmLabel={
                <span>
                  {requested
                    ? 'Withdraw follow request?'
                    : `Unfollow @${info.acct || info.username}?`}
                </span>
              }
              menuItemClassName="danger"
              align="end"
              disabled={loading}
              onClick={() => {
                setRelationshipUIState('loading');
                (async () => {
                  try {
                    let newRelationship;

                    if (following || requested) {
                      // const yes = confirm(
                      //   requested
                      //     ? 'Withdraw follow request?'
                      //     : `Unfollow @${info.acct || info.username}?`,
                      // );

                      // if (yes) {
                      newRelationship = await currentMasto.v1.accounts.unfollow(
                        accountID.current,
                      );
                      // }
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
              <button
                type="button"
                class={`${following || requested ? 'light swap' : ''}`}
                data-swap-state={following || requested ? 'danger' : ''}
                disabled={loading}
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
            </MenuConfirm>
          )}
        </span>
      </p>
      {!!showTranslatedBio && (
        <Modal
          class="light"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowTranslatedBio(false);
            }
          }}
        >
          <TranslatedBioSheet
            note={note}
            fields={fields}
            onClose={() => setShowTranslatedBio(false)}
          />
        </Modal>
      )}
      {!!showAddRemoveLists && (
        <Modal
          class="light"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddRemoveLists(false);
            }
          }}
        >
          <AddRemoveListsSheet
            accountID={accountID.current}
            onClose={() => setShowAddRemoveLists(false)}
          />
        </Modal>
      )}
    </>
  );
}

// Apply more alpha if high luminence
function lightenRGB([r, g, b]) {
  const luminence = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  console.log('luminence', luminence);
  let alpha;
  if (luminence >= 220) {
    alpha = 1;
  } else if (luminence <= 50) {
    alpha = 0.1;
  } else {
    alpha = luminence / 255;
  }
  alpha = Math.min(1, alpha);
  return [r, g, b, alpha];
}

function niceAccountURL(url) {
  if (!url) return;
  const urlObj = new URL(url);
  const { host, pathname } = urlObj;
  const path = pathname.replace(/\/$/, '').replace(/^\//, '');
  return (
    <>
      <span class="more-insignificant">{host}/</span>
      <wbr />
      <span>{path}</span>
    </>
  );
}

function TranslatedBioSheet({ note, fields, onClose }) {
  const fieldsText =
    fields
      ?.map(({ name, value }) => `${name}\n${getHTMLText(value)}`)
      .join('\n\n') || '';

  const text = getHTMLText(note) + (fieldsText ? `\n\n${fieldsText}` : '');

  return (
    <div class="sheet">
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" />
        </button>
      )}
      <header>
        <h2>Translated Bio</h2>
      </header>
      <main>
        <p
          style={{
            whiteSpace: 'pre-wrap',
          }}
        >
          {text}
        </p>
        <TranslationBlock forceTranslate text={text} />
      </main>
    </div>
  );
}

function AddRemoveListsSheet({ accountID, onClose }) {
  const { masto } = api();
  const [uiState, setUIState] = useState('default');
  const [lists, setLists] = useState([]);
  const [listsContainingAccount, setListsContainingAccount] = useState([]);
  const [reloadCount, reload] = useReducer((c) => c + 1, 0);

  useEffect(() => {
    setUIState('loading');
    (async () => {
      try {
        const lists = await masto.v1.lists.list();
        const listsContainingAccount = await masto.v1.accounts.listLists(
          accountID,
        );
        console.log({ lists, listsContainingAccount });
        setLists(lists);
        setListsContainingAccount(listsContainingAccount);
        setUIState('default');
      } catch (e) {
        console.error(e);
        setUIState('error');
      }
    })();
  }, [reloadCount]);

  const [showListAddEditModal, setShowListAddEditModal] = useState(false);

  return (
    <div class="sheet" id="list-add-remove-container">
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" />
        </button>
      )}
      <header>
        <h2>Add/Remove from Lists</h2>
      </header>
      <main>
        {lists.length > 0 ? (
          <ul class="list-add-remove">
            {lists.map((list) => {
              const inList = listsContainingAccount.some(
                (l) => l.id === list.id,
              );
              return (
                <li>
                  <button
                    type="button"
                    class={`light ${inList ? 'checked' : ''}`}
                    disabled={uiState === 'loading'}
                    onClick={() => {
                      setUIState('loading');
                      (async () => {
                        try {
                          if (inList) {
                            await masto.v1.lists.removeAccount(list.id, {
                              accountIds: [accountID],
                            });
                          } else {
                            await masto.v1.lists.addAccount(list.id, {
                              accountIds: [accountID],
                            });
                          }
                          // setUIState('default');
                          reload();
                        } catch (e) {
                          console.error(e);
                          setUIState('error');
                          alert(
                            inList
                              ? 'Unable to remove from list.'
                              : 'Unable to add to list.',
                          );
                        }
                      })();
                    }}
                  >
                    <Icon icon="check-circle" />
                    <span>{list.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : uiState === 'loading' ? (
          <p class="ui-state">
            <Loader abrupt />
          </p>
        ) : uiState === 'error' ? (
          <p class="ui-state">Unable to load lists.</p>
        ) : (
          <p class="ui-state">No lists.</p>
        )}
        <button
          type="button"
          class="plain2"
          onClick={() => setShowListAddEditModal(true)}
          disabled={uiState !== 'default'}
        >
          <Icon icon="plus" size="l" /> <span>New list</span>
        </button>
      </main>
      {showListAddEditModal && (
        <Modal
          class="light"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowListAddEditModal(false);
            }
          }}
        >
          <ListAddEdit
            list={showListAddEditModal?.list}
            onClose={(result) => {
              if (result.state === 'success') {
                reload();
              }
              setShowListAddEditModal(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

export default AccountInfo;
