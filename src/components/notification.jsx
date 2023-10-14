import shortenNumber from '../utils/shorten-number';
import states from '../utils/states';
import store from '../utils/store';
import useTruncated from '../utils/useTruncated';

import Avatar from './avatar';
import FollowRequestButtons from './follow-request-buttons';
import Icon from './icon';
import Link from './link';
import NameText from './name-text';
import RelativeTime from './relative-time';
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
*/

const contentText = {
  mention: 'mentioned you in their post.',
  status: 'published a post.',
  reblog: 'boosted your post.',
  'reblog+account': (count) => `boosted ${count} of your posts.`,
  reblog_reply: 'boosted your reply.',
  follow: 'followed you.',
  follow_request: 'requested to follow you.',
  favourite: 'favourited your post.',
  'favourite+account': (count) => `favourited ${count} of your posts.`,
  favourite_reply: 'favourited your reply.',
  poll: 'A poll you have voted in or created has ended.',
  'poll-self': 'A poll you have created has ended.',
  'poll-voted': 'A poll you have voted in has ended.',
  update: 'A post you interacted with has been edited.',
  'favourite+reblog': 'boosted & favourited your post.',
  'favourite+reblog+account': (count) =>
    `boosted & favourited ${count} of your posts.`,
  'favourite+reblog_reply': 'boosted & favourited your reply.',
  'admin.sign_up': 'signed up.',
  'admin.report': (targetAccount) => <>reported {targetAccount}</>,
};

const AVATARS_LIMIT = 50;

function Notification({ notification, instance, reload, isStatic }) {
  const { id, status, account, report, _accounts, _statuses } = notification;
  let { type } = notification;

  // status = Attached when type of the notification is favourite, reblog, status, mention, poll, or update
  const actualStatus = status?.reblog || status;
  const actualStatusID = actualStatus?.id;

  const currentAccount = store.session.get('currentAccount');
  const isSelf = currentAccount === account?.id;
  const isVoted = status?.poll?.voted;
  const isReplyToOthers =
    !!status?.inReplyToAccountId &&
    status?.inReplyToAccountId !== currentAccount &&
    status?.account?.id === currentAccount;

  let favsCount = 0;
  let reblogsCount = 0;
  if (type === 'favourite+reblog') {
    for (const account of _accounts) {
      if (account._types?.includes('favourite')) {
        favsCount++;
      }
      if (account._types?.includes('reblog')) {
        reblogsCount++;
      }
    }
    if (!reblogsCount && favsCount) type = 'favourite';
    if (!favsCount && reblogsCount) type = 'reblog';
  }

  let text;
  if (type === 'poll') {
    text = contentText[isSelf ? 'poll-self' : isVoted ? 'poll-voted' : 'poll'];
  } else if (
    type === 'reblog' ||
    type === 'favourite' ||
    type === 'favourite+reblog'
  ) {
    if (_statuses?.length > 1) {
      text = contentText[`${type}+account`];
    } else if (isReplyToOthers) {
      text = contentText[`${type}_reply`];
    } else {
      text = contentText[type];
    }
  } else if (contentText[type]) {
    text = contentText[type];
  } else {
    // Anticipate unhandled notification types, possibly from Mastodon forks or non-Mastodon instances
    // This surfaces the error to the user, hoping that users will report it
    text = `[Unknown notification type: ${type}]`;
  }

  if (typeof text === 'function') {
    const count = _statuses?.length || _accounts?.length;
    if (count) {
      text = text(count);
    } else if (type === 'admin.report') {
      const targetAccount = report?.targetAccount;
      if (targetAccount) {
        text = text(<NameText account={targetAccount} showAvatar />);
      }
    }
  }

  if (type === 'mention' && !status) {
    // Could be deleted
    return null;
  }

  const formattedCreatedAt =
    notification.createdAt && new Date(notification.createdAt).toLocaleString();

  const genericAccountsHeading =
    {
      'favourite+reblog': 'Boosted/Favourited by…',
      favourite: 'Favourited by…',
      reblog: 'Boosted by…',
      follow: 'Followed by…',
    }[type] || 'Accounts';
  const handleOpenGenericAccounts = () => {
    states.showGenericAccounts = {
      heading: genericAccountsHeading,
      accounts: _accounts,
      showReactions: type === 'favourite+reblog',
    };
  };

  return (
    <div class={`notification notification-${type}`} tabIndex="0">
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
            <p>
              {!/poll|update/i.test(type) && (
                <>
                  {_accounts?.length > 1 ? (
                    <>
                      <b tabIndex="0" onClick={handleOpenGenericAccounts}>
                        <span title={_accounts.length}>
                          {shortenNumber(_accounts.length)}
                        </span>{' '}
                        people
                      </b>{' '}
                    </>
                  ) : (
                    <>
                      <NameText account={account} showAvatar />{' '}
                    </>
                  )}
                </>
              )}
              {text}
              {type === 'mention' && (
                <span class="insignificant">
                  {' '}
                  •{' '}
                  <RelativeTime
                    datetime={notification.createdAt}
                    format="micro"
                  />
                </span>
              )}
            </p>
            {type === 'follow_request' && (
              <FollowRequestButtons
                accountID={account.id}
                onChange={() => {
                  // reload();
                }}
              />
            )}
          </>
        )}
        {_accounts?.length > 1 && (
          <p class="avatars-stack">
            {_accounts.slice(0, AVATARS_LIMIT).map((account, i) => (
              <>
                <a
                  href={account.url}
                  rel="noopener noreferrer"
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
                        : _accounts.length < 30
                        ? 'l'
                        : _accounts.length < 40
                        ? 'm'
                        : 's' // My god, this person is popular!
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
              </>
            ))}
            <button
              type="button"
              class="small plain"
              onClick={handleOpenGenericAccounts}
            >
              {_accounts.length > AVATARS_LIMIT &&
                `+${_accounts.length - AVATARS_LIMIT}`}
              <Icon icon="chevron-down" />
            </button>
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
                  <Status status={status} size="s" />
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
            onContextMenu={(e) => {
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
            }}
          >
            {isStatic ? (
              <Status status={actualStatus} size="s" />
            ) : (
              <Status statusID={actualStatusID} size="s" />
            )}
          </TruncatedLink>
        )}
      </div>
    </div>
  );
}

function TruncatedLink(props) {
  const ref = useTruncated();
  return <Link {...props} data-read-more="Read more →" ref={ref} />;
}

export default Notification;
