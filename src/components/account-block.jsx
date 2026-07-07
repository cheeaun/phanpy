import './account-block.css';

import { ph } from '@lingui/core/macro';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'preact/hooks';
import punycode from 'punycode/';

// import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import enhanceContent from '../utils/enhance-content';
import { memFetchFamiliarFollowers } from '../utils/familiar-followers';
import getDomain from '../utils/get-domain';
import niceDateTime from '../utils/nice-date-time';
import shortenNumber from '../utils/shorten-number';
import states from '../utils/states';
import { getCurrentAccountID } from '../utils/store-utils';

import Avatar from './avatar';
import EmojiText from './emoji-text';
import Icon from './icon';
import RolesTags from './roles-tags';

function AccountBlock(props) {
  const {
    skeleton,
    account,
    avatarSize = 'xl',
    avatarDescription,
    useAvatarStatic = false,
    instance,
    external,
    internal,
    onClick,
    showActivity = false,
    showStats = false,
    accountInstance,
    hideDisplayName = false,
    excludeRelationshipAttrs = [],
  } = props;
  const relationship = props.relationship;
  // FOR DEBUGGING
  // const relationship = {
  //   id: 'fake',
  //   following: false,
  //   followedBy: false,
  //   requested: false,
  // };
  const hasRelationshipProp = 'relationship' in props;

  const { t } = useLingui();
  const { instance: currentInstance } = api();
  const currentAccountID = getCurrentAccountID();
  const [familiarFollowers, setFamiliarFollowers] = useState([]);
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
    roles,
  } = account;
  const unicodeAcct = punycode.toUnicode(acct);
  let [_, acct1, acct2] = unicodeAcct.match(/([^@]+)(@.+)/i) || [, unicodeAcct];
  if (accountInstance) {
    acct2 = `@${punycode.toUnicode(accountInstance)}`;
  }

  const verifiedField = fields?.find((f) => !!f.verifiedAt && !!f.value);

  const relationshipObj = relationship || {};
  const excludedRelationship = {};
  for (const r in relationshipObj) {
    if (!excludeRelationshipAttrs.includes(r)) {
      excludedRelationship[r] = relationshipObj[r];
    }
  }
  const hasRelationship =
    excludedRelationship.following ||
    excludedRelationship.followedBy ||
    excludedRelationship.requested;

  const accountDomain = getDomain(url);
  const sameCurrentInstance = (instance || accountDomain) === currentInstance;
  useEffect(() => {
    if (!showStats || !id || !currentAccountID || id === currentAccountID)
      return;
    if (!sameCurrentInstance) return;
    if (hasRelationshipProp && !relationship) return;
    const rel = relationship || {};
    if (rel.following || rel.followedBy || rel.requested) return;
    let aborted = false;
    (async () => {
      try {
        const followers = await memFetchFamiliarFollowers(id);
        if (aborted) return;
        setFamiliarFollowers(followers[0]?.accounts || []);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      aborted = true;
    };
  }, [
    showStats,
    id,
    currentAccountID,
    sameCurrentInstance,
    hasRelationshipProp,
    relationship,
  ]);

  return (
    <a
      class="account-block"
      href={url}
      target={external ? '_blank' : null}
      title={acct2 ? unicodeAcct : `@${unicodeAcct}`}
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
      <div class="avatar-container">
        <Avatar
          url={useAvatarStatic ? avatarStatic : avatar || avatarStatic}
          staticUrl={useAvatarStatic ? undefined : avatarStatic}
          size={avatarSize}
          squircle={bot}
          alt={avatarDescription || ''}
        />
      </div>
      <span class="account-block-content">
        {!hideDisplayName && (
          <>
            {displayName ? (
              <b>
                <EmojiText
                  text={displayName}
                  emojis={emojis}
                  resolverURL={url}
                />
              </b>
            ) : (
              <b>{username}</b>
            )}
          </>
        )}{' '}
        <span class="account-block-acct bidi-isolate">
          {acct2 ? '' : '@'}
          {acct1}
          <wbr />
          {acct2}
          {locked && (
            <>
              {' '}
              <Icon icon="lock" size="s" alt={t`Locked`} />
            </>
          )}
        </span>
        <RolesTags roles={roles} accountUrl={url} />
        {showActivity && (
          <div class="account-block-stats">
            <Trans>Posts: {shortenNumber(statusesCount)}</Trans>
            {!!lastStatusAt && (
              <>
                {' '}
                &middot;{' '}
                <span class="ib">
                  <Trans>
                    Last active:{' '}
                    {ph({
                      date: niceDateTime(lastStatusAt, {
                        hideTime: true,
                      }),
                    })}
                  </Trans>
                </span>
              </>
            )}
          </div>
        )}
        {showStats && (
          <div class="account-block-stats">
            {bot && (
              <>
                <span class="tag collapsed">
                  <Icon icon="bot" /> <Trans>Automated</Trans>
                </span>
              </>
            )}
            {!!group && (
              <>
                <span class="tag collapsed">
                  <Icon icon="group" /> <Trans>Group</Trans>
                </span>
              </>
            )}
            {hasRelationship && (
              <div key={relationship.id} class="shazam-container-horizontal">
                <div class="shazam-container-inner">
                  {excludedRelationship.following &&
                  excludedRelationship.followedBy ? (
                    <span class="tag minimal">
                      <Trans>Mutual</Trans>
                    </span>
                  ) : excludedRelationship.requested ? (
                    <span class="tag minimal">
                      <Trans>Requested</Trans>
                    </span>
                  ) : excludedRelationship.following ? (
                    <span class="tag minimal">
                      <Trans>Following</Trans>
                    </span>
                  ) : excludedRelationship.followedBy ? (
                    <span class="tag minimal">
                      <Trans>Follows you</Trans>
                    </span>
                  ) : null}
                </div>
              </div>
            )}
            {((!hasRelationship && !!familiarFollowers?.length) ||
              !!followersCount) && (
              <span class="ib">
                {!hasRelationship && !!familiarFollowers?.length && (
                  <span class="shazam-container-horizontal">
                    <span class="shazam-container-inner">
                      <span class="stats-avatars-bunch">
                        {familiarFollowers.slice(0, 3).map((follower) => (
                          <Avatar
                            url={follower.avatarStatic}
                            size="s"
                            alt={`${follower.displayName} @${follower.acct}`}
                            squircle={follower.bot}
                            key={follower.id}
                          />
                        ))}
                      </span>
                    </span>
                  </span>
                )}{' '}
                {!!followersCount && (
                  <span class="ib">
                    <Plural
                      value={followersCount}
                      one={
                        <Trans>
                          <span title={followersCount}>
                            {shortenNumber(followersCount)}
                          </span>{' '}
                          follower
                        </Trans>
                      }
                      other={
                        <Trans>
                          <span title={followersCount}>
                            {shortenNumber(followersCount)}
                          </span>{' '}
                          followers
                        </Trans>
                      }
                    />
                  </span>
                )}
              </span>
            )}
            {!!verifiedField && (
              <span class="verified-field">
                <Icon icon="check-circle" size="s" alt={t`Verified`} />{' '}
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
              !familiarFollowers?.length &&
              !followersCount &&
              !verifiedField &&
              !!createdAt && (
                <span class="created-at">
                  <Trans>
                    Joined{' '}
                    <time datetime={createdAt}>
                      {niceDateTime(createdAt, {
                        hideTime: true,
                      })}
                    </time>
                  </Trans>
                </span>
              )}
          </div>
        )}
      </span>
    </a>
  );
}

export default AccountBlock;
