import './account-block.css';

// import { useNavigate } from 'react-router-dom';
import enhanceContent from '../utils/enhance-content';
import niceDateTime from '../utils/nice-date-time';
import states from '../utils/states';

import Avatar from './avatar';
import EmojiText from './emoji-text';
import Icon from './icon';

function AccountBlock({
  skeleton,
  account,
  avatarSize = 'xl',
  instance,
  external,
  internal,
  onClick,
  showActivity = false,
  showStats = false,
  accountInstance,
  hideDisplayName = false,
}) {
  if (skeleton) {
    return (
      <div class="account-block skeleton">
        <Avatar size={avatarSize} />
        <span>
          <b>████████</b>
          <br />
          <span class="account-block-acct">@██████</span>
        </span>
      </div>
    );
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
  } = account;
  let [_, acct1, acct2] = acct.match(/([^@]+)(@.+)/i) || [, acct];
  if (accountInstance) {
    acct2 = `@${accountInstance}`;
  }

  const verifiedField = fields?.find((f) => !!f.verifiedAt && !!f.value);

  return (
    <a
      class="account-block"
      href={url}
      target={external ? '_blank' : null}
      title={`@${acct}`}
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
      <Avatar url={avatar} size={avatarSize} squircle={bot} />
      <span>
        {!hideDisplayName && (
          <>
            {displayName ? (
              <b>
                <EmojiText text={displayName} emojis={emojis} />
              </b>
            ) : (
              <b>{username}</b>
            )}
            <br />
          </>
        )}
        <span class="account-block-acct">
          @{acct1}
          <wbr />
          {acct2}
        </span>
        {showActivity && (
          <>
            <br />
            <small class="last-status-at insignificant">
              Posts: {statusesCount}
              {!!lastStatusAt && (
                <>
                  {' '}
                  &middot; Last posted:{' '}
                  {niceDateTime(lastStatusAt, {
                    hideTime: true,
                  })}
                </>
              )}
            </small>
          </>
        )}
        {showStats && (
          <div class="account-block-stats">
            <div
              class="short-desc"
              dangerouslySetInnerHTML={{
                __html: enhanceContent(note, { emojis }),
              }}
            />
            {bot && (
              <>
                <span class="tag">
                  <Icon icon="bot" /> Automated
                </span>
              </>
            )}
            {!!group && (
              <>
                <span class="tag">
                  <Icon icon="group" /> Group
                </span>
              </>
            )}
            {!!verifiedField && (
              <span class="verified-field ib">
                <Icon icon="check-circle" size="s" />{' '}
                <span
                  dangerouslySetInnerHTML={{
                    __html: enhanceContent(verifiedField.value, { emojis }),
                  }}
                />
              </span>
            )}
          </div>
        )}
      </span>
    </a>
  );
}

export default AccountBlock;
