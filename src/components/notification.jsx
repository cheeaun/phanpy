import { msg, t } from '@lingui/core/macro';
import { Plural, Select, Trans, useLingui } from '@lingui/react/macro';
import { Fragment } from 'preact';
import { memo } from 'preact/compat';

import { api } from '../utils/api';
import { isFiltered } from '../utils/filters';
import shortenNumber from '../utils/shorten-number';
import states, { statusKey } from '../utils/states';
import { getCurrentAccountID } from '../utils/store-utils';
import useTruncated from '../utils/useTruncated';

import Avatar from './avatar';
import CustomEmoji from './custom-emoji';
import FollowRequestButtons from './follow-request-buttons';
import Icon from './icon';
import Link from './link';
import NameText from './name-text';
import Status from './status';

const NOTIFICATION_ICONS = {
  mention: 'comment',
  status: 'notification',
  reblog: 'rocket',
  follow: 'follow',
  follow_request: 'follow-add',
  favourite: 'heart',
  poll: 'poll',
  update: 'pencil',
  'admin.signup': 'account-edit',
  'admin.report': 'account-warning',
  severed_relationships: 'heart-break',
  moderation_warning: 'alert',
  emoji_reaction: 'emoji2',
  'pleroma:emoji_reaction': 'emoji2',
  annual_report: 'celebrate',
};

/*
Notification types
==================
mention = Someone mentioned you in their status
status = Someone you enabled notifications for has posted a status
reblog = Someone boosted one of your statuses
follow = Someone followed you
follow_request = Someone requested to follow you
favourite = Someone favourited one of your statuses
poll = A poll you have voted in or created has ended
update = A status you interacted with has been edited
admin.sign_up = Someone signed up (optionally sent to admins)
admin.report = A new report has been filed
severed_relationships = Severed relationships
moderation_warning = Moderation warning
*/

function emojiText({ account, emoji, emoji_url }) {
  let url;
  let staticUrl;
  if (typeof emoji_url === 'string') {
    url = emoji_url;
  } else {
    url = emoji_url?.url;
    staticUrl = emoji_url?.staticUrl;
  }
  const emojiObject = url ? (
    <CustomEmoji url={url} staticUrl={staticUrl} alt={emoji} />
  ) : (
    emoji
  );
  return (
    <Trans>
      {account} reacted to your post with {emojiObject}
    </Trans>
  );
}

const contentText = {
  status: ({ account }) => <Trans>{account} published a post.</Trans>,
  reblog: ({
    count,
    account,
    postsCount,
    postType,
    components: { Subject },
  }) => (
    <Plural
      value={count}
      _1={
        <Plural
          value={postsCount}
          _1={
            <Select
              value={postType}
              _reply={<Trans>{account} boosted your reply.</Trans>}
              other={<Trans>{account} boosted your post.</Trans>}
            />
          }
          other={
            <Trans>
              {account} boosted {postsCount} of your posts.
            </Trans>
          }
        />
      }
      other={
        <Select
          value={postType}
          _reply={
            <Trans>
              <Subject clickable={count > 1}>
                <span title={count}>{shortenNumber(count)}</span> people
              </Subject>{' '}
              boosted your reply.
            </Trans>
          }
          other={
            <Trans>
              <Subject clickable={count > 1}>
                <span title={count}>{shortenNumber(count)}</span> people
              </Subject>{' '}
              boosted your post.
            </Trans>
          }
        />
      }
    />
  ),
  follow: ({ account, count, components: { Subject } }) => (
    <Plural
      value={count}
      _1={<Trans>{account} followed you.</Trans>}
      other={
        <Trans>
          <Subject clickable={count > 1}>
            <span title={count}>{shortenNumber(count)}</span> people
          </Subject>{' '}
          followed you.
        </Trans>
      }
    />
  ),
  follow_request: ({ account }) => (
    <Trans>{account} requested to follow you.</Trans>
  ),
  favourite: ({
    account,
    count,
    postsCount,
    postType,
    components: { Subject },
  }) => (
    <Plural
      value={count}
      _1={
        <Plural
          value={postsCount}
          _1={
            <Select
              value={postType}
              _reply={<Trans>{account} liked your reply.</Trans>}
              other={<Trans>{account} liked your post.</Trans>}
            />
          }
          other={
            <Trans>
              {account} liked {postsCount} of your posts.
            </Trans>
          }
        />
      }
      other={
        <Select
          value={postType}
          _reply={
            <Trans>
              <Subject clickable={count > 1}>
                <span title={count}>{shortenNumber(count)}</span> people
              </Subject>{' '}
              liked your reply.
            </Trans>
          }
          other={
            <Trans>
              <Subject clickable={count > 1}>
                <span title={count}>{shortenNumber(count)}</span> people
              </Subject>{' '}
              liked your post.
            </Trans>
          }
        />
      }
    />
  ),
  poll: () => t`A poll you have voted in or created has ended.`,
  'poll-self': () => t`A poll you have created has ended.`,
  'poll-voted': () => t`A poll you have voted in has ended.`,
  update: () => t`A post you interacted with has been edited.`,
  'favourite+reblog': ({
    count,
    account,
    postsCount,
    postType,
    components: { Subject },
  }) => (
    <Plural
      value={count}
      _1={
        <Plural
          value={postsCount}
          _1={
            <Select
              value={postType}
              _reply={<Trans>{account} boosted & liked your reply.</Trans>}
              other={<Trans>{account} boosted & liked your post.</Trans>}
            />
          }
          other={
            <Trans>
              {account} boosted & liked {postsCount} of your posts.
            </Trans>
          }
        />
      }
      other={
        <Select
          value={postType}
          _reply={
            <Trans>
              <Subject clickable={count > 1}>
                <span title={count}>{shortenNumber(count)}</span> people
              </Subject>{' '}
              boosted & liked your reply.
            </Trans>
          }
          other={
            <Trans>
              <Subject clickable={count > 1}>
                <span title={count}>{shortenNumber(count)}</span> people
              </Subject>{' '}
              boosted & liked your post.
            </Trans>
          }
        />
      }
    />
  ),
  'admin.sign_up': ({ account }) => <Trans>{account} signed up.</Trans>,
  'admin.report': ({ account, targetAccount }) => (
    <Trans>
      {account} reported {targetAccount}
    </Trans>
  ),
  severed_relationships: ({ name }) => (
    <Trans>
      Lost connections with <i>{name}</i>.
    </Trans>
  ),
  moderation_warning: () => (
    <b>
      <Trans>Moderation warning</Trans>
    </b>
  ),
  emoji_reaction: emojiText,
  'pleroma:emoji_reaction': emojiText,
  annual_report: ({ year }) => <Trans>Your {year} #Wrapstodon is here!</Trans>,
};

// account_suspension, domain_block, user_domain_block
const SEVERED_RELATIONSHIPS_TEXT = {
  account_suspension: ({ from, targetName }) => (
    <Trans>
      An admin from <i>{from}</i> has suspended <i>{targetName}</i>, which means
      you can no longer receive updates from them or interact with them.
    </Trans>
  ),
  domain_block: ({ from, targetName, followersCount, followingCount }) => (
    <Trans>
      An admin from <i>{from}</i> has blocked <i>{targetName}</i>. Affected
      followers: {followersCount}, followings: {followingCount}.
    </Trans>
  ),
  user_domain_block: ({ targetName, followersCount, followingCount }) => (
    <Trans>
      You have blocked <i>{targetName}</i>. Removed followers: {followersCount},
      followings: {followingCount}.
    </Trans>
  ),
};

const MODERATION_WARNING_TEXT = {
  none: msg`Your account has received a moderation warning.`,
  disable: msg`Your account has been disabled.`,
  mark_statuses_as_sensitive: msg`Some of your posts have been marked as sensitive.`,
  delete_statuses: msg`Some of your posts have been deleted.`,
  sensitive: msg`Your posts will be marked as sensitive from now on.`,
  silence: msg`Your account has been limited.`,
  suspend: msg`Your account has been suspended.`,
};

const AVATARS_LIMIT = 30;

function Notification({
  notification,
  instance,
  isStatic,
  disableContextMenu,
}) {
  const { _ } = useLingui();
  const { masto } = api();
  const {
    id,
    status,
    account,
    report,
    event,
    moderation_warning,
    annualReport,
    // Client-side grouped notification
    _ids,
    _accounts,
    _statuses,
    _groupKeys,
    // Server-side grouped notification
    sampleAccounts,
    notificationsCount,
    groupKey,
  } = notification;
  let { type } = notification;

  if (type === 'mention' && !status) {
    // Could be deleted
    return null;
  }

  // status = Attached when type of the notification is favourite, reblog, status, mention, poll, or update
  const actualStatus = status?.reblog || status;
  const actualStatusID = actualStatus?.id;

  const currentAccount = getCurrentAccountID();
  const isSelf = currentAccount === account?.id;
  const isVoted = status?.poll?.voted;
  const isReplyToOthers =
    !!status?.inReplyToAccountId &&
    status?.inReplyToAccountId !== currentAccount &&
    status?.account?.id === currentAccount;

  let favsCount = 0;
  let reblogsCount = 0;
  if (type === 'favourite+reblog') {
    if (_accounts) {
      for (const account of _accounts) {
        if (account._types?.includes('favourite')) {
          favsCount++;
        }
        if (account._types?.includes('reblog')) {
          reblogsCount++;
        }
      }
    }
    if (!reblogsCount && favsCount) type = 'favourite';
    if (!favsCount && reblogsCount) type = 'reblog';
  }

  let text;
  if (type === 'poll') {
    text = contentText[isSelf ? 'poll-self' : isVoted ? 'poll-voted' : 'poll'];
  } else if (contentText[type]) {
    text = contentText[type];
  } else {
    // Anticipate unhandled notification types, possibly from Mastodon forks or non-Mastodon instances
    // This surfaces the error to the user, hoping that users will report it
    text = t`[Unknown notification type: ${type}]`;
  }

  const Subject = ({ clickable, ...props }) =>
    clickable ? (
      <b tabIndex="0" onClick={handleOpenGenericAccounts} {...props} />
    ) : (
      <b {...props} />
    );

  if (typeof text === 'function') {
    const count =
      _accounts?.length || sampleAccounts?.length || (account ? 1 : 0);
    const postsCount = _statuses?.length || (status ? 1 : 0);
    if (type === 'admin.report') {
      const targetAccount = report?.targetAccount;
      if (targetAccount) {
        text = text({
          account: <NameText account={account} showAvatar />,
          targetAccount: <NameText account={targetAccount} showAvatar />,
        });
      }
    } else if (type === 'severed_relationships') {
      const targetName = event?.targetName;
      if (targetName) {
        text = text({ name: targetName });
      }
    } else if (
      (type === 'emoji_reaction' || type === 'pleroma:emoji_reaction') &&
      notification.emoji
    ) {
      const emojiURL =
        notification.emoji_url || // This is string
        status?.emojis?.find?.(
          (emoji) =>
            emoji?.shortcode ===
            notification.emoji.replace(/^:/, '').replace(/:$/, ''),
        ); // Emoji object instead of string
      text = text({
        account: <NameText account={account} showAvatar />,
        emoji: notification.emoji,
        emojiURL,
      });
    } else if (type === 'annual_report') {
      text = text({
        ...notification.annualReport,
      });
    } else {
      text = text({
        account: account ? (
          <NameText account={account} showAvatar />
        ) : (
          sampleAccounts?.[0] && (
            <NameText account={sampleAccounts[0]} showAvatar />
          )
        ),
        count,
        postsCount,
        postType: isReplyToOthers ? 'reply' : 'post',
        components: { Subject },
      });
    }
  }

  const formattedCreatedAt =
    notification.createdAt && new Date(notification.createdAt).toLocaleString();

  const genericAccountsHeading =
    {
      'favourite+reblog': t`Boosted/Liked by…`,
      favourite: t`Liked by…`,
      reblog: t`Boosted by…`,
      follow: t`Followed by…`,
    }[type] || t`Accounts`;
  const handleOpenGenericAccounts = () => {
    states.showGenericAccounts = {
      heading: genericAccountsHeading,
      accounts: _accounts,
      showReactions: type === 'favourite+reblog',
      excludeRelationshipAttrs: type === 'follow' ? ['followedBy'] : [],
      postID: statusKey(actualStatusID, instance),
    };
  };

  console.debug('RENDER Notification', notification.id);

  const diffCount =
    notificationsCount > 0 && notificationsCount > sampleAccounts?.length;
  const expandAccounts = diffCount ? 'remote' : 'local';

  // If there's a status and filter action is 'hide', then the notification is hidden
  if (!!status?.filtered) {
    const isOwnPost = status?.account?.id === currentAccount;
    const filterInfo = isFiltered(status.filtered, 'notifications');
    if (!isSelf && !isOwnPost && filterInfo?.action === 'hide') {
      return null;
    }
  }

  return (
    <div
      class={`notification notification-${type}`}
      data-notification-id={_ids || id}
      data-group-key={_groupKeys?.join(' ') || groupKey}
      tabIndex="0"
    >
      <div
        class={`notification-type notification-${type}`}
        title={formattedCreatedAt}
      >
        {type === 'favourite+reblog' ? (
          <>
            <Icon icon="rocket" size="xl" alt={type} class="reblog-icon" />
            <Icon icon="heart" size="xl" alt={type} class="favourite-icon" />
          </>
        ) : (
          <Icon
            icon={NOTIFICATION_ICONS[type] || 'notification'}
            size="xl"
            alt={type}
          />
        )}
      </div>
      <div class="notification-content">
        {type !== 'mention' && (
          <>
            <p>{text}</p>
            {type === 'follow_request' && (
              <FollowRequestButtons accountID={account.id} />
            )}
            {type === 'severed_relationships' && (
              <div>
                {SEVERED_RELATIONSHIPS_TEXT[event.type]({
                  from: instance,
                  ...event,
                })}
                <br />
                <a
                  href={`https://${instance}/severed_relationships`}
                  target="_blank"
                  rel="noopener"
                >
                  <Trans>
                    Learn more <Icon icon="external" size="s" />
                  </Trans>
                </a>
                .
              </div>
            )}
            {type === 'moderation_warning' && !!moderation_warning && (
              <div>
                {_(MODERATION_WARNING_TEXT[moderation_warning.action]())}
                <br />
                <a
                  href={`/disputes/strikes/${moderation_warning.id}`}
                  target="_blank"
                  rel="noopener"
                >
                  <Trans>
                    Learn more <Icon icon="external" size="s" />
                  </Trans>
                </a>
              </div>
            )}
            {type === 'annual_report' && (
              <div>
                <Link to={`/annual_report/${annualReport?.year}`}>
                  <Trans>View #Wrapstodon</Trans>
                </Link>
              </div>
            )}
          </>
        )}
        {_accounts?.length > 1 && (
          <p class="avatars-stack">
            {_accounts.slice(0, AVATARS_LIMIT).map((account) => (
              <Fragment key={account.id}>
                <a
                  key={account.id}
                  href={account.url}
                  rel="noopener"
                  class="account-avatar-stack"
                  onClick={(e) => {
                    e.preventDefault();
                    states.showAccount = account;
                  }}
                >
                  <Avatar
                    url={account.avatarStatic}
                    size={
                      _accounts.length <= 10
                        ? 'xxl'
                        : _accounts.length < 20
                          ? 'xl'
                          : 'l'
                    }
                    key={account.id}
                    alt={`${account.displayName} @${account.acct}`}
                    squircle={account?.bot}
                  />
                  {type === 'favourite+reblog' && (
                    <div class="account-sub-icons">
                      {account._types.map((type) => (
                        <Icon
                          icon={NOTIFICATION_ICONS[type]}
                          size="s"
                          class={`${type}-icon`}
                        />
                      ))}
                    </div>
                  )}
                </a>{' '}
              </Fragment>
            ))}
            {type === 'favourite+reblog' && expandAccounts === 'remote' ? (
              <button
                type="button"
                class="small plain"
                data-group-keys={_groupKeys?.join(' ')}
                onClick={() => {
                  states.showGenericAccounts = {
                    heading: genericAccountsHeading,
                    fetchAccounts: async () => {
                      const keyAccounts = await Promise.allSettled(
                        _groupKeys.map(async (gKey) => {
                          const iterator = masto.v2.notifications
                            .$select(gKey)
                            .accounts.list();
                          return [gKey, (await iterator.next()).value];
                        }),
                      );
                      const accounts = [];
                      for (const keyAccount of keyAccounts) {
                        const [key, _accounts] = keyAccount.value;
                        const type = /^favourite/.test(key)
                          ? 'favourite'
                          : /^reblog/.test(key)
                            ? 'reblog'
                            : null;
                        if (!type) continue;
                        for (const account of _accounts) {
                          const theAccount = accounts.find(
                            (a) => a.id === account.id,
                          );
                          if (theAccount) {
                            theAccount._types.push(type);
                          } else {
                            account._types = [type];
                            accounts.push(account);
                          }
                        }
                      }
                      return {
                        done: true,
                        value: accounts,
                      };
                    },
                    showReactions: true,
                    postID: statusKey(actualStatusID, instance),
                  };
                }}
              >
                <Icon icon="chevron-down" />
              </button>
            ) : (
              <button
                type="button"
                class="small plain"
                onClick={handleOpenGenericAccounts}
              >
                {_accounts.length > AVATARS_LIMIT &&
                  `+${_accounts.length - AVATARS_LIMIT}`}
                <Icon icon="chevron-down" />
              </button>
            )}
          </p>
        )}
        {!_accounts?.length && sampleAccounts?.length > 1 && (
          <p class="avatars-stack">
            {sampleAccounts.map((account) => (
              <Fragment key={account.id}>
                <a
                  key={account.id}
                  href={account.url}
                  rel="noopener"
                  class="account-avatar-stack"
                  onClick={(e) => {
                    e.preventDefault();
                    states.showAccount = account;
                  }}
                >
                  <Avatar
                    url={account.avatarStatic}
                    size="xxl"
                    key={account.id}
                    alt={`${account.displayName} @${account.acct}`}
                    squircle={account?.bot}
                  />
                  {/* {type === 'favourite+reblog' && (
                    <div class="account-sub-icons">
                      {account._types.map((type) => (
                        <Icon
                          icon={NOTIFICATION_ICONS[type]}
                          size="s"
                          class={`${type}-icon`}
                        />
                      ))}
                    </div>
                  )} */}
                </a>{' '}
              </Fragment>
            ))}
            {notificationsCount > sampleAccounts.length && (
              <Link
                to={
                  instance ? `/${instance}/s/${status.id}` : `/s/${status.id}`
                }
                class="button small plain centered"
              >
                +{notificationsCount - sampleAccounts.length}
                <Icon icon="chevron-right" />
              </Link>
            )}
          </p>
        )}
        {_statuses?.length > 1 && (
          <ul class="notification-group-statuses">
            {_statuses.map((status) => (
              <li key={status.id}>
                <TruncatedLink
                  class={`status-link status-type-${type}`}
                  to={
                    instance ? `/${instance}/s/${status.id}` : `/s/${status.id}`
                  }
                >
                  <Status
                    status={status}
                    size="s"
                    previewMode
                    allowContextMenu
                    allowFilters
                  />
                </TruncatedLink>
              </li>
            ))}
          </ul>
        )}
        {status && (!_statuses?.length || _statuses?.length <= 1) && (
          <TruncatedLink
            class={`status-link status-type-${type}`}
            to={
              instance
                ? `/${instance}/s/${actualStatusID}`
                : `/s/${actualStatusID}`
            }
            onContextMenu={
              !disableContextMenu
                ? (e) => {
                    const post = e.target.querySelector('.status');
                    if (post) {
                      // Fire a custom event to open the context menu
                      if (e.metaKey) return;
                      e.preventDefault();
                      post.dispatchEvent(
                        new MouseEvent('contextmenu', {
                          clientX: e.clientX,
                          clientY: e.clientY,
                        }),
                      );
                    }
                  }
                : undefined
            }
          >
            {isStatic ? (
              <Status
                status={actualStatus}
                size="s"
                readOnly
                allowContextMenu
                allowFilters
              />
            ) : (
              <Status
                statusID={actualStatusID}
                size="s"
                readOnly
                allowContextMenu
                allowFilters
              />
            )}
          </TruncatedLink>
        )}
      </div>
    </div>
  );
}

function TruncatedLink(props) {
  const ref = useTruncated();
  return <Link {...props} data-read-more={t`Read more →`} ref={ref} />;
}

export default memo(Notification, (oldProps, newProps) => {
  return oldProps.notification?.id === newProps.notification?.id;
});
