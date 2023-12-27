import './account-info.css';

import { Menu, MenuDivider, MenuItem, SubMenu } from '@szhsin/react-menu';
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'preact/hooks';

import { api } from '../utils/api';
import enhanceContent from '../utils/enhance-content';
import getHTMLText from '../utils/getHTMLText';
import handleContentLinks from '../utils/handle-content-links';
import niceDateTime from '../utils/nice-date-time';
import pmem from '../utils/pmem';
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
import Menu2 from './menu2';
import MenuConfirm from './menu-confirm';
import Modal from './modal';
import TranslationBlock from './translation-block';

const MUTE_DURATIONS = [
  60 * 5, // 5 minutes
  60 * 30, // 30 minutes
  60 * 60, // 1 hour
  60 * 60 * 6, // 6 hours
  60 * 60 * 24, // 1 day
  60 * 60 * 24 * 3, // 3 days
  60 * 60 * 24 * 7, // 1 week
  0, // forever
];
const MUTE_DURATIONS_LABELS = {
  0: 'Forever',
  300: '5 minutes',
  1_800: '30 minutes',
  3_600: '1 hour',
  21_600: '6 hours',
  86_400: '1 day',
  259_200: '3 days',
  604_800: '1 week',
};

const LIMIT = 80;

const ACCOUNT_INFO_MAX_AGE = 1000 * 60 * 10; // 10 mins

function fetchFamiliarFollowers(currentID, masto) {
  return masto.v1.accounts.familiarFollowers.fetch({
    id: [currentID],
  });
}
const memFetchFamiliarFollowers = pmem(fetchFamiliarFollowers, {
  maxAge: ACCOUNT_INFO_MAX_AGE,
});

async function fetchPostingStats(accountID, masto) {
  const fetchStatuses = masto.v1.accounts
    .$select(accountID)
    .statuses.list({
      limit: 20,
    })
    .next();

  const { value: statuses } = await fetchStatuses;
  console.log('fetched statuses', statuses);
  const stats = {
    total: statuses.length,
    originals: 0,
    replies: 0,
    boosts: 0,
  };
  // Categories statuses by type
  // - Original posts (not replies to others)
  // - Threads (self-replies + 1st original post)
  // - Boosts (reblogs)
  // - Replies (not-self replies)
  statuses.forEach((status) => {
    if (status.reblog) {
      stats.boosts++;
    } else if (
      !!status.inReplyToId &&
      status.inReplyToAccountId !== status.account.id // Not self-reply
    ) {
      stats.replies++;
    } else {
      stats.originals++;
    }
  });

  // Count days since last post
  if (statuses.length) {
    stats.daysSinceLastPost = Math.ceil(
      (Date.now() - new Date(statuses[statuses.length - 1].createdAt)) /
        86400000,
    );
  }

  console.log('posting stats', stats);
  return stats;
}
const memFetchPostingStats = pmem(fetchPostingStats, {
  maxAge: ACCOUNT_INFO_MAX_AGE,
});

function AccountInfo({
  account,
  fetchAccount = () => {},
  standalone,
  instance,
  authenticated,
}) {
  const { masto } = api({
    instance,
  });
  const { masto: currentMasto, instance: currentInstance } = api();
  const [uiState, setUIState] = useState('default');
  const isString = typeof account === 'string';
  const [info, setInfo] = useState(isString ? null : account);

  const sameCurrentInstance = useMemo(
    () => instance === currentInstance,
    [instance, currentInstance],
  );

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
    memorial,
    moved,
    roles,
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

  const isSelf = useMemo(
    () => id === store.session.get('currentAccount'),
    [id],
  );

  useEffect(() => {
    const infoHasEssentials = !!(
      info?.id &&
      info?.username &&
      info?.acct &&
      info?.avatar &&
      info?.avatarStatic &&
      info?.displayName &&
      info?.url
    );
    if (isSelf && instance && infoHasEssentials) {
      const accounts = store.local.getJSON('accounts');
      let updated = false;
      accounts.forEach((account) => {
        if (account.info.id === info.id && account.instanceURL === instance) {
          account.info = info;
          updated = true;
        }
      });
      if (updated) {
        console.log('Updated account info', info);
        store.local.setJSON('accounts', accounts);
      }
    }
  }, [isSelf, info, instance]);

  const accountInstance = useMemo(() => {
    if (!url) return null;
    const domain = new URL(url).hostname;
    return domain;
  }, [url]);

  const [headerCornerColors, setHeaderCornerColors] = useState([]);

  const followersIterator = useRef();
  const familiarFollowersCache = useRef([]);
  async function fetchFollowers(firstLoad) {
    if (firstLoad || !followersIterator.current) {
      followersIterator.current = masto.v1.accounts.$select(id).followers.list({
        limit: LIMIT,
      });
    }
    const results = await followersIterator.current.next();
    if (isSelf) return results;
    if (!sameCurrentInstance) return results;

    const { value } = results;
    let newValue = [];
    // On first load, fetch familiar followers, merge to top of results' `value`
    // Remove dups on every fetch
    if (firstLoad) {
      const familiarFollowers = await masto.v1.accounts.familiarFollowers.fetch(
        {
          id: [id],
        },
      );
      familiarFollowersCache.current = familiarFollowers[0].accounts;
      newValue = [
        ...familiarFollowersCache.current,
        ...value.filter(
          (account) =>
            !familiarFollowersCache.current.some(
              (familiar) => familiar.id === account.id,
            ),
        ),
      ];
    } else if (value?.length) {
      newValue = value.filter(
        (account) =>
          !familiarFollowersCache.current.some(
            (familiar) => familiar.id === account.id,
          ),
      );
    }

    return {
      ...results,
      value: newValue,
    };
  }

  const followingIterator = useRef();
  async function fetchFollowing(firstLoad) {
    if (firstLoad || !followingIterator.current) {
      followingIterator.current = masto.v1.accounts.$select(id).following.list({
        limit: LIMIT,
      });
    }
    const results = await followingIterator.current.next();
    return results;
  }

  const LinkOrDiv = standalone ? 'div' : Link;
  const accountLink = instance ? `/${instance}/a/${id}` : `/a/${id}`;

  const [familiarFollowers, setFamiliarFollowers] = useState([]);
  const [postingStats, setPostingStats] = useState();
  const [postingStatsUIState, setPostingStatsUIState] = useState('default');
  const hasPostingStats = !!postingStats?.total;

  const renderFamiliarFollowers = async (currentID) => {
    try {
      const followers = await memFetchFamiliarFollowers(
        currentID,
        currentMasto,
      );
      console.log('fetched familiar followers', followers);
      setFamiliarFollowers(
        followers[0].accounts.slice(0, FAMILIAR_FOLLOWERS_LIMIT),
      );
    } catch (e) {
      console.error(e);
    }
  };

  const renderPostingStats = async () => {
    if (!id) return;
    setPostingStatsUIState('loading');
    try {
      const stats = await memFetchPostingStats(id, masto);
      setPostingStats(stats);
      setPostingStatsUIState('default');
    } catch (e) {
      console.error(e);
      setPostingStatsUIState('error');
    }
  };

  const onRelationshipChange = useCallback(
    ({ relationship, currentID }) => {
      if (!relationship.following) {
        renderFamiliarFollowers(currentID);
        if (!standalone && statusesCount > 0) {
          // Only render posting stats if not standalone and has posts
          renderPostingStats();
        }
      }
    },
    [standalone, id, statusesCount],
  );

  return (
    <div
      tabIndex="-1"
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
            <a
              href={isString ? account : url}
              target="_blank"
              rel="noopener noreferrer"
            >
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
              <p>███████ ████ ████</p>
              <p>████ ████████ ██████ █████████ ████ ██</p>
            </div>
            <div class="account-metadata-box">
              <div class="profile-metadata">
                <div class="profile-field">
                  <b class="more-insignificant">███</b>
                  <p>██████</p>
                </div>
                <div class="profile-field">
                  <b class="more-insignificant">████</b>
                  <p>███████████</p>
                </div>
              </div>
              <div class="stats">
                <div>
                  <span>██</span> Followers
                </div>
                <div>
                  <span>██</span> Following
                </div>
                <div>
                  <span>██</span> Posts
                </div>
              </div>
            </div>
            <div class="actions">
              <span />
              <span class="buttons">
                <button type="button" title="More" class="plain" disabled>
                  <Icon icon="more" size="l" alt="More" />
                </button>
              </span>
            </div>
          </main>
        </>
      ) : (
        info && (
          <>
            {!!moved && (
              <div class="account-moved">
                <p>
                  <b>{displayName}</b> has indicated that their new account is
                  now:
                </p>
                <AccountBlock
                  account={moved}
                  instance={instance}
                  onClick={(e) => {
                    e.stopPropagation();
                    states.showAccount = moved;
                  }}
                />
              </div>
            )}
            {!!header && !/missing\.png$/.test(header) && (
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
                    const ctx = canvas.getContext('2d', {
                      willReadFrequently: true,
                    });
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
            <div class="faux-header-bg" aria-hidden="true" />
            <main>
              {!!memorial && <span class="tag">In Memoriam</span>}
              {!!bot && (
                <span class="tag">
                  <Icon icon="bot" /> Automated
                </span>
              )}
              {!!group && (
                <span class="tag">
                  <Icon icon="group" /> Group
                </span>
              )}
              {roles?.map((role) => (
                <span class="tag">
                  {role.name}
                  {!!accountInstance && (
                    <>
                      {' '}
                      <span class="more-insignificant">{accountInstance}</span>
                    </>
                  )}
                </span>
              ))}
              <div
                class="note"
                dir="auto"
                onClick={handleContentLinks({
                  instance: currentInstance,
                })}
                dangerouslySetInnerHTML={{
                  __html: enhanceContent(note, { emojis }),
                }}
              />
              <div class="account-metadata-box">
                {fields?.length > 0 && (
                  <div class="profile-metadata">
                    {fields.map(({ name, value, verifiedAt }, i) => (
                      <div
                        class={`profile-field ${
                          verifiedAt ? 'profile-verified' : ''
                        }`}
                        key={name + i}
                        dir="auto"
                      >
                        <b>
                          <EmojiText text={name} emojis={emojis} />{' '}
                          {!!verifiedAt && (
                            <Icon icon="check-circle" size="s" />
                          )}
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
                <div class="stats">
                  <LinkOrDiv
                    tabIndex={0}
                    to={accountLink}
                    onClick={() => {
                      // states.showAccount = false;
                      setTimeout(() => {
                        states.showGenericAccounts = {
                          heading: 'Followers',
                          fetchAccounts: fetchFollowers,
                          instance,
                          excludeRelationshipAttrs: isSelf
                            ? ['followedBy']
                            : [],
                        };
                      }, 0);
                    }}
                  >
                    {!!familiarFollowers.length && (
                      <span class="shazam-container-horizontal">
                        <span class="shazam-container-inner stats-avatars-bunch">
                          {familiarFollowers.map((follower) => (
                            <Avatar
                              url={follower.avatarStatic}
                              size="s"
                              alt={`${follower.displayName} @${follower.acct}`}
                              squircle={follower?.bot}
                            />
                          ))}
                        </span>
                      </span>
                    )}
                    <span title={followersCount}>
                      {shortenNumber(followersCount)}
                    </span>{' '}
                    Followers
                  </LinkOrDiv>
                  <LinkOrDiv
                    class="insignificant"
                    tabIndex={0}
                    to={accountLink}
                    onClick={() => {
                      // states.showAccount = false;
                      setTimeout(() => {
                        states.showGenericAccounts = {
                          heading: 'Following',
                          fetchAccounts: fetchFollowing,
                          instance,
                          excludeRelationshipAttrs: isSelf ? ['following'] : [],
                        };
                      }, 0);
                    }}
                  >
                    <span title={followingCount}>
                      {shortenNumber(followingCount)}
                    </span>{' '}
                    Following
                    <br />
                  </LinkOrDiv>
                  <LinkOrDiv
                    class="insignificant"
                    to={accountLink}
                    // onClick={
                    //   standalone
                    //     ? undefined
                    //     : () => {
                    //         hideAllModals();
                    //       }
                    // }
                  >
                    <span title={statusesCount}>
                      {shortenNumber(statusesCount)}
                    </span>{' '}
                    Posts
                  </LinkOrDiv>
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
                </div>
              </div>
              {!!postingStats && (
                <LinkOrDiv
                  to={accountLink}
                  class="account-metadata-box"
                  // onClick={() => {
                  //   states.showAccount = false;
                  // }}
                >
                  <div class="shazam-container">
                    <div class="shazam-container-inner">
                      {hasPostingStats ? (
                        <div
                          class="posting-stats"
                          title={`${Math.round(
                            (postingStats.originals / postingStats.total) * 100,
                          )}% original posts, ${Math.round(
                            (postingStats.replies / postingStats.total) * 100,
                          )}% replies, ${Math.round(
                            (postingStats.boosts / postingStats.total) * 100,
                          )}% boosts`}
                        >
                          <div>
                            {postingStats.daysSinceLastPost < 365
                              ? `Last ${postingStats.total} post${
                                  postingStats.total > 1 ? 's' : ''
                                } in the past 
                      ${postingStats.daysSinceLastPost} day${
                                  postingStats.daysSinceLastPost > 1 ? 's' : ''
                                }`
                              : `
                      Last ${postingStats.total} posts in the past year(s)
                      `}
                          </div>
                          <div
                            class="posting-stats-bar"
                            style={{
                              // [originals | replies | boosts]
                              '--originals-percentage': `${
                                (postingStats.originals / postingStats.total) *
                                100
                              }%`,
                              '--replies-percentage': `${
                                ((postingStats.originals +
                                  postingStats.replies) /
                                  postingStats.total) *
                                100
                              }%`,
                            }}
                          />
                          <div class="posting-stats-legends">
                            <span class="ib">
                              <span class="posting-stats-legend-item posting-stats-legend-item-originals" />{' '}
                              Original
                            </span>{' '}
                            <span class="ib">
                              <span class="posting-stats-legend-item posting-stats-legend-item-replies" />{' '}
                              Replies
                            </span>{' '}
                            <span class="ib">
                              <span class="posting-stats-legend-item posting-stats-legend-item-boosts" />{' '}
                              Boosts
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div class="posting-stats">Post stats unavailable.</div>
                      )}
                    </div>
                  </div>
                </LinkOrDiv>
              )}
              <div class="account-metadata-box">
                <div
                  class="shazam-container no-animation"
                  hidden={!!postingStats}
                >
                  <div class="shazam-container-inner">
                    <button
                      type="button"
                      class="posting-stats-button"
                      disabled={postingStatsUIState === 'loading'}
                      onClick={() => {
                        renderPostingStats();
                      }}
                    >
                      <div
                        class={`posting-stats-bar posting-stats-icon ${
                          postingStatsUIState === 'loading' ? 'loading' : ''
                        }`}
                        style={{
                          '--originals-percentage': '33%',
                          '--replies-percentage': '66%',
                        }}
                      />
                      View post stats{' '}
                      {/* <Loader
                        abrupt
                        hidden={postingStatsUIState !== 'loading'}
                      /> */}
                    </button>
                  </div>
                </div>
              </div>
            </main>
            <footer>
              <RelatedActions
                info={info}
                instance={instance}
                authenticated={authenticated}
                onRelationshipChange={onRelationshipChange}
              />
            </footer>
          </>
        )
      )}
    </div>
  );
}

const FAMILIAR_FOLLOWERS_LIMIT = 3;

function RelatedActions({
  info,
  instance,
  authenticated,
  onRelationshipChange = () => {},
}) {
  if (!info) return null;
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
            const results = await currentMasto.v2.search.fetch({
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

        if (moved) return;

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

  return (
    <>
      <div class="actions">
        <span>
          {followedBy ? (
            <span class="tag">Follows you</span>
          ) : !!lastStatusAt ? (
            <small class="insignificant">
              Last post:{' '}
              <span class="ib">
                {niceDateTime(lastStatusAt, {
                  hideTime: true,
                })}
              </span>
            </small>
          ) : (
            <span />
          )}
          {muting && <span class="tag danger">Muted</span>}
          {blocking && <span class="tag danger">Blocked</span>}
        </span>{' '}
        <span class="buttons">
          {!!privateNote && (
            <button
              type="button"
              class="private-note-tag"
              title="Private note"
              onClick={() => {
                setShowPrivateNoteModal(true);
              }}
              dir="auto"
            >
              <span>{privateNote}</span>
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
                <MenuItem
                  onClick={() => {
                    setShowPrivateNoteModal(true);
                  }}
                >
                  <Icon icon="pencil" />
                  <span>
                    {privateNote ? 'Edit private note' : 'Add private note'}
                  </span>
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
                          const newRelationship = await currentMasto.v1.accounts
                            .$select(currentInfo?.id || id)
                            .unmute();
                          console.log('unmuting', newRelationship);
                          setRelationship(newRelationship);
                          setRelationshipUIState('default');
                          showToast(`Unmuted @${username}`);
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
                                  await currentMasto.v1.accounts
                                    .$select(currentInfo?.id || id)
                                    .mute({
                                      duration,
                                    });
                                console.log('muting', newRelationship);
                                setRelationship(newRelationship);
                                setRelationshipUIState('default');
                                showToast(
                                  `Muted @${username} for ${MUTE_DURATIONS_LABELS[duration]}`,
                                );
                                states.reloadGenericAccounts.id = 'mute';
                                states.reloadGenericAccounts.counter++;
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
                          const newRelationship = await currentMasto.v1.accounts
                            .$select(currentInfo?.id || id)
                            .unblock();
                          console.log('unblocking', newRelationship);
                          setRelationship(newRelationship);
                          setRelationshipUIState('default');
                          showToast(`Unblocked @${username}`);
                        } else {
                          const newRelationship = await currentMasto.v1.accounts
                            .$select(currentInfo?.id || id)
                            .block();
                          console.log('blocking', newRelationship);
                          setRelationship(newRelationship);
                          setRelationshipUIState('default');
                          showToast(`Blocked @${username}`);
                        }
                        states.reloadGenericAccounts.id = 'block';
                        states.reloadGenericAccounts.counter++;
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
          </Menu2>
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
                      newRelationship = await currentMasto.v1.accounts
                        .$select(accountID.current)
                        .unfollow();
                      // }
                    } else {
                      newRelationship = await currentMasto.v1.accounts
                        .$select(accountID.current)
                        .follow();
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
      </div>
      {!!showTranslatedBio && (
        <Modal
          class="light"
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
          class="light"
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
          class="light"
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
        lists.sort((a, b) => a.title.localeCompare(b.title));
        const listsContainingAccount = await masto.v1.accounts
          .$select(accountID)
          .lists.list();
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
                            await masto.v1.lists
                              .$select(list.id)
                              .accounts.remove({
                                accountIds: [accountID],
                              });
                          } else {
                            await masto.v1.lists
                              .$select(list.id)
                              .accounts.create({
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

function PrivateNoteSheet({
  account,
  note: initialNote,
  onRelationshipChange = () => {},
  onClose = () => {},
}) {
  const { masto } = api();
  const [uiState, setUIState] = useState('default');
  const textareaRef = useRef(null);

  useEffect(() => {
    let timer;
    if (textareaRef.current && !initialNote) {
      timer = setTimeout(() => {
        textareaRef.current.focus?.();
      }, 100);
    }
    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <div class="sheet" id="private-note-container">
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" />
        </button>
      )}
      <header>
        <b>Private note about @{account?.username || account?.acct}</b>
      </header>
      <main>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const note = formData.get('note');
            if (note?.trim() !== initialNote?.trim()) {
              setUIState('loading');
              (async () => {
                try {
                  const newRelationship = await masto.v1.accounts
                    .$select(account?.id)
                    .note.create({
                      comment: note,
                    });
                  console.log('updated relationship', newRelationship);
                  setUIState('default');
                  onRelationshipChange(newRelationship);
                  onClose();
                } catch (e) {
                  console.error(e);
                  setUIState('error');
                  alert(e?.message || 'Unable to update private note.');
                }
              })();
            }
          }}
        >
          <textarea
            ref={textareaRef}
            name="note"
            disabled={uiState === 'loading'}
          >
            {initialNote}
          </textarea>
          <footer>
            <button
              type="button"
              class="light"
              disabled={uiState === 'loading'}
              onClick={() => {
                onClose?.();
              }}
            >
              Cancel
            </button>
            <span>
              <Loader abrupt hidden={uiState !== 'loading'} />
              <button disabled={uiState === 'loading'} type="submit">
                Save &amp; close
              </button>
            </span>
          </footer>
        </form>
      </main>
    </div>
  );
}

export default AccountInfo;
