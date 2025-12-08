import './account-info.css';

import { msg, plural } from '@lingui/core/macro';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { MenuDivider, MenuItem } from '@szhsin/react-menu';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';

import { api } from '../utils/api';
import enhanceContent from '../utils/enhance-content';
import getDomain from '../utils/get-domain';
import handleContentLinks from '../utils/handle-content-links';
import niceDateTime from '../utils/nice-date-time';
import pmem from '../utils/pmem';
import { supportsNativeQuote } from '../utils/quote-utils';
import shortenNumber from '../utils/shorten-number';
import showToast from '../utils/show-toast';
import states, { hideAllModals } from '../utils/states';
import {
  getAccounts,
  getCurrentAccountID,
  saveAccounts,
} from '../utils/store-utils';
import supports from '../utils/supports';

import AccountBlock from './account-block';
import AccountHandleInfo from './account-handle-info';
import Avatar from './avatar';
import EditProfileSheet from './edit-profile-sheet';
import EmojiText from './emoji-text';
import Endorsements from './endorsements';
import Icon from './icon';
import Link from './link';
import Menu2 from './menu2';
import Modal from './modal';
import RelatedActions from './related-actions';

const LIMIT = 80;

const ACCOUNT_INFO_MAX_AGE = 1000 * 60 * 10; // 10 mins

function fetchFamiliarFollowers(currentID, masto) {
  return masto.v1.accounts.familiarFollowers.fetch({
    id: [currentID],
  });
}
const memFetchFamiliarFollowers = pmem(fetchFamiliarFollowers, {
  expires: ACCOUNT_INFO_MAX_AGE,
});

async function fetchPostingStats(accountID, masto) {
  const fetchStatuses = masto.v1.accounts
    .$select(accountID)
    .statuses.list({
      limit: 20,
    })
    .values()
    .next();

  const { value: statuses } = await fetchStatuses;
  console.log('fetched statuses', statuses);
  const stats = {
    total: statuses.length,
    originals: 0,
    replies: 0,
    boosts: 0,
    quotes: 0,
  };
  // Categories statuses by type
  // - Original posts (not replies to others)
  // - Threads (self-replies + 1st original post)
  // - Boosts (reblogs)
  // - Replies (not-self replies)
  // - Quotes
  statuses.forEach((status) => {
    if (status.reblog) {
      stats.boosts++;
    } else if (
      !!status.inReplyToId &&
      status.inReplyToAccountId !== status.account.id // Not self-reply
    ) {
      stats.replies++;
    } else if (
      supportsNativeQuote() &&
      (status.quote?.id || status.quote?.quotedStatus?.id)
    ) {
      stats.quotes++;
    } else {
      stats.originals++;
    }
  });

  // Count days since last post
  if (statuses.length) {
    stats.daysSinceLastPost = Math.ceil(
      (Date.now() - Date.parse(statuses[statuses.length - 1].createdAt)) /
        86400000,
    );
  }

  console.log('posting stats', stats);
  return stats;
}
const memFetchPostingStats = pmem(fetchPostingStats, {
  expires: ACCOUNT_INFO_MAX_AGE,
});

const isValidUrl = (string) => {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
};
export const handleScannerClick = () => {
  states.showQrScannerModal = {
    checkValidity: isValidUrl,
    actionableText: msg`View profile`,
    onClose: ({ text } = {}) => {
      if (text) {
        hideAllModals();
        location.hash = `/${text}`;
      }
    },
  };
};

function AccountInfo({
  account,
  fetchAccount = () => {},
  standalone,
  instance,
  authenticated,
  showEndorsements = false,
}) {
  const { i18n, t } = useLingui();
  const { masto, authenticated: currentAuthenticated } = api({
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
      const accounts = getAccounts();
      let updated = false;
      accounts.forEach((account) => {
        if (account.info.id === info.id && account.instanceURL === instance) {
          account.info = info;
          updated = true;
        }
      });
      if (updated) {
        console.log('Updated account info', info);
        saveAccounts(accounts);
      }
    }
  }, [isSelf, info, instance]);

  const accountInstance = getDomain(url);

  const [headerCornerColors, setHeaderCornerColors] = useState([]);

  const followersIterator = useRef();
  const familiarFollowersCache = useRef([]);
  async function fetchFollowers(firstLoad) {
    if (firstLoad || !followersIterator.current) {
      followersIterator.current = masto.v1.accounts
        .$select(id)
        .followers.list({
          limit: LIMIT,
        })
        .values();
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
      followingIterator.current = masto.v1.accounts
        .$select(id)
        .following.list({
          limit: LIMIT,
        })
        .values();
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

  const isStringURL = isString && account && /^https?:\/\//.test(account);

  const [showEditProfile, setShowEditProfile] = useState(false);

  const [renderEndorsements, setRenderEndorsements] = useState(false);

  return (
    <>
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
                {isStringURL ? (
                  <a href={account} target="_blank" rel="noopener">
                    {account}
                  </a>
                ) : (
                  <code class="insignificant">{account}</code>
                )}
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
                    <span>██</span> ██████
                  </div>
                  <div>
                    <span>██</span> ██████
                  </div>
                  <div>
                    <span>██</span> █████
                  </div>
                </div>
              </div>
              <div class="actions">
                <span />
                <span class="buttons">
                  <button type="button" class="plain4" disabled>
                    <Icon icon="more2" size="l" />
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
                      <b>{displayName}</b> has indicated that their new account
                      is now:
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
                    <MenuItem
                      onClick={() => {
                        states.showQrCodeModal = {
                          text: url,
                          arena: avatarStatic,
                          backgroundMask: headerStatic,
                          caption: acct.includes('@')
                            ? acct
                            : `${acct}@${instance}`,
                          onScannerClick: handleScannerClick,
                        };
                      }}
                    >
                      <Icon icon="qrcode" />
                      <span>
                        <Trans>QR code</Trans>
                      </span>
                    </MenuItem>
                    <MenuItem href={url} target="_blank">
                      <Icon icon="external" />
                      <span>
                        <Trans>Go to original profile page</Trans>
                      </span>
                    </MenuItem>
                    <MenuDivider />
                    <MenuItem
                      onClick={() => {
                        states.showMediaModal = {
                          mediaAttachments: [
                            {
                              type: 'image',
                              url: avatarStatic,
                            },
                          ],
                        };
                      }}
                    >
                      <Icon icon="user" />
                      <span>
                        <Trans>View profile image</Trans>
                      </span>
                    </MenuItem>
                    {!!headerStatic && !headerIsAvatar && (
                      <MenuItem
                        onClick={() => {
                          states.showMediaModal = {
                            mediaAttachments: [
                              {
                                type: 'image',
                                url: headerStatic,
                              },
                            ],
                          };
                        }}
                      >
                        <Icon icon="media" />
                        <span>
                          <Trans>View profile header</Trans>
                        </span>
                      </MenuItem>
                    )}
                    {currentAuthenticated &&
                      isSelf &&
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
                {/* {roles?.map((role) => (
                  <span class="tag">
                    {role.name}
                    {!!accountInstance && (
                      <>
                        {' '}
                        <span class="more-insignificant">
                          {accountInstance}
                        </span>
                      </>
                    )}
                  </span>
                ))} */}
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
                      <Plural
                        value={followersCount}
                        one={
                          <Trans>
                            <span title={followersCount}>
                              {shortenNumber(followersCount)}
                            </span>{' '}
                            Follower
                          </Trans>
                        }
                        other={
                          <Trans>
                            <span title={followersCount}>
                              {shortenNumber(followersCount)}
                            </span>{' '}
                            Followers
                          </Trans>
                        }
                      />
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
                            excludeRelationshipAttrs: isSelf
                              ? ['following']
                              : [],
                            blankCopy: hideCollections
                              ? t`This user has chosen to not make this information available.`
                              : undefined,
                          };
                        }, 0);
                      }}
                    >
                      <Plural
                        value={followingCount}
                        other={
                          <Trans>
                            <span title={followingCount}>
                              {shortenNumber(followingCount)}
                            </span>{' '}
                            Following
                          </Trans>
                        }
                      />
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
                      <Plural
                        value={statusesCount}
                        one={
                          <Trans>
                            <span title={statusesCount}>
                              {shortenNumber(statusesCount)}
                            </span>{' '}
                            Post
                          </Trans>
                        }
                        other={
                          <Trans>
                            <span title={statusesCount}>
                              {shortenNumber(statusesCount)}
                            </span>{' '}
                            Posts
                          </Trans>
                        }
                      />
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
                    onClick={
                      import.meta.env.DEV && standalone
                        ? () => {
                            // Debug: undo back
                            setPostingStats(null);
                          }
                        : undefined
                    }
                  >
                    <div class="shazam-container">
                      <div class="shazam-container-inner">
                        {hasPostingStats ? (
                          <div
                            class="posting-stats"
                            title={
                              supportsNativeQuote()
                                ? t`${(
                                    postingStats.originals / postingStats.total
                                  ).toLocaleString(i18n.locale || undefined, {
                                    style: 'percent',
                                  })} original posts, ${(
                                    postingStats.replies / postingStats.total
                                  ).toLocaleString(i18n.locale || undefined, {
                                    style: 'percent',
                                  })} replies, ${(
                                    postingStats.quotes / postingStats.total
                                  ).toLocaleString(i18n.locale || undefined, {
                                    style: 'percent',
                                  })} quotes, ${(
                                    postingStats.boosts / postingStats.total
                                  ).toLocaleString(i18n.locale || undefined, {
                                    style: 'percent',
                                  })} boosts`
                                : t`${(
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
                                  })} boosts`
                            }
                          >
                            <div>
                              {postingStats.daysSinceLastPost < 365
                                ? plural(postingStats.total, {
                                    one: plural(
                                      postingStats.daysSinceLastPost,
                                      {
                                        one: `Last 1 post in the past 1 day`,
                                        other: `Last 1 post in the past ${postingStats.daysSinceLastPost} days`,
                                      },
                                    ),
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
                            <div class="posting-stats-bar">
                              {postingStats.originals > 0 && (
                                <div
                                  class="posting-stats-bar-section posting-stats-bar-originals"
                                  style={{
                                    '--percentage': `${
                                      (postingStats.originals /
                                        postingStats.total) *
                                      100
                                    }%`,
                                  }}
                                />
                              )}
                              {postingStats.replies > 0 && (
                                <div
                                  class="posting-stats-bar-section posting-stats-bar-replies"
                                  style={{
                                    '--percentage': `${
                                      (postingStats.replies /
                                        postingStats.total) *
                                      100
                                    }%`,
                                  }}
                                />
                              )}
                              {postingStats.quotes > 0 && (
                                <div
                                  class="posting-stats-bar-section posting-stats-bar-quotes"
                                  style={{
                                    '--percentage': `${
                                      (postingStats.quotes /
                                        postingStats.total) *
                                      100
                                    }%`,
                                  }}
                                />
                              )}
                              {postingStats.boosts > 0 && (
                                <div
                                  class="posting-stats-bar-section posting-stats-bar-boosts"
                                  style={{
                                    '--percentage': `${
                                      (postingStats.boosts /
                                        postingStats.total) *
                                      100
                                    }%`,
                                  }}
                                />
                              )}
                            </div>
                            <div class="posting-stats-legends">
                              <span class="ib">
                                <span class="posting-stats-legend-item posting-stats-bar-originals" />{' '}
                                <Trans>Original</Trans>
                              </span>{' '}
                              <span class="ib">
                                <span class="posting-stats-legend-item posting-stats-bar-replies" />{' '}
                                <Trans>Replies</Trans>
                              </span>{' '}
                              {supportsNativeQuote() && (
                                <span class="ib">
                                  <span class="posting-stats-legend-item posting-stats-bar-quotes" />{' '}
                                  <Trans>Quotes</Trans>
                                </span>
                              )}
                              <span class="ib">
                                <span class="posting-stats-legend-item posting-stats-bar-boosts" />{' '}
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
                            class={`posting-stats-icon ${
                              postingStatsUIState === 'loading' ? 'loading' : ''
                            }`}
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
                  setShowEditProfile={setShowEditProfile}
                  showEndorsements={showEndorsements}
                  renderEndorsements={renderEndorsements}
                  setRenderEndorsements={setRenderEndorsements}
                />
              </footer>
              <Endorsements
                accountID={id}
                info={info}
                open={renderEndorsements}
                onlyOpenIfHasEndorsements={
                  renderEndorsements === 'onlyOpenIfHasEndorsements'
                }
              />
            </>
          )
        )}
      </div>
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

const FAMILIAR_FOLLOWERS_LIMIT = 3;

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

export default AccountInfo;
