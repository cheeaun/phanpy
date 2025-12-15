import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { MenuDivider, MenuItem } from '@szhsin/react-menu';
import { useEffect, useRef, useState } from 'preact/hooks';
import punycode from 'punycode/';

import { api } from '../utils/api';
import i18nDuration from '../utils/i18n-duration';
import isSearchEnabled from '../utils/is-search-enabled';
import niceDateTime from '../utils/nice-date-time';
import showCompose from '../utils/show-compose';
import showToast from '../utils/show-toast';
import states from '../utils/states';
import { getCurrentAccountID, updateAccount } from '../utils/store-utils';
import supports from '../utils/supports';

import { handleScannerClick } from './account-info';
import AddRemoveListsSheet from './add-remove-lists-sheet';
import Icon from './icon';
import Loader from './loader';
import MenuConfirm from './menu-confirm';
import Menu2 from './menu2';
import Modal from './modal';
import PrivateNoteSheet from './private-note-sheet';
import SubMenu2 from './submenu2';
import TranslatedBioSheet from './translated-bio-sheet';

const MUTE_DURATIONS = [
  60 * 5, // 5 minutes
  60 * 30, // 30 minutes
  60 * 60, // 1 hour
  60 * 60 * 6, // 6 hours
  60 * 60 * 24, // 1 day
  60 * 60 * 24 * 3, // 3 days
  60 * 60 * 24 * 7, // 1 week
  60 * 60 * 24 * 30, // 30 days
  0, // forever
];
const MUTE_DURATIONS_LABELS = {
  0: msg`Forever`,
  300: i18nDuration(5, 'minute'),
  1_800: i18nDuration(30, 'minute'),
  3_600: i18nDuration(1, 'hour'),
  21_600: i18nDuration(6, 'hour'),
  86_400: i18nDuration(1, 'day'),
  259_200: i18nDuration(3, 'day'),
  604_800: i18nDuration(1, 'week'),
  2592_000: i18nDuration(30, 'day'),
};

function RelatedActions({
  info,
  instance,
  standalone,
  authenticated,
  onRelationshipChange = () => {},
  setShowEditProfile = () => {},
  showEndorsements = false,
  renderEndorsements = false,
  setRenderEndorsements = () => {},
}) {
  if (!info) return null;
  const { _, t } = useLingui();
  const {
    masto: currentMasto,
    instance: currentInstance,
    authenticated: currentAuthenticated,
  } = api();
  const sameInstance = instance === currentInstance;

  const [relationshipUIState, setRelationshipUIState] = useState('default');
  const [relationship, setRelationship] = useState(null);

  const { id, acct, url, username, locked, lastStatusAt, note, fields, moved } =
    info;
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
    note: privateNote,
  } = relationship || {};

  const [currentInfo, setCurrentInfo] = useState(null);
  const [isSelf, setIsSelf] = useState(false);

  const acctWithInstance = acct.includes('@') ? acct : `${acct}@${instance}`;

  const supportsEndorsements = supports('@mastodon/endorsements');

  useEffect(() => {
    if (info) {
      const currentAccount = getCurrentAccountID();
      let currentID;
      (async () => {
        if (sameInstance && authenticated) {
          currentID = id;
        } else if (!sameInstance && currentAuthenticated) {
          // Grab this account from my logged-in instance
          const acctHasInstance = info.acct.includes('@');
          try {
            const results = await currentMasto.v2.search.list({
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

        // if (moved) return;

        setRelationshipUIState('loading');

        const fetchRelationships = currentMasto.v1.accounts.relationships.fetch(
          {
            id: [currentID],
          },
        );

        try {
          const relationships = await fetchRelationships;
          console.log('fetched relationship', relationships);
          setRelationshipUIState('default');

          if (relationships.length) {
            const relationship = relationships[0];
            setRelationship(relationship);
            onRelationshipChange({ relationship, currentID });
          }
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

  const [showTranslatedBio, setShowTranslatedBio] = useState(false);
  const [showAddRemoveLists, setShowAddRemoveLists] = useState(false);
  const [showPrivateNoteModal, setShowPrivateNoteModal] = useState(false);
  const [lists, setLists] = useState([]);
  const [searchEnabled, setSearchEnabled] = useState(false);

  useEffect(() => {
    if (!currentAuthenticated) return;
    (async () => {
      const enabled = await isSearchEnabled(currentInstance);
      setSearchEnabled(enabled);
    })();
  }, [currentInstance, currentAuthenticated]);

  let { headerStatic, avatarStatic } = info;
  if (!headerStatic || /missing\.png$/.test(headerStatic)) {
    if (avatarStatic && !/missing\.png$/.test(avatarStatic)) {
      headerStatic = avatarStatic;
    }
  }

  return (
    <>
      <div class="actions">
        <span>
          {followedBy ? (
            <span class="tag">
              <Trans>Follows you</Trans>
            </span>
          ) : !!lastStatusAt ? (
            <small class="insignificant">
              <Trans>
                Last post:{' '}
                <span class="ib">
                  {niceDateTime(lastStatusAt, {
                    hideTime: true,
                  })}
                </span>
              </Trans>
            </small>
          ) : (
            <span />
          )}
          {muting && (
            <span class="tag danger">
              <Trans>Muted</Trans>
            </span>
          )}
          {blocking && (
            <span class="tag danger">
              <Trans>Blocked</Trans>
            </span>
          )}
        </span>{' '}
        <span class="buttons">
          {!!privateNote && (
            <button
              type="button"
              class="private-note-tag"
              title={t`Notes`}
              onClick={() => {
                setShowPrivateNoteModal(true);
              }}
              dir="auto"
            >
              <span>{privateNote}</span>
            </button>
          )}
          {currentAuthenticated && isSelf && (
            <button
              type="button"
              class="plain"
              onClick={() => {
                states.showQrCodeModal = {
                  text: url,
                  arena: avatarStatic,
                  backgroundMask: headerStatic,
                  caption: acct.includes('@') ? acct : `${acct}@${instance}`,
                  onScannerClick: handleScannerClick,
                };
              }}
            >
              <Icon icon="qrcode" alt={t`QR code`} />
            </button>
          )}
          <Menu2
            portal={{
              target: document.body,
            }}
            containerProps={{
              style: {
                // Higher than the backdrop
                zIndex: 1001,
              },
            }}
            align="center"
            position="anchor"
            overflow="auto"
            menuButton={
              <button type="button" class="plain4" disabled={loading}>
                <Icon icon="more2" size="l" alt={t`More`} />
              </button>
            }
            onMenuChange={(e) => {
              if (following && e.open) {
                // Fetch lists that have this account
                (async () => {
                  try {
                    const lists = await currentMasto.v1.accounts
                      .$select(accountID.current)
                      .lists.list();
                    console.log('fetched account lists', lists);
                    setLists(lists);
                  } catch (e) {
                    console.error(e);
                  }
                })();
              }
            }}
          >
            {currentAuthenticated && !isSelf ? (
              <>
                <MenuItem
                  onClick={() => {
                    showCompose({
                      draftStatus: {
                        status: `@${currentInfo?.acct || acct} `,
                      },
                    });
                  }}
                >
                  <Icon icon="at" />
                  <span>
                    <Trans>
                      Mention <span class="bidi-isolate">@{username}</span>
                    </Trans>
                  </span>
                </MenuItem>
                {searchEnabled && (
                  <MenuItem
                    onClick={() => {
                      states.showSearchCommand = { query: `from:${acct} ` };
                    }}
                  >
                    <Icon icon="search" />
                    <span>
                      <Trans>
                        Search <span class="bidi-isolate">@{username}</span>'s
                        posts
                      </Trans>
                    </span>
                  </MenuItem>
                )}
                <MenuItem
                  onClick={() => {
                    setShowTranslatedBio(true);
                  }}
                >
                  <Icon icon="translate" />
                  <span>
                    <Trans>Translate bio</Trans>
                  </span>
                </MenuItem>
                {supports('@mastodon/profile-private-note') && (
                  <MenuItem
                    onClick={() => {
                      setShowPrivateNoteModal(true);
                    }}
                  >
                    <Icon icon="note" />
                    <span>{privateNote ? t`Edit notes` : t`Add notes`}</span>
                  </MenuItem>
                )}
                {following && !!relationship && (
                  <>
                    <MenuItem
                      onClick={() => {
                        setRelationshipUIState('loading');
                        (async () => {
                          try {
                            const rel = await currentMasto.v1.accounts
                              .$select(accountID.current)
                              .follow({
                                notify: !notifying,
                              });
                            if (rel) setRelationship(rel);
                            setRelationshipUIState('default');
                            showToast(
                              rel.notifying
                                ? t`Notifications enabled for @${username}'s posts.`
                                : t` Notifications disabled for @${username}'s posts.`,
                            );
                          } catch (e) {
                            alert(e);
                            setRelationshipUIState('error');
                          }
                        })();
                      }}
                    >
                      <Icon icon="notification" />
                      <span>
                        {notifying
                          ? t`Disable notifications`
                          : t`Enable notifications`}
                      </span>
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        setRelationshipUIState('loading');
                        (async () => {
                          try {
                            const rel = await currentMasto.v1.accounts
                              .$select(accountID.current)
                              .follow({
                                reblogs: !showingReblogs,
                              });
                            if (rel) setRelationship(rel);
                            setRelationshipUIState('default');
                            showToast(
                              rel.showingReblogs
                                ? t`Boosts from @${username} enabled.`
                                : t`Boosts from @${username} disabled.`,
                            );
                          } catch (e) {
                            alert(e);
                            setRelationshipUIState('error');
                          }
                        })();
                      }}
                    >
                      <Icon icon="rocket" />
                      <span>
                        {showingReblogs ? t`Disable boosts` : t`Enable boosts`}
                      </span>
                    </MenuItem>
                  </>
                )}
                {supportsEndorsements && following && (
                  <MenuItem
                    onClick={() => {
                      setRelationshipUIState('loading');
                      (async () => {
                        try {
                          if (endorsed) {
                            const newRelationship =
                              await currentMasto.v1.accounts
                                .$select(currentInfo?.id || id)
                                .unpin();
                            setRelationship(newRelationship);
                            setRelationshipUIState('default');
                            showToast(
                              t`@${username} is no longer featured on your profile.`,
                            );
                          } else {
                            const newRelationship =
                              await currentMasto.v1.accounts
                                .$select(currentInfo?.id || id)
                                .pin();
                            setRelationship(newRelationship);
                            setRelationshipUIState('default');
                            showToast(
                              t`@${username} is now featured on your profile.`,
                            );
                          }
                        } catch (e) {
                          console.error(e);
                          setRelationshipUIState('error');
                          if (endorsed) {
                            showToast(
                              t`Unable to unfeature @${username} on your profile.`,
                            );
                          } else {
                            showToast(
                              t`Unable to feature @${username} on your profile.`,
                            );
                          }
                        }
                      })();
                    }}
                  >
                    <Icon icon="endorsement" />
                    {endorsed
                      ? t`Don't feature on profile`
                      : t`Feature on profile`}
                  </MenuItem>
                )}
                {showEndorsements &&
                  supportsEndorsements &&
                  !renderEndorsements && (
                    <MenuItem onClick={() => setRenderEndorsements(true)}>
                      <Icon icon="endorsement" />
                      <span>
                        <Trans>Show featured profiles</Trans>
                      </span>
                    </MenuItem>
                  )}
                {/* Add/remove from lists is only possible if following the account */}
                {following && (
                  <MenuItem
                    onClick={() => {
                      setShowAddRemoveLists(true);
                    }}
                  >
                    <Icon icon="list" />
                    {lists.length ? (
                      <>
                        <small class="menu-grow">
                          <Trans>Add/Remove from Lists</Trans>
                          <br />
                          <span class="more-insignificant">
                            {lists.map((list) => list.title).join(', ')}
                          </span>
                        </small>
                        <small class="more-insignificant">{lists.length}</small>
                      </>
                    ) : (
                      <span>
                        <Trans>Add/Remove from Lists</Trans>
                      </span>
                    )}
                  </MenuItem>
                )}
                <MenuDivider />
              </>
            ) : (
              <>
                {searchEnabled && isSelf && (
                  <MenuItem
                    onClick={() => {
                      states.showSearchCommand = { query: 'from:me ' };
                    }}
                  >
                    <Icon icon="search" />
                    <span>
                      <Trans>Search my posts</Trans>
                    </span>
                  </MenuItem>
                )}
                {supportsEndorsements && !renderEndorsements && (
                  <>
                    <MenuItem onClick={() => setRenderEndorsements(true)}>
                      <Icon icon="endorsement" />
                      <Trans>Show featured profiles</Trans>
                    </MenuItem>
                  </>
                )}
                {((searchEnabled && isSelf) ||
                  (supportsEndorsements && !renderEndorsements)) && (
                  <MenuDivider />
                )}
              </>
            )}
            <MenuItem
              onClick={() => {
                const handle = `@${currentInfo?.acct || acctWithInstance}`;
                try {
                  navigator.clipboard.writeText(handle);
                  showToast(t`Handle copied`);
                } catch (e) {
                  console.error(e);
                  showToast(t`Unable to copy handle`);
                }
              }}
            >
              <Icon icon="copy" />
              <small>
                <Trans>Copy handle</Trans>
                <br />
                <span class="more-insignificant bidi-isolate">
                  @{currentInfo?.acct || acctWithInstance}
                </span>
              </small>
            </MenuItem>
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
                        alert(t`Sharing doesn't seem to work.`);
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
            <MenuItem
              onClick={() => {
                states.showQrCodeModal = {
                  text: url,
                  arena: avatarStatic,
                  backgroundMask: headerStatic,
                  caption: acct.includes('@') ? acct : `${acct}@${instance}`,
                  onScannerClick: handleScannerClick,
                };
              }}
            >
              <Icon icon="qrcode" />
              <span>
                <Trans>QR code</Trans>
              </span>
            </MenuItem>
            {!!relationship && (
              <>
                <MenuDivider />
                {muting ? (
                  <MenuItem
                    onClick={() => {
                      setRelationshipUIState('loading');
                      (async () => {
                        try {
                          const newRelationship = await currentMasto.v1.accounts
                            .$select(currentInfo?.id || id)
                            .unmute();
                          console.log('unmuting', newRelationship);
                          setRelationship(newRelationship);
                          setRelationshipUIState('default');
                          showToast(t`Unmuted @${username}`);
                          states.reloadGenericAccounts.id = 'mute';
                          states.reloadGenericAccounts.counter++;
                        } catch (e) {
                          console.error(e);
                          setRelationshipUIState('error');
                        }
                      })();
                    }}
                  >
                    <Icon icon="unmute" />
                    <span>
                      <Trans>
                        Unmute <span class="bidi-isolate">@{username}</span>
                      </Trans>
                    </span>
                  </MenuItem>
                ) : (
                  <SubMenu2
                    menuClassName="menu-blur"
                    openTrigger="clickOnly"
                    direction="bottom"
                    overflow="auto"
                    shift={16}
                    label={
                      <>
                        <Icon icon="mute" />
                        <span class="menu-grow">
                          <Trans>
                            Mute <span class="bidi-isolate">@{username}</span>…
                          </Trans>
                        </span>
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
                                  await currentMasto.v1.accounts
                                    .$select(currentInfo?.id || id)
                                    .mute({
                                      duration,
                                    });
                                console.log('muting', newRelationship);
                                setRelationship(newRelationship);
                                setRelationshipUIState('default');
                                showToast(
                                  t`Muted @${username} for ${
                                    typeof MUTE_DURATIONS_LABELS[duration] ===
                                    'function'
                                      ? MUTE_DURATIONS_LABELS[duration]()
                                      : _(MUTE_DURATIONS_LABELS[duration])
                                  }`,
                                );
                                states.reloadGenericAccounts.id = 'mute';
                                states.reloadGenericAccounts.counter++;
                              } catch (e) {
                                console.error(e);
                                setRelationshipUIState('error');
                                showToast(t`Unable to mute @${username}`);
                              }
                            })();
                          }}
                        >
                          {typeof MUTE_DURATIONS_LABELS[duration] === 'function'
                            ? MUTE_DURATIONS_LABELS[duration]()
                            : _(MUTE_DURATIONS_LABELS[duration])}
                        </MenuItem>
                      ))}
                    </div>
                  </SubMenu2>
                )}
                {followedBy && (
                  <MenuConfirm
                    subMenu
                    menuItemClassName="danger"
                    confirmLabel={
                      <>
                        <Icon icon="user-x" />
                        <span>
                          <Trans>
                            Remove <span class="bidi-isolate">@{username}</span>{' '}
                            from followers?
                          </Trans>
                        </span>
                      </>
                    }
                    onClick={() => {
                      setRelationshipUIState('loading');
                      (async () => {
                        try {
                          const newRelationship = await currentMasto.v1.accounts
                            .$select(currentInfo?.id || id)
                            .removeFromFollowers();
                          console.log(
                            'removing from followers',
                            newRelationship,
                          );
                          setRelationship(newRelationship);
                          setRelationshipUIState('default');
                          showToast(t`@${username} removed from followers`);
                          states.reloadGenericAccounts.id = 'followers';
                          states.reloadGenericAccounts.counter++;
                        } catch (e) {
                          console.error(e);
                          setRelationshipUIState('error');
                        }
                      })();
                    }}
                  >
                    <Icon icon="user-x" />
                    <span>
                      <Trans>Remove follower…</Trans>
                    </span>
                  </MenuConfirm>
                )}
                <MenuConfirm
                  subMenu
                  confirm={!blocking}
                  confirmLabel={
                    <>
                      <Icon icon="block" />
                      <span>
                        <Trans>
                          Block <span class="bidi-isolate">@{username}</span>?
                        </Trans>
                      </span>
                    </>
                  }
                  itemProps={{
                    className: 'danger',
                  }}
                  menuItemClassName="danger"
                  onClick={() => {
                    // if (!blocking && !confirm(`Block @${username}?`)) {
                    //   return;
                    // }
                    setRelationshipUIState('loading');
                    (async () => {
                      try {
                        if (blocking) {
                          const newRelationship = await currentMasto.v1.accounts
                            .$select(currentInfo?.id || id)
                            .unblock();
                          console.log('unblocking', newRelationship);
                          setRelationship(newRelationship);
                          setRelationshipUIState('default');
                          showToast(t`Unblocked @${username}`);
                        } else {
                          const newRelationship = await currentMasto.v1.accounts
                            .$select(currentInfo?.id || id)
                            .block();
                          console.log('blocking', newRelationship);
                          setRelationship(newRelationship);
                          setRelationshipUIState('default');
                          showToast(t`Blocked @${username}`);
                        }
                        states.reloadGenericAccounts.id = 'block';
                        states.reloadGenericAccounts.counter++;
                      } catch (e) {
                        console.error(e);
                        setRelationshipUIState('error');
                        if (blocking) {
                          showToast(t`Unable to unblock @${username}`);
                        } else {
                          showToast(t`Unable to block @${username}`);
                        }
                      }
                    })();
                  }}
                >
                  {blocking ? (
                    <>
                      <Icon icon="unblock" />
                      <span>
                        <Trans>
                          Unblock <span class="bidi-isolate">@{username}</span>
                        </Trans>
                      </span>
                    </>
                  ) : (
                    <>
                      <Icon icon="block" />
                      <span>
                        <Trans>
                          Block <span class="bidi-isolate">@{username}</span>…
                        </Trans>
                      </span>
                    </>
                  )}
                </MenuConfirm>
                <MenuItem
                  className="danger"
                  onClick={() => {
                    states.showReportModal = {
                      account: currentInfo || info,
                    };
                  }}
                >
                  <Icon icon="flag" />
                  <span>
                    <Trans>
                      Report <span class="bidi-isolate">@{username}</span>…
                    </Trans>
                  </span>
                </MenuItem>
              </>
            )}
            {currentAuthenticated &&
              isSelf &&
              standalone &&
              supports('@mastodon/profile-edit') && (
                <>
                  <MenuDivider />
                  <MenuItem
                    onClick={() => {
                      setShowEditProfile(true);
                    }}
                  >
                    <Icon icon="pencil" />
                    <span>
                      <Trans>Edit profile</Trans>
                    </span>
                  </MenuItem>
                </>
              )}
            {import.meta.env.DEV && currentAuthenticated && isSelf && (
              <>
                <MenuDivider />
                <MenuItem
                  onClick={async () => {
                    const relationships =
                      await currentMasto.v1.accounts.relationships.fetch({
                        id: [accountID.current],
                      });
                    const { note } = relationships[0] || {};
                    if (note) {
                      alert(note);
                      console.log(note);
                    }
                  }}
                >
                  <Icon icon="pencil" />
                  <span>See note</span>
                </MenuItem>
              </>
            )}
          </Menu2>
          {!relationship && relationshipUIState === 'loading' && (
            <Loader abrupt />
          )}
          {!!relationship && !moved && (
            <MenuConfirm
              confirm={following || requested}
              confirmLabel={
                <span>
                  {requested
                    ? t`Withdraw follow request?`
                    : t`Unfollow @${info.acct || info.username}?`}
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
                      newRelationship = await currentMasto.v1.accounts
                        .$select(accountID.current)
                        .unfollow();
                      // }
                    } else {
                      newRelationship = await currentMasto.v1.accounts
                        .$select(accountID.current)
                        .follow();
                    }

                    if (newRelationship) {
                      setRelationship(newRelationship);

                      // Show endorsements if start following
                      if (
                        showEndorsements &&
                        supportsEndorsements &&
                        !renderEndorsements &&
                        newRelationship.following
                      ) {
                        setRenderEndorsements('onlyOpenIfHasEndorsements');
                      }
                    }
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
                    <span>
                      <Trans>Following</Trans>
                    </span>
                    <span>
                      <Trans>Unfollow…</Trans>
                    </span>
                  </>
                ) : requested ? (
                  <>
                    <span>
                      <Trans>Requested</Trans>
                    </span>
                    <span>
                      <Trans>Withdraw…</Trans>
                    </span>
                  </>
                ) : locked ? (
                  <>
                    <Icon icon="lock" />{' '}
                    <span>
                      <Trans>Follow</Trans>
                    </span>
                  </>
                ) : (
                  t`Follow`
                )}
              </button>
            </MenuConfirm>
          )}
        </span>
      </div>
      {!!showTranslatedBio && (
        <Modal
          onClose={() => {
            setShowTranslatedBio(false);
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
          onClose={() => {
            setShowAddRemoveLists(false);
          }}
        >
          <AddRemoveListsSheet
            accountID={accountID.current}
            onClose={() => setShowAddRemoveLists(false)}
          />
        </Modal>
      )}
      {!!showPrivateNoteModal && (
        <Modal
          onClose={() => {
            setShowPrivateNoteModal(false);
          }}
        >
          <PrivateNoteSheet
            account={info}
            note={privateNote}
            onRelationshipChange={(relationship) => {
              setRelationship(relationship);
              // onRelationshipChange({ relationship, currentID: accountID.current });
            }}
            onClose={() => setShowPrivateNoteModal(false)}
          />
        </Modal>
      )}
    </>
  );
}

function niceAccountURL(url) {
  if (!url) return;
  const urlObj = URL.parse(url);
  if (!urlObj) return;
  const { host, pathname } = urlObj;
  const path = pathname.replace(/\/$/, '').replace(/^\//, '');
  return (
    <>
      <span class="more-insignificant">{punycode.toUnicode(host)}/</span>
      <wbr />
      <span>{path}</span>
    </>
  );
}

export default RelatedActions;
