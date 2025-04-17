import './name-text.css';

import { useLingui } from '@lingui/react';
import { memo } from 'preact/compat';

import { api } from '../utils/api';
import mem from '../utils/mem';
import states from '../utils/states';

import Avatar from './avatar';
import EmojiText from './emoji-text';

const nameCollator = mem((locale) => {
  const options = {
    sensitivity: 'base',
  };
  try {
    return new Intl.Collator(locale || undefined, options);
  } catch (e) {
    return new Intl.Collator(undefined, options);
  }
});

const ACCT_REGEX = /([^@]+)(@.+)/i;
const SHORTCODES_REGEX = /(\:(\w|\+|\-)+\:)(?=|[\!\.\?]|$)/g;
const SPACES_REGEX = /\s+/g;
const NON_ALPHA_NUMERIC_REGEX = /[^a-z0-9@\.]/gi;

function NameText({
  account,
  instance,
  showAvatar,
  showAcct,
  short,
  external,
  onClick,
}) {
  const { i18n } = useLingui();
  if (!account) return null;
  const {
    acct,
    avatar,
    avatarStatic,
    id,
    url,
    displayName,
    emojis,
    bot,
    username,
  } = account;
  const [_, acct1, acct2] = acct.match(ACCT_REGEX) || [, acct];

  if (!instance) instance = api().instance;

  const trimmedUsername = username.toLowerCase().trim();
  const trimmedDisplayName = (displayName || '').toLowerCase().trim();
  const shortenedDisplayName = trimmedDisplayName
    .replace(SHORTCODES_REGEX, '') // Remove shortcodes, regex from https://regex101.com/r/iE9uV0/1
    .replace(SPACES_REGEX, ''); // E.g. "My name" === "myname"
  const shortenedAlphaNumericDisplayName = shortenedDisplayName.replace(
    NON_ALPHA_NUMERIC_REGEX,
    '',
  ); // Remove non-alphanumeric characters

  const hideUsername =
    (!short &&
      (trimmedUsername === trimmedDisplayName ||
        trimmedUsername === shortenedDisplayName ||
        trimmedUsername === shortenedAlphaNumericDisplayName ||
        nameCollator(i18n.locale).compare(
          trimmedUsername,
          shortenedDisplayName,
        ) === 0)) ||
    shortenedAlphaNumericDisplayName === acct.toLowerCase();

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
          <b dir="auto">
            <EmojiText text={displayName} emojis={emojis} />
          </b>
          {!showAcct && !hideUsername && (
            <>
              {' '}
              <i class="bidi-isolate">@{username}</i>
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
          <i class="bidi-isolate">
            {acct2 ? '' : '@'}
            {acct1}
            {!!acct2 && <span class="ib">{acct2}</span>}
          </i>
        </>
      )}
    </a>
  );
}

export default mem(NameText);

// export default memo(NameText, (oldProps, newProps) => {
//   // Only care about account.id, the other props usually don't change
//   const { account } = oldProps;
//   const { account: newAccount } = newProps;
//   return account?.acct === newAccount?.acct;
// });
