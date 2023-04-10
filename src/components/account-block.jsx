import './account-block.css';

import { useNavigate } from 'react-router-dom';

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
  internal,
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
          <span class="account-block-acct">@██████</span>
        </span>
      </div>
    );
  }

  const navigate = useNavigate();

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
  } = account;
  const displayNameWithEmoji = emojifyText(displayName, emojis);
  const [_, acct1, acct2] = acct.match(/([^@]+)(@.+)/i) || [, acct];

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
          navigate(`/${instance}/a/${id}`);
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
        {displayName ? (
          <b
            dangerouslySetInnerHTML={{
              __html: displayNameWithEmoji,
            }}
          />
        ) : (
          <b>{username}</b>
        )}
        <br />
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
      </span>
    </a>
  );
}

export default AccountBlock;
