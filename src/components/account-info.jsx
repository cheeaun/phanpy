import './account-info.css';

import { msg, plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { MenuDivider, MenuItem } from '@szhsin/react-menu';
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'preact/hooks';
import punycode from 'punycode/';

import { api } from '../utils/api';
import enhanceContent from '../utils/enhance-content';
import getHTMLText from '../utils/getHTMLText';
import handleContentLinks from '../utils/handle-content-links';
import i18nDuration from '../utils/i18n-duration';
import { getLists } from '../utils/lists';
import niceDateTime from '../utils/nice-date-time';
import pmem from '../utils/pmem';
import shortenNumber from '../utils/shorten-number';
import showCompose from '../utils/show-compose';
import showToast from '../utils/show-toast';
import states from '../utils/states';
import store from '../utils/store';
import { getCurrentAccountID, updateAccount } from '../utils/store-utils';
import supports from '../utils/supports';

import AccountBlock from './account-block';
import Avatar from './avatar';
import EmojiText from './emoji-text';
import Icon from './icon';
import Link from './link';
import ListAddEdit from './list-add-edit';
import Loader from './loader';
import MenuConfirm from './menu-confirm';
import MenuLink from './menu-link';
import Menu2 from './menu2';
import Modal from './modal';
import SubMenu2 from './submenu2';
import TranslationBlock from './translation-block';

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
  const { i18n, t } = useLingui();
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
    hideCollections,
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

  const isSelf = useMemo(() => id === getCurrentAccountID(), [id]);

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
    const domain = punycode.toUnicode(URL.parse(url).hostname);
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
      let familiarFollowers = [];
      try {
        familiarFollowers = await masto.v1.accounts.familiarFollowers.fetch({
          id: [id],
        });
      } catch (e) {}
      familiarFollowersCache.current = familiarFollowers?.[0]?.accounts || [];
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

  const onProfileUpdate = useCallback(
    (newAccount) => {
      if (newAccount.id === id) {
        console.log('Updated account info', newAccount);
        setInfo(newAccount);
        states.accounts[`${newAccount.id}@${instance}`] = newAccount;
      }
    },
    [id, instance],
  );

  return (
    <div
      tabIndex="-1"
      class={`account-container ${uiState === 'loading' ? 'skeleton' : ''}`}
      style={{
        '--header-color-1': headerCornerColors[0],
        '--header-color-2': headerCornerColors[1],
        '--header-color-3': headerCornerColors[2],
        '--header-color-4': headerCornerColors[3],
      }}
    >
      {uiState === 'error' && (
        <div class="ui-state">
          <p>
            <Trans>Unable to load account.</Trans>
          </p>
          {isString ? (
            <p>
              <code class="insignificant">{account}</code>
            </p>
          ) : (
            <p>
              <a href={url} target="_blank" rel="noopener">
                <Trans>Go to account page</Trans> <Icon icon="external" />
              </a>
            </p>
          )}
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
                  <span>██</span> <Trans>Followers</Trans>
                </div>
                <div>
                  <span>██</span> <Trans id="following.stats">Following</Trans>
                </div>
                <div>
                  <span>██</span> <Trans>Posts</Trans>
                </div>
              </div>
            </div>
            <div class="actions">
              <span />
              <span class="buttons">
                <button type="button" class="plain" disabled>
                  <Icon icon="more" size="l" alt={t`More`} />
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
                  <Trans>
                    <b>{displayName}</b> has indicated that their new account is
                    now:
                  </Trans>
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
                    const canvas = window.OffscreenCanvas
                      ? new OffscreenCanvas(1, 1)
                      : document.createElement('canvas');
                    const ctx = canvas.getContext('2d', {
                      willReadFrequently: true,
                    });
                    canvas.width = e.target.width;
                    canvas.height = e.target.height;
                    ctx.imageSmoothingEnabled = false;
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
              {standalone ? (
                <Menu2
                  shift={
                    window.matchMedia('(min-width: calc(40em))').matches
                      ? 114
                      : 64
                  }
                  menuButton={
                    <div>
                      <AccountBlock
                        account={info}
                        instance={instance}
                        avatarSize="xxxl"
                        onClick={() => {}}
                      />
                    </div>
                  }
                >
                  <div class="szh-menu__header">
                    <AccountHandleInfo acct={acct} instance={instance} />
                  </div>
                  <MenuItem
                    onClick={() => {
                      const handleWithInstance = acct.includes('@')
                        ? `@${acct}`
                        : `@${acct}@${instance}`;
                      try {
                        navigator.clipboard.writeText(handleWithInstance);
                        showToast(t`Handle copied`);
                      } catch (e) {
                        console.error(e);
                        showToast(t`Unable to copy handle`);
                      }
                    }}
                  >
                    <Icon icon="link" />
                    <span>
                      <Trans>Copy handle</Trans>
                    </span>
                  </MenuItem>
                  <MenuItem href={url} target="_blank">
                    <Icon icon="external" />
                    <span>
                      <Trans>Go to original profile page</Trans>
                    </span>
                  </MenuItem>
                  <MenuDivider />
                  <MenuLink href={info.avatar} target="_blank">
                    <Icon icon="user" />
                    <span>
                      <Trans>View profile image</Trans>
                    </span>
                  </MenuLink>
                  <MenuLink href={info.header} target="_blank">
                    <Icon icon="media" />
                    <span>
                      <Trans>View profile header</Trans>
                    </span>
                  </MenuLink>
                </Menu2>
              ) : (
                <AccountBlock
                  account={info}
                  instance={instance}
                  avatarSize="xxxl"
                  internal
                />
              )}
            </header>
            <div class="faux-header-bg" aria-hidden="true" />
            <main>
              {!!memorial && (
                <span class="tag">
                  <Trans>In Memoriam</Trans>
                </span>
              )}
              {!!bot && (
                <span class="tag">
                  <Icon icon="bot" /> <Trans>Automated</Trans>
                </span>
              )}
              {!!group && (
                <span class="tag">
                  <Icon icon="group" /> <Trans>Group</Trans>
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
                            <Icon
                              icon="check-circle"
                              size="s"
                              alt={t`Verified`}
                            />
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
                          id: 'followers',
                          heading: t`Followers`,
                          fetchAccounts: fetchFollowers,
                          instance,
                          excludeRelationshipAttrs: isSelf
                            ? ['followedBy']
                            : [],
                          blankCopy: hideCollections
                            ? t`This user has chosen to not make this information available.`
                            : undefined,
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
                    <Trans>Followers</Trans>
                  </LinkOrDiv>
                  <LinkOrDiv
                    class="insignificant"
                    tabIndex={0}
                    to={accountLink}
                    onClick={() => {
                      // states.showAccount = false;
                      setTimeout(() => {
                        states.showGenericAccounts = {
                          heading: t({
                            id: 'following.stats',
                            message: 'Following',
                          }),
                          fetchAccounts: fetchFollowing,
                          instance,
                          excludeRelationshipAttrs: isSelf ? ['following'] : [],
                          blankCopy: hideCollections
                            ? t`This user has chosen to not make this information available.`
                            : undefined,
                        };
                      }, 0);
                    }}
                  >
                    <span title={followingCount}>
                      {shortenNumber(followingCount)}
                    </span>{' '}
                    <Trans id="following.stats">Following</Trans>
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
                    <Trans>Posts</Trans>
                  </LinkOrDiv>
                  {!!createdAt && (
                    <div class="insignificant">
                      <Trans>
                        Joined{' '}
                        <time datetime={createdAt}>
                          {niceDateTime(createdAt, {
                            hideTime: true,
                          })}
                        </time>
                      </Trans>
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
                          title={t`${(
                            postingStats.originals / postingStats.total
                          ).toLocaleString(i18n.locale || undefined, {
                            style: 'percent',
                          })} original posts, ${(
                            postingStats.replies / postingStats.total
                          ).toLocaleString(i18n.locale || undefined, {
                            style: 'percent',
                          })} replies, ${(
                            postingStats.boosts / postingStats.total
                          ).toLocaleString(i18n.locale || undefined, {
                            style: 'percent',
                          })} boosts`}
                        >
                          <div>
                            {postingStats.daysSinceLastPost < 365
                              ? plural(postingStats.total, {
                                  one: plural(postingStats.daysSinceLastPost, {
                                    one: `Last 1 post in the past 1 day`,
                                    other: `Last 1 post in the past ${postingStats.daysSinceLastPost} days`,
                                  }),
                                  other: plural(
                                    postingStats.daysSinceLastPost,
                                    {
                                      one: `Last ${postingStats.total} posts in the past 1 day`,
                                      other: `Last ${postingStats.total} posts in the past ${postingStats.daysSinceLastPost} days`,
                                    },
                                  ),
                                })
                              : plural(postingStats.total, {
                                  one: 'Last 1 post in the past year(s)',
                                  other: `Last ${postingStats.total} posts in the past year(s)`,
                                })}
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
                              <Trans>Original</Trans>
                            </span>{' '}
                            <span class="ib">
                              <span class="posting-stats-legend-item posting-stats-legend-item-replies" />{' '}
                              <Trans>Replies</Trans>
                            </span>{' '}
                            <span class="ib">
                              <span class="posting-stats-legend-item posting-stats-legend-item-boosts" />{' '}
                              <Trans>Boosts</Trans>
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div class="posting-stats">
                          <Trans>Post stats unavailable.</Trans>
                        </div>
                      )}
                    </div>
                  </div>
                </LinkOrDiv>
              )}
              {!moved && (
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
                        <Trans>View post stats</Trans>{' '}
                        {/* <Loader
                        abrupt
                        hidden={postingStatsUIState !== 'loading'}
                      /> */}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </main>
            <footer>
              <RelatedActions
                info={info}
                instance={instance}
                standalone={standalone}
                authenticated={authenticated}
                onRelationshipChange={onRelationshipChange}
                onProfileUpdate={onProfileUpdate}
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
  standalone,
  authenticated,
  onRelationshipChange = () => {},
  onProfileUpdate = () => {},
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
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [lists, setLists] = useState([]);

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
              title={t`Private note`}
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
              <button type="button" class="plain" disabled={loading}>
                <Icon icon="more" size="l" alt={t`More`} />
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
            {currentAuthenticated && !isSelf && (
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
                    <Icon icon="pencil" />
                    <span>
                      {privateNote ? t`Edit private note` : t`Add private note`}
                    </span>
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
      {!!showEditProfile && (
        <Modal
          onClose={() => {
            setShowEditProfile(false);
          }}
        >
          <EditProfileSheet
            onClose={({ state, account } = {}) => {
              setShowEditProfile(false);
              if (state === 'success' && account) {
                onProfileUpdate(account);
              }
            }}
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
  const urlObj = URL.parse(url);
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

function TranslatedBioSheet({ note, fields, onClose }) {
  const { t } = useLingui();
  const fieldsText =
    fields
      ?.map(({ name, value }) => `${name}\n${getHTMLText(value)}`)
      .join('\n\n') || '';

  const text = getHTMLText(note) + (fieldsText ? `\n\n${fieldsText}` : '');

  return (
    <div class="sheet">
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" alt={t`Close`} />
        </button>
      )}
      <header>
        <h2>
          <Trans>Translated Bio</Trans>
        </h2>
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
  const { t } = useLingui();
  const { masto } = api();
  const [uiState, setUIState] = useState('default');
  const [lists, setLists] = useState([]);
  const [listsContainingAccount, setListsContainingAccount] = useState([]);
  const [reloadCount, reload] = useReducer((c) => c + 1, 0);

  useEffect(() => {
    setUIState('loading');
    (async () => {
      try {
        const lists = await getLists();
        setLists(lists);
        const listsContainingAccount = await masto.v1.accounts
          .$select(accountID)
          .lists.list();
        console.log({ lists, listsContainingAccount });
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
          <Icon icon="x" alt={t`Close`} />
        </button>
      )}
      <header>
        <h2>
          <Trans>Add/Remove from Lists</Trans>
        </h2>
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
                              ? t`Unable to remove from list.`
                              : t`Unable to add to list.`,
                          );
                        }
                      })();
                    }}
                  >
                    <Icon icon="check-circle" alt="☑️" />
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
          <p class="ui-state">
            <Trans>Unable to load lists.</Trans>
          </p>
        ) : (
          <p class="ui-state">
            <Trans>No lists.</Trans>
          </p>
        )}
        <button
          type="button"
          class="plain2"
          onClick={() => setShowListAddEditModal(true)}
          disabled={uiState !== 'default'}
        >
          <Icon icon="plus" size="l" />{' '}
          <span>
            <Trans>New list</Trans>
          </span>
        </button>
      </main>
      {showListAddEditModal && (
        <Modal
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
  const { t } = useLingui();
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
          <Icon icon="x" alt={t`Close`} />
        </button>
      )}
      <header>
        <b>
          <Trans>
            Private note about{' '}
            <span class="bidi-isolate">
              @{account?.username || account?.acct}
            </span>
          </Trans>
        </b>
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
                  alert(e?.message || t`Unable to update private note.`);
                }
              })();
            }
          }}
        >
          <textarea
            ref={textareaRef}
            name="note"
            disabled={uiState === 'loading'}
            dir="auto"
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
              <Trans>Cancel</Trans>
            </button>
            <span>
              <Loader abrupt hidden={uiState !== 'loading'} />
              <button disabled={uiState === 'loading'} type="submit">
                <Trans>Save &amp; close</Trans>
              </button>
            </span>
          </footer>
        </form>
      </main>
    </div>
  );
}

function EditProfileSheet({ onClose = () => {} }) {
  const { t } = useLingui();
  const { masto } = api();
  const [uiState, setUIState] = useState('loading');
  const [account, setAccount] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const acc = await masto.v1.accounts.verifyCredentials();
        setAccount(acc);
        setUIState('default');
      } catch (e) {
        console.error(e);
        setUIState('error');
      }
    })();
  }, []);

  console.log('EditProfileSheet', account);
  const { displayName, source } = account || {};
  const { note, fields } = source || {};
  const fieldsAttributesRef = useRef(null);

  return (
    <div class="sheet" id="edit-profile-container">
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" alt={t`Close`} />
        </button>
      )}
      <header>
        <b>
          <Trans>Edit profile</Trans>
        </b>
      </header>
      <main>
        {uiState === 'loading' ? (
          <p class="ui-state">
            <Loader abrupt />
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              const displayName = formData.get('display_name');
              const note = formData.get('note');
              const fieldsAttributesFields =
                fieldsAttributesRef.current.querySelectorAll(
                  'input[name^="fields_attributes"]',
                );
              const fieldsAttributes = [];
              fieldsAttributesFields.forEach((field) => {
                const name = field.name;
                const [_, index, key] =
                  name.match(/fields_attributes\[(\d+)\]\[(.+)\]/) || [];
                const value = field.value ? field.value.trim() : '';
                if (index && key && value) {
                  if (!fieldsAttributes[index]) fieldsAttributes[index] = {};
                  fieldsAttributes[index][key] = value;
                }
              });
              // Fill in the blanks
              fieldsAttributes.forEach((field) => {
                if (field.name && !field.value) {
                  field.value = '';
                }
              });

              (async () => {
                try {
                  const newAccount = await masto.v1.accounts.updateCredentials({
                    displayName,
                    note,
                    fieldsAttributes,
                  });
                  console.log('updated account', newAccount);
                  onClose?.({
                    state: 'success',
                    account: newAccount,
                  });
                } catch (e) {
                  console.error(e);
                  alert(e?.message || t`Unable to update profile.`);
                }
              })();
            }}
          >
            <p>
              <label>
                <Trans>Name</Trans>{' '}
                <input
                  type="text"
                  name="display_name"
                  defaultValue={displayName}
                  maxLength={30}
                  disabled={uiState === 'loading'}
                  dir="auto"
                />
              </label>
            </p>
            <p>
              <label>
                <Trans>Bio</Trans>
                <textarea
                  defaultValue={note}
                  name="note"
                  maxLength={500}
                  rows="5"
                  disabled={uiState === 'loading'}
                  dir="auto"
                />
              </label>
            </p>
            {/* Table for fields; name and values are in fields, min 4 rows */}
            <p>
              <Trans>Extra fields</Trans>
            </p>
            <table ref={fieldsAttributesRef}>
              <thead>
                <tr>
                  <th>
                    <Trans>Label</Trans>
                  </th>
                  <th>
                    <Trans>Content</Trans>
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: Math.max(4, fields.length) }).map(
                  (_, i) => {
                    const { name = '', value = '' } = fields[i] || {};
                    return (
                      <FieldsAttributesRow
                        key={i}
                        name={name}
                        value={value}
                        index={i}
                        disabled={uiState === 'loading'}
                      />
                    );
                  },
                )}
              </tbody>
            </table>
            <footer>
              <button
                type="button"
                class="light"
                disabled={uiState === 'loading'}
                onClick={() => {
                  onClose?.();
                }}
              >
                <Trans>Cancel</Trans>
              </button>
              <button type="submit" disabled={uiState === 'loading'}>
                <Trans>Save</Trans>
              </button>
            </footer>
          </form>
        )}
      </main>
    </div>
  );
}

function FieldsAttributesRow({ name, value, disabled, index: i }) {
  const [hasValue, setHasValue] = useState(!!value);
  return (
    <tr>
      <td>
        <input
          type="text"
          name={`fields_attributes[${i}][name]`}
          defaultValue={name}
          disabled={disabled}
          maxLength={255}
          required={hasValue}
          dir="auto"
        />
      </td>
      <td>
        <input
          type="text"
          name={`fields_attributes[${i}][value]`}
          defaultValue={value}
          disabled={disabled}
          maxLength={255}
          onChange={(e) => setHasValue(!!e.currentTarget.value)}
          dir="auto"
        />
      </td>
    </tr>
  );
}

function AccountHandleInfo({ acct, instance }) {
  // acct = username or username@server
  let [username, server] = acct.split('@');
  if (!server) server = instance;
  const encodedAcct = punycode.toASCII(acct);
  return (
    <div class="handle-info">
      <span class="handle-handle" title={encodedAcct}>
        <b class="handle-username">{username}</b>
        <span class="handle-at">@</span>
        <b class="handle-server">{server}</b>
      </span>
      <div class="handle-legend">
        <span class="ib">
          <span class="handle-legend-icon username" /> <Trans>username</Trans>
        </span>{' '}
        <span class="ib">
          <span class="handle-legend-icon server" />{' '}
          <Trans>server domain name</Trans>
        </span>
      </div>
    </div>
  );
}

export default AccountInfo;
