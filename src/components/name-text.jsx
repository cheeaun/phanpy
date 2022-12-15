import './name-text.css';

import emojifyText from '../utils/emojify-text';
import states from '../utils/states';

import Avatar from './avatar';

export default ({ account, showAvatar, showAcct, short, external }) => {
  const { acct, avatar, avatarStatic, id, url, displayName, username, emojis } =
    account;

  const displayNameWithEmoji = emojifyText(displayName, emojis);

  return (
    <a
      class={`name-text ${short ? 'short' : ''}`}
      href={url}
      target={external ? '_blank' : null}
      title={`@${acct}`}
      onClick={(e) => {
        if (external) return;
        e.preventDefault();
        states.showAccount = account;
      }}
    >
      {showAvatar && (
        <>
          <Avatar url={avatar} />{' '}
        </>
      )}
      {displayName && !short ? (
        <>
          <b
            dangerouslySetInnerHTML={{
              __html: displayNameWithEmoji,
            }}
          />
          {!showAcct && (
            <>
              {' '}
              <i>@{username}</i>
            </>
          )}
        </>
      ) : short ? (
        <i>@{username}</i>
      ) : (
        <b>@{username}</b>
      )}
      {showAcct && (
        <>
          <br />
          <i>@{acct}</i>
        </>
      )}
    </a>
  );
};
