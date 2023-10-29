import './media-post.css';

import { memo } from 'preact/compat';
import { useSnapshot } from 'valtio';

import states, { statusKey } from '../utils/states';

import Media from './media';

function MediaPost({
  class: className,
  statusID,
  status,
  instance,
  parent,
  allowFilters,
  onMediaClick,
}) {
  let sKey = statusKey(statusID, instance);
  const snapStates = useSnapshot(states);
  if (!status) {
    status = snapStates.statuses[sKey] || snapStates.statuses[statusID];
    sKey = statusKey(status?.id, instance);
  }
  if (!status) {
    return null;
  }

  const {
    account: {
      acct,
      avatar,
      avatarStatic,
      id: accountId,
      url: accountURL,
      displayName,
      username,
      emojis: accountEmojis,
      bot,
      group,
    },
    id,
    repliesCount,
    reblogged,
    reblogsCount,
    favourited,
    favouritesCount,
    bookmarked,
    poll,
    muted,
    sensitive,
    spoilerText,
    visibility, // public, unlisted, private, direct
    language,
    editedAt,
    filtered,
    card,
    createdAt,
    inReplyToId,
    inReplyToAccountId,
    content,
    mentions,
    mediaAttachments,
    reblog,
    uri,
    url,
    emojis,
    // Non-API props
    _deleted,
    _pinned,
    _filtered,
  } = status;

  if (!mediaAttachments?.length) {
    return null;
  }

  const debugHover = (e) => {
    if (e.shiftKey) {
      console.log({
        ...status,
      });
    }
  };

  console.debug('RENDER Media post', id, status?.account.displayName);

  // const readingExpandSpoilers = useMemo(() => {
  //   const prefs = store.account.get('preferences') || {};
  //   return !!prefs['reading:expand:spoilers'];
  // }, []);
  const hasSpoiler = spoilerText || sensitive;

  const Parent = parent || 'div';

  return mediaAttachments.map((media, i) => {
    const mediaKey = `${sKey}-${media.id}`;
    return (
      <Parent
        onMouseEnter={debugHover}
        key={mediaKey}
        data-spoiler-text={
          spoilerText || (sensitive ? 'Sensitive media' : undefined)
        }
        data-filtered-text={_filtered ? 'Filtered' : undefined}
        class={`
          media-post
          ${allowFilters && _filtered ? 'filtered' : ''}
          ${hasSpoiler ? 'has-spoiler' : ''}
        `}
      >
        <Media
          class={className}
          media={media}
          lang={language}
          to={`/${instance}/s/${id}?media-only=${i + 1}`}
          onClick={
            onMediaClick ? (e) => onMediaClick(e, i, media, status) : undefined
          }
        />
      </Parent>
    );
  });
}

export default memo(MediaPost);
