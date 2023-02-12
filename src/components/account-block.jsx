import './account-block.css';

import emojifyText from '../utils/emojify-text';
import states from '../utils/states';

import Avatar from './avatar';

function AccountBlock({
  skeleton,
  account,
  avatarSize = 'xl',
  instance,
  external,
  onClick,
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

  const { acct, avatar, avatarStatic, displayName, username, emojis, url } =
    account;
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
      </span>
    </a>
  );
}

export default AccountBlock;
