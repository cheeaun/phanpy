import './media-post.css';

import { memo } from 'preact/compat';
import { useContext, useMemo } from 'preact/hooks';
import { useSnapshot } from 'valtio';

import FilterContext from '../utils/filter-context';
import { isFiltered } from '../utils/filters';
import states, { statusKey } from '../utils/states';
import store from '../utils/store';
import { getCurrentAccountID } from '../utils/store-utils';

import Media from './media';

function MediaPost({
  class: className,
  statusID,
  status,
  instance,
  parent,
  // allowFilters,
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
    // _filtered,
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

  const currentAccount = useMemo(() => {
    return getCurrentAccountID();
  }, []);
  const isSelf = useMemo(() => {
    return currentAccount && currentAccount === accountId;
  }, [accountId, currentAccount]);

  const filterContext = useContext(FilterContext);
  const filterInfo = !isSelf && isFiltered(filtered, filterContext);

  if (filterInfo?.action === 'hide') {
    return null;
  }

  console.debug('RENDER Media post', id, status?.account.displayName);

  const hasSpoiler = sensitive;
  const readingExpandMedia = useMemo(() => {
    // default | show_all | hide_all
    const prefs = store.account.get('preferences') || {};
    return prefs['reading:expand:media'] || 'default';
  }, []);
  const showSpoilerMedia = readingExpandMedia === 'show_all';

  const Parent = parent || 'div';

  return mediaAttachments.map((media, i) => {
    const mediaKey = `${sKey}-${media.id}`;
    const filterTitleStr = filterInfo?.titlesStr;
    return (
      <Parent
        data-state-post-id={sKey}
        onMouseEnter={debugHover}
        key={mediaKey}
        data-spoiler-text={
          spoilerText || (sensitive ? 'Sensitive media' : undefined)
        }
        data-filtered-text={
          filterInfo
            ? `Filtered${filterTitleStr ? `: ${filterTitleStr}` : ''}`
            : undefined
        }
        class={`
          media-post
          ${filterInfo ? 'filtered' : ''}
          ${hasSpoiler ? 'has-spoiler' : ''}
          ${showSpoilerMedia ? 'show-media' : ''}
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
