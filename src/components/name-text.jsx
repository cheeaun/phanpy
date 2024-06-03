import './name-text.css';

import { memo } from 'preact/compat';

import states from '../utils/states';

import Avatar from './avatar';
import EmojiText from './emoji-text';

const nameCollator = new Intl.Collator('en', {
  sensitivity: 'base',
});

function NameText({
  account,
  instance,
  showAvatar,
  showAcct,
  short,
  external,
  onClick,
}) {
  const { acct, avatar, avatarStatic, id, url, displayName, emojis, bot } =
    account;
  let { username } = account;
  const [_, acct1, acct2] = acct.match(/([^@]+)(@.+)/i) || [, acct];

  const trimmedUsername = username.toLowerCase().trim();
  const trimmedDisplayName = (displayName || '').toLowerCase().trim();
  const shortenedDisplayName = trimmedDisplayName
    .replace(/(\:(\w|\+|\-)+\:)(?=|[\!\.\?]|$)/g, '') // Remove shortcodes, regex from https://regex101.com/r/iE9uV0/1
    .replace(/\s+/g, ''); // E.g. "My name" === "myname"
  const shortenedAlphaNumericDisplayName = shortenedDisplayName.replace(
    /[^a-z0-9@\.]/gi,
    '',
  ); // Remove non-alphanumeric characters

  if (
    (!short &&
      (trimmedUsername === trimmedDisplayName ||
        trimmedUsername === shortenedDisplayName ||
        trimmedUsername === shortenedAlphaNumericDisplayName ||
        nameCollator.compare(trimmedUsername, shortenedDisplayName) === 0)) ||
    shortenedAlphaNumericDisplayName === acct.toLowerCase()
  ) {
    username = null;
  }

  return (
    <a
      class={`name-text ${showAcct ? 'show-acct' : ''} ${short ? 'short' : ''}`}
      href={url}
      target={external ? '_blank' : null}
      title={
        displayName
          ? `${displayName} (${acct2 ? '' : '@'}${acct})`
          : `${acct2 ? '' : '@'}${acct}`
      }
      onClick={(e) => {
        if (external) return;
        if (e.shiftKey) return; // Save link? 🤷‍♂️
        e.preventDefault();
        e.stopPropagation();
        if (onClick) return onClick(e);
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.which === 2) {
          const internalURL = `#/${instance}/a/${id}`;
          window.open(internalURL, '_blank');
          return;
        }
        states.showAccount = {
          account,
          instance,
        };
      }}
    >
      {showAvatar && (
        <>
          <Avatar url={avatarStatic || avatar} squircle={bot} />{' '}
        </>
      )}
      {displayName && !short ? (
        <>
          <b>
            <EmojiText text={displayName} emojis={emojis} />
          </b>
          {!showAcct && username && (
            <>
              {' '}
              <i>@{username}</i>
            </>
          )}
        </>
      ) : short ? (
        <i>{username}</i>
      ) : (
        <b>{username}</b>
      )}
      {showAcct && (
        <>
          <br />
          <i>
            {acct2 ? '' : '@'}
            {acct1}
            {!!acct2 && <span class="ib">{acct2}</span>}
          </i>
        </>
      )}
    </a>
  );
}

export default memo(NameText, (oldProps, newProps) => {
  // Only care about account.id, the other props usually don't change
  const { account } = oldProps;
  const { account: newAccount } = newProps;
  return account?.acct === newAccount?.acct;
});
