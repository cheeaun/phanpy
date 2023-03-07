import './account-block.css';

import emojifyText from '../utils/emojify-text';
import niceDateTime from '../utils/nice-date-time';
import states from '../utils/states';

import Avatar from './avatar';

function AccountBlock({
  skeleton,
  account,
  avatarSize = 'xl',
  instance,
  external,
  onClick,
  showActivity = false,
}) {
  if (skeleton) {
    return (
      <div class="account-block skeleton">
        <Avatar size={avatarSize} />
        <span>
          <b>████████</b>
          <br />
          @██████
        </span>
      </div>
    );
  }

  const {
    acct,
    avatar,
    avatarStatic,
    displayName,
    username,
    emojis,
    url,
    statusesCount,
    lastStatusAt,
  } = account;
  const displayNameWithEmoji = emojifyText(displayName, emojis);

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
        states.showAccount = {
          account,
          instance,
        };
      }}
    >
      <Avatar url={avatar} size={avatarSize} />
      <span>
        {displayName ? (
          <b
            dangerouslySetInnerHTML={{
              __html: displayNameWithEmoji,
            }}
          />
        ) : (
          <b>{username}</b>
        )}
        <br />@{acct}
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
      </span>
    </a>
  );
}

export default AccountBlock;
