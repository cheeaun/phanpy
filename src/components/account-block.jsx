import './account-block.css';

// import { useNavigate } from 'react-router-dom';
import enhanceContent from '../utils/enhance-content';
import niceDateTime from '../utils/nice-date-time';
import shortenNumber from '../utils/shorten-number';
import states from '../utils/states';

import Avatar from './avatar';
import EmojiText from './emoji-text';
import Icon from './icon';

function AccountBlock({
  skeleton,
  account,
  avatarSize = 'xl',
  useAvatarStatic = false,
  instance,
  external,
  internal,
  onClick,
  showActivity = false,
  showStats = false,
  accountInstance,
  hideDisplayName = false,
  relationship = {},
  excludeRelationshipAttrs = [],
}) {
  if (skeleton) {
    return (
      <div class="account-block skeleton">
        <Avatar size={avatarSize} />
        <span>
          <b>████████</b>
          <br />
          <span class="account-block-acct">██████</span>
        </span>
      </div>
    );
  }

  if (!account) {
    return null;
  }

  // const navigate = useNavigate();

  const {
    id,
    acct,
    avatar,
    avatarStatic,
    displayName,
    username,
    emojis,
    url,
    statusesCount,
    lastStatusAt,
    bot,
    fields,
    note,
    group,
    followersCount,
    createdAt,
    locked,
  } = account;
  let [_, acct1, acct2] = acct.match(/([^@]+)(@.+)/i) || [, acct];
  if (accountInstance) {
    acct2 = `@${accountInstance}`;
  }

  const verifiedField = fields?.find((f) => !!f.verifiedAt && !!f.value);

  const excludedRelationship = {};
  for (const r in relationship) {
    if (!excludeRelationshipAttrs.includes(r)) {
      excludedRelationship[r] = relationship[r];
    }
  }
  const hasRelationship =
    excludedRelationship.following ||
    excludedRelationship.followedBy ||
    excludedRelationship.requested;

  return (
    <a
      class="account-block"
      href={url}
      target={external ? '_blank' : null}
      title={acct2 ? acct : `@${acct}`}
      onClick={(e) => {
        if (external) return;
        e.preventDefault();
        if (onClick) return onClick(e);
        if (internal) {
          // navigate(`/${instance}/a/${id}`);
          location.hash = `/${instance}/a/${id}`;
        } else {
          states.showAccount = {
            account,
            instance,
          };
        }
      }}
    >
      <Avatar
        url={useAvatarStatic ? avatarStatic : avatar || avatarStatic}
        size={avatarSize}
        squircle={bot}
      />
      <span class="account-block-content">
        {!hideDisplayName && (
          <>
            {displayName ? (
              <b>
                <EmojiText text={displayName} emojis={emojis} />
              </b>
            ) : (
              <b>{username}</b>
            )}
          </>
        )}{' '}
        <span class="account-block-acct">
          {acct2 ? '' : '@'}
          {acct1}
          <wbr />
          {acct2}
          {locked && (
            <>
              {' '}
              <Icon icon="lock" size="s" alt="Locked" />
            </>
          )}
        </span>
        {showActivity && (
          <div class="account-block-stats">
            Posts: {shortenNumber(statusesCount)}
            {!!lastStatusAt && (
              <>
                {' '}
                &middot; Last posted:{' '}
                {niceDateTime(lastStatusAt, {
                  hideTime: true,
                })}
              </>
            )}
          </div>
        )}
        {showStats && (
          <div class="account-block-stats">
            {bot && (
              <>
                <span class="tag collapsed">
                  <Icon icon="bot" /> Automated
                </span>
              </>
            )}
            {!!group && (
              <>
                <span class="tag collapsed">
                  <Icon icon="group" /> Group
                </span>
              </>
            )}
            {hasRelationship && (
              <div key={relationship.id} class="shazam-container-horizontal">
                <div class="shazam-container-inner">
                  {excludedRelationship.following &&
                  excludedRelationship.followedBy ? (
                    <span class="tag minimal">Mutual</span>
                  ) : excludedRelationship.requested ? (
                    <span class="tag minimal">Requested</span>
                  ) : excludedRelationship.following ? (
                    <span class="tag minimal">Following</span>
                  ) : excludedRelationship.followedBy ? (
                    <span class="tag minimal">Follows you</span>
                  ) : null}
                </div>
              </div>
            )}
            {!!followersCount && (
              <span class="ib">
                {shortenNumber(followersCount)}{' '}
                {followersCount === 1 ? 'follower' : 'followers'}
              </span>
            )}
            {!!verifiedField && (
              <span class="verified-field">
                <Icon icon="check-circle" size="s" />{' '}
                <span
                  dangerouslySetInnerHTML={{
                    __html: enhanceContent(verifiedField.value, { emojis }),
                  }}
                />
              </span>
            )}
            {!bot &&
              !group &&
              !hasRelationship &&
              !followersCount &&
              !verifiedField &&
              !!createdAt && (
                <span class="created-at">
                  Joined{' '}
                  <time datetime={createdAt}>
                    {niceDateTime(createdAt, {
                      hideTime: true,
                    })}
                  </time>
                </span>
              )}
          </div>
        )}
      </span>
    </a>
  );
}

export default AccountBlock;
