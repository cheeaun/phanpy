import './status.css';

import '@justinribeiro/lite-youtube';
import {
  ControlledMenu,
  Menu,
  MenuDivider,
  MenuHeader,
  MenuItem,
} from '@szhsin/react-menu';
import { decodeBlurHash, getBlurHashAverageColor } from 'fast-blurhash';
import { shallowEqual } from 'fast-equals';
import prettify from 'html-prettify';
import { Fragment } from 'preact';
import { memo } from 'preact/compat';
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import punycode from 'punycode';
import { useHotkeys } from 'react-hotkeys-hook';
import { detectAll } from 'tinyld/light';
import { useLongPress } from 'use-long-press';
import { useSnapshot } from 'valtio';

import CustomEmoji from '../components/custom-emoji';
import EmojiText from '../components/emoji-text';
import LazyShazam from '../components/lazy-shazam';
import Loader from '../components/loader';
import Menu2 from '../components/menu2';
import MenuConfirm from '../components/menu-confirm';
import Modal from '../components/modal';
import NameText from '../components/name-text';
import Poll from '../components/poll';
import { api } from '../utils/api';
import emojifyText from '../utils/emojify-text';
import enhanceContent from '../utils/enhance-content';
import FilterContext from '../utils/filter-context';
import { isFiltered } from '../utils/filters';
import getTranslateTargetLanguage from '../utils/get-translate-target-language';
import getHTMLText from '../utils/getHTMLText';
import handleContentLinks from '../utils/handle-content-links';
import htmlContentLength from '../utils/html-content-length';
import isMastodonLinkMaybe from '../utils/isMastodonLinkMaybe';
import localeMatch from '../utils/locale-match';
import mem from '../utils/mem';
import niceDateTime from '../utils/nice-date-time';
import openCompose from '../utils/open-compose';
import pmem from '../utils/pmem';
import safeBoundingBoxPadding from '../utils/safe-bounding-box-padding';
import shortenNumber from '../utils/shorten-number';
import showCompose from '../utils/show-compose';
import showToast from '../utils/show-toast';
import { speak, supportsTTS } from '../utils/speech';
import states, { getStatus, saveStatus, statusKey } from '../utils/states';
import statusPeek from '../utils/status-peek';
import store from '../utils/store';
import { getCurrentAccountID } from '../utils/store-utils';
import supports from '../utils/supports';
import unfurlMastodonLink from '../utils/unfurl-link';
import useTruncated from '../utils/useTruncated';
import visibilityIconsMap from '../utils/visibility-icons-map';

import Avatar from './avatar';
import Icon from './icon';
import Link from './link';
import Media from './media';
import { isMediaCaptionLong } from './media';
import MenuLink from './menu-link';
import RelativeTime from './relative-time';
import TranslationBlock from './translation-block';

const SHOW_COMMENT_COUNT_LIMIT = 280;
const INLINE_TRANSLATE_LIMIT = 140;

function fetchAccount(id, masto) {
  return masto.v1.accounts.$select(id).fetch();
}
const memFetchAccount = pmem(fetchAccount);

const visibilityText = {
  public: 'Public',
  unlisted: 'Unlisted',
  private: 'Followers only',
  direct: 'Private mention',
};

const isIOS =
  window.ontouchstart !== undefined &&
  /iPad|iPhone|iPod/.test(navigator.userAgent);

const rtf = new Intl.RelativeTimeFormat();

const REACTIONS_LIMIT = 80;

function getPollText(poll) {
  if (!poll?.options?.length) return '';
  return `📊:\n${poll.options
    .map(
      (option) =>
        `- ${option.title}${
          option.votesCount >= 0 ? ` (${option.votesCount})` : ''
        }`,
    )
    .join('\n')}`;
}
function getPostText(status) {
  const { spoilerText, content, poll } = status;
  return (
    (spoilerText ? `${spoilerText}\n\n` : '') +
    getHTMLText(content) +
    getPollText(poll)
  );
}

const PostContent = memo(
  ({ post, instance, previewMode }) => {
    const { content, emojis, language, mentions, url } = post;
    return (
      <div
        lang={language}
        dir="auto"
        class="inner-content"
        onClick={handleContentLinks({
          mentions,
          instance,
          previewMode,
          statusURL: url,
        })}
        dangerouslySetInnerHTML={{
          __html: enhanceContent(content, {
            emojis,
            postEnhanceDOM: (dom) => {
              // Remove target="_blank" from links
              dom.querySelectorAll('a.u-url[target="_blank"]').forEach((a) => {
                if (!/http/i.test(a.innerText.trim())) {
                  a.removeAttribute('target');
                }
              });
            },
          }),
        }}
      />
    );
  },
  (oldProps, newProps) => {
    const { post: oldPost } = oldProps;
    const { post: newPost } = newProps;
    return oldPost.content === newPost.content;
  },
);

const SIZE_CLASS = {
  s: 'small',
  m: 'medium',
  l: 'large',
};

const detectLang = mem((text) => {
  const langs = detectAll(text);
  const lang = langs[0];
  if (lang?.lang && lang?.accuracy > 0.5) {
    // If > 50% accurate, use it
    // It can be accurate if < 50% but better be safe
    // Though > 50% also can be inaccurate 🤷‍♂️
    return lang.lang;
  }
  return null;
});

function Status({
  statusID,
  status,
  instance: propInstance,
  size = 'm',
  contentTextWeight,
  readOnly,
  enableCommentHint,
  withinContext,
  skeleton,
  enableTranslate,
  forceTranslate: _forceTranslate,
  previewMode,
  // allowFilters,
  onMediaClick,
  quoted,
  onStatusLinkClick = () => {},
  showFollowedTags,
  allowContextMenu,
  showActionsBar,
  showReplyParent,
  mediaFirst,
}) {
  if (skeleton) {
    return (
      <div
        class={`status skeleton ${
          mediaFirst ? 'status-media-first small' : ''
        }`}
      >
        {!mediaFirst && <Avatar size="xxl" />}
        <div class="container">
          <div class="meta">
            {(size === 's' || mediaFirst) && <Avatar size="m" />} ███ ████████
          </div>
          <div class="content-container">
            {mediaFirst && <div class="media-first-container" />}
            <div class={`content ${mediaFirst ? 'media-first-content' : ''}`}>
              <p>████ ████████</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  const { masto, instance, authenticated } = api({ instance: propInstance });
  const { instance: currentInstance } = api();
  const sameInstance = instance === currentInstance;

  let sKey = statusKey(statusID || status?.id, instance);
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
    language: _language,
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
    tags,
    // Non-API props
    _deleted,
    _pinned,
    // _filtered,
    // Non-Mastodon
    emojiReactions,
  } = status;

  let languageAutoDetected = content && detectLang(getHTMLText(content));
  const language = _language || languageAutoDetected;

  // if (!mediaAttachments?.length) mediaFirst = false;
  const hasMediaAttachments = !!mediaAttachments?.length;
  if (mediaFirst && hasMediaAttachments) size = 's';

  const currentAccount = useMemo(() => {
    return getCurrentAccountID();
  }, []);
  const isSelf = useMemo(() => {
    return currentAccount && currentAccount === accountId;
  }, [accountId, currentAccount]);

  const filterContext = useContext(FilterContext);
  const filterInfo =
    !isSelf && !readOnly && !previewMode && isFiltered(filtered, filterContext);

  if (filterInfo?.action === 'hide') {
    return null;
  }

  console.debug('RENDER Status', id, status?.account.displayName, quoted);

  const debugHover = (e) => {
    if (e.shiftKey) {
      console.log({
        ...status,
      });
    }
  };

  if (/*allowFilters && */ size !== 'l' && filterInfo) {
    return (
      <FilteredStatus
        status={status}
        filterInfo={filterInfo}
        instance={instance}
        containerProps={{
          onMouseEnter: debugHover,
        }}
        showFollowedTags
        quoted={quoted}
      />
    );
  }

  const createdAtDate = new Date(createdAt);
  const editedAtDate = new Date(editedAt);

  let inReplyToAccountRef = mentions?.find(
    (mention) => mention.id === inReplyToAccountId,
  );
  if (!inReplyToAccountRef && inReplyToAccountId === id) {
    inReplyToAccountRef = { url: accountURL, username, displayName };
  }
  const [inReplyToAccount, setInReplyToAccount] = useState(inReplyToAccountRef);
  if (!withinContext && !inReplyToAccount && inReplyToAccountId) {
    const account = states.accounts[inReplyToAccountId];
    if (account) {
      setInReplyToAccount(account);
    } else {
      memFetchAccount(inReplyToAccountId, masto)
        .then((account) => {
          setInReplyToAccount(account);
          states.accounts[account.id] = account;
        })
        .catch((e) => {});
    }
  }
  const mentionSelf =
    inReplyToAccountId === currentAccount ||
    mentions?.find((mention) => mention.id === currentAccount);

  const readingExpandSpoilers = useMemo(() => {
    const prefs = store.account.get('preferences') || {};
    return !!prefs['reading:expand:spoilers'];
  }, []);
  const readingExpandMedia = useMemo(() => {
    // default | show_all | hide_all
    // Ignore hide_all because it means hide *ALL* media including non-sensitive ones
    const prefs = store.account.get('preferences') || {};
    return prefs['reading:expand:media'] || 'default';
  }, []);
  // FOR TESTING:
  // const readingExpandSpoilers = true;
  // const readingExpandMedia = 'show_all';
  const showSpoiler =
    previewMode || readingExpandSpoilers || !!snapStates.spoilers[id];
  const showSpoilerMedia =
    previewMode ||
    readingExpandMedia === 'show_all' ||
    !!snapStates.spoilersMedia[id];

  if (reblog) {
    // If has statusID, means useItemID (cached in states)

    if (group) {
      return (
        <div
          data-state-post-id={sKey}
          class="status-group"
          onMouseEnter={debugHover}
        >
          <div class="status-pre-meta">
            <Icon icon="group" size="l" alt="Group" />{' '}
            <NameText account={status.account} instance={instance} showAvatar />
          </div>
          <Status
            status={statusID ? null : reblog}
            statusID={statusID ? reblog.id : null}
            instance={instance}
            size={size}
            contentTextWeight={contentTextWeight}
            readOnly={readOnly}
            mediaFirst={mediaFirst}
          />
        </div>
      );
    }

    return (
      <div
        data-state-post-id={sKey}
        class="status-reblog"
        onMouseEnter={debugHover}
      >
        <div class="status-pre-meta">
          <Icon icon="rocket" size="l" />{' '}
          <NameText account={status.account} instance={instance} showAvatar />{' '}
          <span>boosted</span>
        </div>
        <Status
          status={statusID ? null : reblog}
          statusID={statusID ? reblog.id : null}
          instance={instance}
          size={size}
          contentTextWeight={contentTextWeight}
          readOnly={readOnly}
          enableCommentHint
          mediaFirst={mediaFirst}
        />
      </div>
    );
  }

  // Check followedTags
  const FollowedTagsParent = useCallback(
    ({ children }) => (
      <div
        data-state-post-id={sKey}
        class="status-followed-tags"
        onMouseEnter={debugHover}
      >
        <div class="status-pre-meta">
          <Icon icon="hashtag" size="l" />{' '}
          {snapStates.statusFollowedTags[sKey].slice(0, 3).map((tag) => (
            <Link
              key={tag}
              to={instance ? `/${instance}/t/${tag}` : `/t/${tag}`}
              class="status-followed-tag-item"
            >
              {tag}
            </Link>
          ))}
        </div>
        {children}
      </div>
    ),
    [sKey, instance, snapStates.statusFollowedTags[sKey]],
  );
  const StatusParent =
    showFollowedTags && !!snapStates.statusFollowedTags[sKey]?.length
      ? FollowedTagsParent
      : Fragment;

  const isSizeLarge = size === 'l';

  const [forceTranslate, setForceTranslate] = useState(_forceTranslate);
  const targetLanguage = getTranslateTargetLanguage(true);
  const contentTranslationHideLanguages =
    snapStates.settings.contentTranslationHideLanguages || [];
  const { contentTranslation, contentTranslationAutoInline } =
    snapStates.settings;
  if (!contentTranslation) enableTranslate = false;
  const inlineTranslate = useMemo(() => {
    if (
      !contentTranslation ||
      !contentTranslationAutoInline ||
      readOnly ||
      (withinContext && !isSizeLarge) ||
      previewMode ||
      spoilerText ||
      sensitive ||
      poll ||
      card ||
      mediaAttachments?.length
    ) {
      return false;
    }
    const contentLength = htmlContentLength(content);
    return contentLength > 0 && contentLength <= INLINE_TRANSLATE_LIMIT;
  }, [
    contentTranslation,
    contentTranslationAutoInline,
    readOnly,
    withinContext,
    isSizeLarge,
    previewMode,
    spoilerText,
    sensitive,
    poll,
    card,
    mediaAttachments,
    content,
  ]);

  const [showEdited, setShowEdited] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);

  const spoilerContentRef = useTruncated();
  const contentRef = useTruncated();
  const mediaContainerRef = useTruncated();
  const readMoreText = 'Read more →';

  const statusRef = useRef(null);

  const unauthInteractionErrorMessage = `Sorry, your current logged-in instance can't interact with this post from another instance.`;

  const textWeight = useCallback(
    () =>
      Math.max(
        Math.round((spoilerText.length + htmlContentLength(content)) / 140) ||
          1,
        1,
      ),
    [spoilerText, content],
  );

  const createdDateText = niceDateTime(createdAtDate);
  const editedDateText = editedAt && niceDateTime(editedAtDate);

  // Can boost if:
  // - authenticated AND
  // - visibility != direct OR
  // - visibility = private AND isSelf
  let canBoost =
    authenticated && visibility !== 'direct' && visibility !== 'private';
  if (visibility === 'private' && isSelf) {
    canBoost = true;
  }

  const replyStatus = (e) => {
    if (!sameInstance || !authenticated) {
      return alert(unauthInteractionErrorMessage);
    }
    // syntheticEvent comes from MenuItem
    if (e?.shiftKey || e?.syntheticEvent?.shiftKey) {
      const newWin = openCompose({
        replyToStatus: status,
      });
      if (newWin) return;
    }
    showCompose({
      replyToStatus: status,
    });
  };

  // Check if media has no descriptions
  const mediaNoDesc = useMemo(() => {
    return mediaAttachments.some(
      (attachment) => !attachment.description?.trim?.(),
    );
  }, [mediaAttachments]);

  const statusMonthsAgo = useMemo(() => {
    return Math.floor(
      (new Date() - createdAtDate) / (1000 * 60 * 60 * 24 * 30),
    );
  }, [createdAtDate]);

  const boostStatus = async () => {
    if (!sameInstance || !authenticated) {
      alert(unauthInteractionErrorMessage);
      return false;
    }
    try {
      if (!reblogged) {
        let confirmText = 'Boost this post?';
        if (mediaNoDesc) {
          confirmText += '\n\n⚠️ Some media have no descriptions.';
        }
        const yes = confirm(confirmText);
        if (!yes) {
          return false;
        }
      }
      // Optimistic
      states.statuses[sKey] = {
        ...status,
        reblogged: !reblogged,
        reblogsCount: reblogsCount + (reblogged ? -1 : 1),
      };
      if (reblogged) {
        const newStatus = await masto.v1.statuses.$select(id).unreblog();
        saveStatus(newStatus, instance);
        return true;
      } else {
        const newStatus = await masto.v1.statuses.$select(id).reblog();
        saveStatus(newStatus, instance);
        return true;
      }
    } catch (e) {
      console.error(e);
      // Revert optimistism
      states.statuses[sKey] = status;
      return false;
    }
  };
  const confirmBoostStatus = async () => {
    if (!sameInstance || !authenticated) {
      alert(unauthInteractionErrorMessage);
      return false;
    }
    try {
      // Optimistic
      states.statuses[sKey] = {
        ...status,
        reblogged: !reblogged,
        reblogsCount: reblogsCount + (reblogged ? -1 : 1),
      };
      if (reblogged) {
        const newStatus = await masto.v1.statuses.$select(id).unreblog();
        saveStatus(newStatus, instance);
      } else {
        const newStatus = await masto.v1.statuses.$select(id).reblog();
        saveStatus(newStatus, instance);
      }
      return true;
    } catch (e) {
      console.error(e);
      // Revert optimistism
      states.statuses[sKey] = status;
      return false;
    }
  };

  const favouriteStatus = async () => {
    if (!sameInstance || !authenticated) {
      alert(unauthInteractionErrorMessage);
      return false;
    }
    try {
      // Optimistic
      states.statuses[sKey] = {
        ...status,
        favourited: !favourited,
        favouritesCount: favouritesCount + (favourited ? -1 : 1),
      };
      if (favourited) {
        const newStatus = await masto.v1.statuses.$select(id).unfavourite();
        saveStatus(newStatus, instance);
      } else {
        const newStatus = await masto.v1.statuses.$select(id).favourite();
        saveStatus(newStatus, instance);
      }
      return true;
    } catch (e) {
      console.error(e);
      // Revert optimistism
      states.statuses[sKey] = status;
      return false;
    }
  };
  const favouriteStatusNotify = async () => {
    try {
      const done = await favouriteStatus();
      if (!isSizeLarge && done) {
        showToast(
          favourited
            ? `Unliked @${username || acct}'s post`
            : `Liked @${username || acct}'s post`,
        );
      }
    } catch (e) {}
  };

  const bookmarkStatus = async () => {
    if (!supports('@mastodon/post-bookmark')) return;
    if (!sameInstance || !authenticated) {
      alert(unauthInteractionErrorMessage);
      return false;
    }
    try {
      // Optimistic
      states.statuses[sKey] = {
        ...status,
        bookmarked: !bookmarked,
      };
      if (bookmarked) {
        const newStatus = await masto.v1.statuses.$select(id).unbookmark();
        saveStatus(newStatus, instance);
      } else {
        const newStatus = await masto.v1.statuses.$select(id).bookmark();
        saveStatus(newStatus, instance);
      }
      return true;
    } catch (e) {
      console.error(e);
      // Revert optimistism
      states.statuses[sKey] = status;
      return false;
    }
  };
  const bookmarkStatusNotify = async () => {
    try {
      const done = await bookmarkStatus();
      if (!isSizeLarge && done) {
        showToast(
          bookmarked
            ? `Unbookmarked @${username || acct}'s post`
            : `Bookmarked @${username || acct}'s post`,
        );
      }
    } catch (e) {}
  };

  const differentLanguage =
    !!language &&
    language !== targetLanguage &&
    !localeMatch([language], [targetLanguage]) &&
    !contentTranslationHideLanguages.find(
      (l) => language === l || localeMatch([language], [l]),
    );

  const reblogIterator = useRef();
  const favouriteIterator = useRef();
  async function fetchBoostedLikedByAccounts(firstLoad) {
    if (firstLoad) {
      reblogIterator.current = masto.v1.statuses
        .$select(statusID)
        .rebloggedBy.list({
          limit: REACTIONS_LIMIT,
        });
      favouriteIterator.current = masto.v1.statuses
        .$select(statusID)
        .favouritedBy.list({
          limit: REACTIONS_LIMIT,
        });
    }
    const [{ value: reblogResults }, { value: favouriteResults }] =
      await Promise.allSettled([
        reblogIterator.current.next(),
        favouriteIterator.current.next(),
      ]);
    if (reblogResults.value?.length || favouriteResults.value?.length) {
      const accounts = [];
      if (reblogResults.value?.length) {
        accounts.push(
          ...reblogResults.value.map((a) => {
            a._types = ['reblog'];
            return a;
          }),
        );
      }
      if (favouriteResults.value?.length) {
        accounts.push(
          ...favouriteResults.value.map((a) => {
            a._types = ['favourite'];
            return a;
          }),
        );
      }
      return {
        value: accounts,
        done: reblogResults.done && favouriteResults.done,
      };
    }
    return {
      value: [],
      done: true,
    };
  }

  const actionsRef = useRef();
  const isPublic = ['public', 'unlisted'].includes(visibility);
  const isPinnable = ['public', 'unlisted', 'private'].includes(visibility);
  const StatusMenuItems = (
    <>
      {!isSizeLarge && sameInstance && (
        <>
          <div class="menu-control-group-horizontal status-menu">
            <MenuItem onClick={replyStatus}>
              <Icon icon="comment" />
              <span>
                {repliesCount > 0 ? shortenNumber(repliesCount) : 'Reply'}
              </span>
            </MenuItem>
            <MenuConfirm
              subMenu
              confirmLabel={
                <>
                  <Icon icon="rocket" />
                  <span>{reblogged ? 'Unboost' : 'Boost'}</span>
                </>
              }
              className={`menu-reblog ${reblogged ? 'checked' : ''}`}
              menuExtras={
                <MenuItem
                  onClick={() => {
                    showCompose({
                      draftStatus: {
                        status: `\n${url}`,
                      },
                    });
                  }}
                >
                  <Icon icon="quote" />
                  <span>Quote</span>
                </MenuItem>
              }
              menuFooter={
                mediaNoDesc && !reblogged ? (
                  <div class="footer">
                    <Icon icon="alert" />
                    Some media have no descriptions.
                  </div>
                ) : (
                  statusMonthsAgo >= 3 && (
                    <div class="footer">
                      <Icon icon="info" />
                      <span>
                        Old post (
                        <strong>{rtf.format(-statusMonthsAgo, 'month')}</strong>
                        )
                      </span>
                    </div>
                  )
                )
              }
              disabled={!canBoost}
              onClick={async () => {
                try {
                  const done = await confirmBoostStatus();
                  if (!isSizeLarge && done) {
                    showToast(
                      reblogged
                        ? `Unboosted @${username || acct}'s post`
                        : `Boosted @${username || acct}'s post`,
                    );
                  }
                } catch (e) {}
              }}
            >
              <Icon icon="rocket" />
              <span>
                {reblogsCount > 0
                  ? shortenNumber(reblogsCount)
                  : reblogged
                  ? 'Unboost'
                  : 'Boost…'}
              </span>
            </MenuConfirm>
            <MenuItem
              onClick={favouriteStatusNotify}
              className={`menu-favourite ${favourited ? 'checked' : ''}`}
            >
              <Icon icon="heart" />
              <span>
                {favouritesCount > 0
                  ? shortenNumber(favouritesCount)
                  : favourited
                  ? 'Unlike'
                  : 'Like'}
              </span>
            </MenuItem>
            {supports('@mastodon/post-bookmark') && (
              <MenuItem
                onClick={bookmarkStatusNotify}
                className={`menu-bookmark ${bookmarked ? 'checked' : ''}`}
              >
                <Icon icon="bookmark" />
                <span>{bookmarked ? 'Unbookmark' : 'Bookmark'}</span>
              </MenuItem>
            )}
          </div>
        </>
      )}
      {!isSizeLarge && sameInstance && (isSizeLarge || showActionsBar) && (
        <MenuDivider />
      )}
      {(isSizeLarge || showActionsBar) && (
        <>
          <MenuItem
            onClick={() => {
              states.showGenericAccounts = {
                heading: 'Boosted/Liked by…',
                fetchAccounts: fetchBoostedLikedByAccounts,
                instance,
                showReactions: true,
                postID: sKey,
              };
            }}
          >
            <Icon icon="react" />
            <span>
              Boosted/Liked by<span class="more-insignificant">…</span>
            </span>
          </MenuItem>
        </>
      )}
      {!mediaFirst && (
        <>
          {(enableTranslate || !language || differentLanguage) && (
            <MenuDivider />
          )}
          {enableTranslate ? (
            <div class={supportsTTS ? 'menu-horizontal' : ''}>
              <MenuItem
                disabled={forceTranslate}
                onClick={() => {
                  setForceTranslate(true);
                }}
              >
                <Icon icon="translate" />
                <span>Translate</span>
              </MenuItem>
              {supportsTTS && (
                <MenuItem
                  onClick={() => {
                    const postText = getPostText(status);
                    if (postText) {
                      speak(postText, language);
                    }
                  }}
                >
                  <Icon icon="speak" />
                  <span>Speak</span>
                </MenuItem>
              )}
            </div>
          ) : (
            (!language || differentLanguage) && (
              <div class={supportsTTS ? 'menu-horizontal' : ''}>
                <MenuLink
                  to={`${instance ? `/${instance}` : ''}/s/${id}?translate=1`}
                >
                  <Icon icon="translate" />
                  <span>Translate</span>
                </MenuLink>
                {supportsTTS && (
                  <MenuItem
                    onClick={() => {
                      const postText = getPostText(status);
                      if (postText) {
                        speak(postText, language);
                      }
                    }}
                  >
                    <Icon icon="speak" />
                    <span>Speak</span>
                  </MenuItem>
                )}
              </div>
            )
          )}
        </>
      )}
      {((!isSizeLarge && sameInstance) ||
        enableTranslate ||
        !language ||
        differentLanguage) && <MenuDivider />}
      {!isSizeLarge && (
        <>
          <MenuLink
            to={instance ? `/${instance}/s/${id}` : `/s/${id}`}
            onClick={(e) => {
              onStatusLinkClick(e, status);
            }}
          >
            <Icon icon="arrows-right" />
            <small>
              View post by @{username || acct}
              <br />
              <span class="more-insignificant">
                {visibilityText[visibility]} • {createdDateText}
              </span>
            </small>
          </MenuLink>
        </>
      )}
      {!!editedAt && (
        <>
          <MenuItem
            onClick={() => {
              setShowEdited(id);
            }}
          >
            <Icon icon="history" />
            <small>
              Show Edit History
              <br />
              <span class="more-insignificant">Edited: {editedDateText}</span>
            </small>
          </MenuItem>
        </>
      )}
      <MenuItem href={url} target="_blank">
        <Icon icon="external" />
        <small class="menu-double-lines">{nicePostURL(url)}</small>
      </MenuItem>
      <div class="menu-horizontal">
        <MenuItem
          onClick={() => {
            // Copy url to clipboard
            try {
              navigator.clipboard.writeText(url);
              showToast('Link copied');
            } catch (e) {
              console.error(e);
              showToast('Unable to copy link');
            }
          }}
        >
          <Icon icon="link" />
          <span>Copy</span>
        </MenuItem>
        {isPublic &&
          navigator?.share &&
          navigator?.canShare?.({
            url,
          }) && (
            <MenuItem
              onClick={() => {
                try {
                  navigator.share({
                    url,
                  });
                } catch (e) {
                  console.error(e);
                  alert("Sharing doesn't seem to work.");
                }
              }}
            >
              <Icon icon="share" />
              <span>Share…</span>
            </MenuItem>
          )}
      </div>
      {isPublic && isSizeLarge && (
        <MenuItem
          onClick={() => {
            setShowEmbed(true);
          }}
        >
          <Icon icon="code" />
          <span>Embed post</span>
        </MenuItem>
      )}
      {(isSelf || mentionSelf) && <MenuDivider />}
      {(isSelf || mentionSelf) && (
        <MenuItem
          onClick={async () => {
            try {
              const newStatus = await masto.v1.statuses
                .$select(id)
                [muted ? 'unmute' : 'mute']();
              saveStatus(newStatus, instance);
              showToast(muted ? 'Conversation unmuted' : 'Conversation muted');
            } catch (e) {
              console.error(e);
              showToast(
                muted
                  ? 'Unable to unmute conversation'
                  : 'Unable to mute conversation',
              );
            }
          }}
        >
          {muted ? (
            <>
              <Icon icon="unmute" />
              <span>Unmute conversation</span>
            </>
          ) : (
            <>
              <Icon icon="mute" />
              <span>Mute conversation</span>
            </>
          )}
        </MenuItem>
      )}
      {isSelf && isPinnable && (
        <MenuItem
          onClick={async () => {
            try {
              const newStatus = await masto.v1.statuses
                .$select(id)
                [_pinned ? 'unpin' : 'pin']();
              // saveStatus(newStatus, instance);
              showToast(
                _pinned
                  ? 'Post unpinned from profile'
                  : 'Post pinned to profile',
              );
            } catch (e) {
              console.error(e);
              showToast(
                _pinned ? 'Unable to unpin post' : 'Unable to pin post',
              );
            }
          }}
        >
          {_pinned ? (
            <>
              <Icon icon="unpin" />
              <span>Unpin from profile</span>
            </>
          ) : (
            <>
              <Icon icon="pin" />
              <span>Pin to profile</span>
            </>
          )}
        </MenuItem>
      )}
      {isSelf && (
        <div class="menu-horizontal">
          {supports('@mastodon/post-edit') && (
            <MenuItem
              onClick={() => {
                showCompose({
                  editStatus: status,
                });
              }}
            >
              <Icon icon="pencil" />
              <span>Edit</span>
            </MenuItem>
          )}
          {isSizeLarge && (
            <MenuConfirm
              subMenu
              confirmLabel={
                <>
                  <Icon icon="trash" />
                  <span>Delete this post?</span>
                </>
              }
              menuItemClassName="danger"
              onClick={() => {
                // const yes = confirm('Delete this post?');
                // if (yes) {
                (async () => {
                  try {
                    await masto.v1.statuses.$select(id).remove();
                    const cachedStatus = getStatus(id, instance);
                    cachedStatus._deleted = true;
                    showToast('Deleted');
                  } catch (e) {
                    console.error(e);
                    showToast('Unable to delete');
                  }
                })();
                // }
              }}
            >
              <Icon icon="trash" />
              <span>Delete…</span>
            </MenuConfirm>
          )}
        </div>
      )}
      {!isSelf && isSizeLarge && (
        <>
          <MenuDivider />
          <MenuItem
            className="danger"
            onClick={() => {
              states.showReportModal = {
                account: status.account,
                post: status,
              };
            }}
          >
            <Icon icon="flag" />
            <span>Report post…</span>
          </MenuItem>
        </>
      )}
    </>
  );

  const contextMenuRef = useRef();
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [contextMenuProps, setContextMenuProps] = useState({});

  const showContextMenu =
    allowContextMenu || (!isSizeLarge && !previewMode && !_deleted && !quoted);

  // Only iOS/iPadOS browsers don't support contextmenu
  // Some comments report iPadOS might support contextmenu if a mouse is connected
  const bindLongPressContext = useLongPress(
    isIOS && showContextMenu
      ? (e) => {
          if (e.pointerType === 'mouse') return;
          // There's 'pen' too, but not sure if contextmenu event would trigger from a pen

          const { clientX, clientY } = e.touches?.[0] || e;
          // link detection copied from onContextMenu because here it works
          const link = e.target.closest('a');
          if (
            link &&
            statusRef.current.contains(link) &&
            !link.getAttribute('href').startsWith('#')
          )
            return;
          e.preventDefault();
          setContextMenuProps({
            anchorPoint: {
              x: clientX,
              y: clientY,
            },
            direction: 'right',
          });
          setIsContextMenuOpen(true);
        }
      : null,
    {
      threshold: 600,
      captureEvent: true,
      detect: 'touch',
      cancelOnMovement: 2, // true allows movement of up to 25 pixels
    },
  );

  const hotkeysEnabled = !readOnly && !previewMode && !quoted;
  const rRef = useHotkeys('r, shift+r', replyStatus, {
    enabled: hotkeysEnabled,
  });
  const fRef = useHotkeys('f, l', favouriteStatusNotify, {
    enabled: hotkeysEnabled,
  });
  const dRef = useHotkeys('d', bookmarkStatusNotify, {
    enabled: hotkeysEnabled,
  });
  const bRef = useHotkeys(
    'shift+b',
    () => {
      (async () => {
        try {
          const done = await confirmBoostStatus();
          if (!isSizeLarge && done) {
            showToast(
              reblogged
                ? `Unboosted @${username || acct}'s post`
                : `Boosted @${username || acct}'s post`,
            );
          }
        } catch (e) {}
      })();
    },
    {
      enabled: hotkeysEnabled && canBoost,
    },
  );
  const xRef = useHotkeys('x', (e) => {
    const activeStatus = document.activeElement.closest(
      '.status-link, .status-focus',
    );
    if (activeStatus) {
      const spoilerButton = activeStatus.querySelector(
        '.spoiler-button:not(.spoiling)',
      );
      if (spoilerButton) {
        e.stopPropagation();
        spoilerButton.click();
      } else {
        const spoilerMediaButton = activeStatus.querySelector(
          '.spoiler-media-button:not(.spoiling)',
        );
        if (spoilerMediaButton) {
          e.stopPropagation();
          spoilerMediaButton.click();
        }
      }
    }
  });

  const displayedMediaAttachments = mediaAttachments.slice(
    0,
    isSizeLarge ? undefined : 4,
  );
  const showMultipleMediaCaptions =
    mediaAttachments.length > 1 &&
    displayedMediaAttachments.some(
      (media) => !!media.description && !isMediaCaptionLong(media.description),
    );
  const captionChildren = useMemo(() => {
    if (!showMultipleMediaCaptions) return null;
    const attachments = [];
    displayedMediaAttachments.forEach((media, i) => {
      if (!media.description) return;
      const index = attachments.findIndex(
        (attachment) => attachment.media.description === media.description,
      );
      if (index === -1) {
        attachments.push({
          media,
          indices: [i],
        });
      } else {
        attachments[index].indices.push(i);
      }
    });
    return attachments.map(({ media, indices }) => (
      <div
        key={media.id}
        data-caption-index={indices.map((i) => i + 1).join(' ')}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          states.showMediaAlt = {
            alt: media.description,
            lang: language,
          };
        }}
        title={media.description}
      >
        <sup>{indices.map((i) => i + 1).join(' ')}</sup> {media.description}
      </div>
    ));

    // return displayedMediaAttachments.map(
    //   (media, i) =>
    //     !!media.description && (
    //       <div
    //         key={media.id}
    //         data-caption-index={i + 1}
    //         onClick={(e) => {
    //           e.preventDefault();
    //           e.stopPropagation();
    //           states.showMediaAlt = {
    //             alt: media.description,
    //             lang: language,
    //           };
    //         }}
    //         title={media.description}
    //       >
    //         <sup>{i + 1}</sup> {media.description}
    //       </div>
    //     ),
    // );
  }, [showMultipleMediaCaptions, displayedMediaAttachments, language]);

  const isThread = useMemo(() => {
    return (
      (!!inReplyToId && inReplyToAccountId === status.account?.id) ||
      !!snapStates.statusThreadNumber[sKey]
    );
  }, [
    inReplyToId,
    inReplyToAccountId,
    status.account?.id,
    snapStates.statusThreadNumber[sKey],
  ]);

  const showCommentHint = useMemo(() => {
    return (
      enableCommentHint &&
      !isThread &&
      !withinContext &&
      !inReplyToId &&
      visibility === 'public' &&
      repliesCount > 0
    );
  }, [
    enableCommentHint,
    isThread,
    withinContext,
    inReplyToId,
    repliesCount,
    visibility,
  ]);
  const showCommentCount = useMemo(() => {
    if (
      card ||
      poll ||
      sensitive ||
      spoilerText ||
      mediaAttachments?.length ||
      isThread ||
      withinContext ||
      inReplyToId ||
      repliesCount <= 0
    ) {
      return false;
    }
    const questionRegex = /[??？︖❓❔⁇⁈⁉¿‽؟]/;
    const containsQuestion = questionRegex.test(content);
    if (!containsQuestion) return false;
    const contentLength = htmlContentLength(content);
    if (contentLength > 0 && contentLength <= SHOW_COMMENT_COUNT_LIMIT) {
      return true;
    }
  }, [
    card,
    poll,
    sensitive,
    spoilerText,
    mediaAttachments,
    reblog,
    isThread,
    withinContext,
    inReplyToId,
    repliesCount,
    content,
  ]);

  return (
    <StatusParent>
      {showReplyParent && !!(inReplyToId && inReplyToAccountId) && (
        <StatusCompact sKey={sKey} />
      )}
      <article
        data-state-post-id={sKey}
        ref={(node) => {
          statusRef.current = node;
          // Use parent node if it's in focus
          // Use case: <a><status /></a>
          // When navigating (j/k), the <a> is focused instead of <status />
          // Hotkey binding doesn't bubble up thus this hack
          const nodeRef =
            node?.closest?.(
              '.timeline-item, .timeline-item-alt, .status-link, .status-focus',
            ) || node;
          rRef.current = nodeRef;
          fRef.current = nodeRef;
          dRef.current = nodeRef;
          bRef.current = nodeRef;
          xRef.current = nodeRef;
        }}
        tabindex="-1"
        class={`status ${
          !withinContext && inReplyToId && inReplyToAccount
            ? 'status-reply-to'
            : ''
        } visibility-${visibility} ${_pinned ? 'status-pinned' : ''} ${
          SIZE_CLASS[size]
        } ${_deleted ? 'status-deleted' : ''} ${quoted ? 'status-card' : ''} ${
          isContextMenuOpen ? 'status-menu-open' : ''
        } ${mediaFirst && hasMediaAttachments ? 'status-media-first' : ''}`}
        onMouseEnter={debugHover}
        onContextMenu={(e) => {
          if (!showContextMenu) return;
          if (e.metaKey) return;
          // console.log('context menu', e);
          const link = e.target.closest('a');
          if (
            link &&
            statusRef.current.contains(link) &&
            !link.getAttribute('href').startsWith('#')
          )
            return;

          // If there's selected text, don't show custom context menu
          const selection = window.getSelection?.();
          if (selection.toString().length > 0) {
            const { anchorNode } = selection;
            if (statusRef.current?.contains(anchorNode)) {
              return;
            }
          }
          e.preventDefault();
          setContextMenuProps({
            anchorPoint: {
              x: e.clientX,
              y: e.clientY,
            },
            direction: 'right',
          });
          setIsContextMenuOpen(true);
        }}
        {...(showContextMenu ? bindLongPressContext() : {})}
      >
        {showContextMenu && (
          <ControlledMenu
            ref={contextMenuRef}
            state={isContextMenuOpen ? 'open' : undefined}
            {...contextMenuProps}
            onClose={(e) => {
              setIsContextMenuOpen(false);
              // statusRef.current?.focus?.();
              if (e?.reason === 'click') {
                statusRef.current?.closest('[tabindex]')?.focus?.();
              }
            }}
            portal={{
              target: document.body,
            }}
            containerProps={{
              style: {
                // Higher than the backdrop
                zIndex: 1001,
              },
              onClick: () => {
                contextMenuRef.current?.closeMenu?.();
              },
            }}
            overflow="auto"
            boundingBoxPadding={safeBoundingBoxPadding()}
            unmountOnClose
          >
            {StatusMenuItems}
          </ControlledMenu>
        )}
        {showActionsBar &&
          size !== 'l' &&
          !previewMode &&
          !readOnly &&
          !_deleted &&
          !quoted && (
            <div
              class={`status-actions ${
                isContextMenuOpen === 'actions-bar' ? 'open' : ''
              }`}
              ref={actionsRef}
            >
              <StatusButton
                size="s"
                title="Reply"
                alt="Reply"
                class="reply-button"
                icon="comment"
                iconSize="m"
                onClick={replyStatus}
              />
              <StatusButton
                size="s"
                checked={favourited}
                title={['Like', 'Unlike']}
                alt={['Like', 'Liked']}
                class="favourite-button"
                icon="heart"
                iconSize="m"
                count={favouritesCount}
                onClick={favouriteStatusNotify}
              />
              <button
                type="button"
                title="More"
                class="plain more-button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setContextMenuProps({
                    anchorRef: {
                      current: e.currentTarget,
                    },
                    align: 'start',
                    direction: 'left',
                    gap: 0,
                    shift: -8,
                  });
                  setIsContextMenuOpen('actions-bar');
                }}
              >
                <Icon icon="more2" size="m" alt="More" />
              </button>
            </div>
          )}
        {size !== 'l' && (
          <div class="status-badge">
            {reblogged && <Icon class="reblog" icon="rocket" size="s" />}
            {favourited && <Icon class="favourite" icon="heart" size="s" />}
            {bookmarked && <Icon class="bookmark" icon="bookmark" size="s" />}
            {_pinned && <Icon class="pin" icon="pin" size="s" />}
          </div>
        )}
        {size !== 's' && (
          <a
            href={accountURL}
            tabindex="-1"
            // target="_blank"
            title={`@${acct}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              states.showAccount = {
                account: status.account,
                instance,
              };
            }}
          >
            <Avatar url={avatarStatic || avatar} size="xxl" squircle={bot} />
          </a>
        )}
        <div class="container">
          <div class="meta">
            <span class="meta-name">
              <NameText
                account={status.account}
                instance={instance}
                showAvatar={size === 's'}
                showAcct={isSizeLarge}
              />
            </span>
            {/* {inReplyToAccount && !withinContext && size !== 's' && (
              <>
                {' '}
                <span class="ib">
                  <Icon icon="arrow-right" class="arrow" />{' '}
                  <NameText account={inReplyToAccount} instance={instance} short />
                </span>
              </>
            )} */}
            {/* </span> */}{' '}
            {size !== 'l' &&
              (_deleted ? (
                <span class="status-deleted-tag">Deleted</span>
              ) : url && !previewMode && !readOnly && !quoted ? (
                <Link
                  to={instance ? `/${instance}/s/${id}` : `/s/${id}`}
                  onClick={(e) => {
                    if (
                      e.metaKey ||
                      e.ctrlKey ||
                      e.shiftKey ||
                      e.altKey ||
                      e.which === 2
                    ) {
                      return;
                    }
                    e.preventDefault();
                    e.stopPropagation();
                    onStatusLinkClick?.(e, status);
                    setContextMenuProps({
                      anchorRef: {
                        current: e.currentTarget,
                      },
                      align: 'end',
                      direction: 'bottom',
                      gap: 4,
                    });
                    setIsContextMenuOpen(true);
                  }}
                  class={`time ${
                    isContextMenuOpen && contextMenuProps?.anchorRef
                      ? 'is-open'
                      : ''
                  }`}
                >
                  {showCommentHint && !showCommentCount ? (
                    <Icon
                      icon="comment2"
                      size="s"
                      alt={`${repliesCount} ${
                        repliesCount === 1 ? 'reply' : 'replies'
                      }`}
                    />
                  ) : (
                    visibility !== 'public' &&
                    visibility !== 'direct' && (
                      <Icon
                        icon={visibilityIconsMap[visibility]}
                        alt={visibilityText[visibility]}
                        size="s"
                      />
                    )
                  )}{' '}
                  <RelativeTime datetime={createdAtDate} format="micro" />
                  {!previewMode && !readOnly && (
                    <Icon icon="more2" class="more" />
                  )}
                </Link>
              ) : (
                // <Menu
                //   instanceRef={menuInstanceRef}
                //   portal={{
                //     target: document.body,
                //   }}
                //   containerProps={{
                //     style: {
                //       // Higher than the backdrop
                //       zIndex: 1001,
                //     },
                //     onClick: (e) => {
                //       if (e.target === e.currentTarget)
                //         menuInstanceRef.current?.closeMenu?.();
                //     },
                //   }}
                //   align="end"
                //   gap={4}
                //   overflow="auto"
                //   viewScroll="close"
                //   boundingBoxPadding="8 8 8 8"
                //   unmountOnClose
                //   menuButton={({ open }) => (
                //     <Link
                //       to={instance ? `/${instance}/s/${id}` : `/s/${id}`}
                //       onClick={(e) => {
                //         e.preventDefault();
                //         e.stopPropagation();
                //         onStatusLinkClick?.(e, status);
                //       }}
                //       class={`time ${open ? 'is-open' : ''}`}
                //     >
                //       <Icon
                //         icon={visibilityIconsMap[visibility]}
                //         alt={visibilityText[visibility]}
                //         size="s"
                //       />{' '}
                //       <RelativeTime datetime={createdAtDate} format="micro" />
                //     </Link>
                //   )}
                // >
                //   {StatusMenuItems}
                // </Menu>
                <span class="time">
                  {visibility !== 'public' && visibility !== 'direct' && (
                    <>
                      <Icon
                        icon={visibilityIconsMap[visibility]}
                        alt={visibilityText[visibility]}
                        size="s"
                      />{' '}
                    </>
                  )}
                  <RelativeTime datetime={createdAtDate} format="micro" />
                </span>
              ))}
          </div>
          {visibility === 'direct' && (
            <>
              <div class="status-direct-badge">Private mention</div>{' '}
            </>
          )}
          {!withinContext && (
            <>
              {isThread ? (
                <div class="status-thread-badge">
                  <Icon icon="thread" size="s" />
                  Thread
                  {snapStates.statusThreadNumber[sKey]
                    ? ` ${snapStates.statusThreadNumber[sKey]}/X`
                    : ''}
                </div>
              ) : (
                !!inReplyToId &&
                !!inReplyToAccount &&
                (!!spoilerText ||
                  !mentions.find((mention) => {
                    return mention.id === inReplyToAccountId;
                  })) && (
                  <div class="status-reply-badge">
                    <Icon icon="reply" />{' '}
                    <NameText
                      account={inReplyToAccount}
                      instance={instance}
                      short
                    />
                  </div>
                )
              )}
            </>
          )}
          <div
            class={`content-container ${
              spoilerText || sensitive ? 'has-spoiler' : ''
            } ${showSpoiler ? 'show-spoiler' : ''} ${
              showSpoilerMedia ? 'show-media' : ''
            }`}
            data-content-text-weight={contentTextWeight ? textWeight() : null}
            style={
              (isSizeLarge || contentTextWeight) && {
                '--content-text-weight': textWeight(),
              }
            }
          >
            {mediaFirst && hasMediaAttachments ? (
              <>
                {(!!spoilerText || !!sensitive) && !readingExpandSpoilers && (
                  <>
                    {!!spoilerText && (
                      <span
                        class="spoiler-content media-first-spoiler-content"
                        lang={language}
                        dir="auto"
                        ref={spoilerContentRef}
                        data-read-more={readMoreText}
                      >
                        <EmojiText text={spoilerText} emojis={emojis} />{' '}
                      </span>
                    )}
                    <button
                      class={`light spoiler-button media-first-spoiler-button ${
                        showSpoiler ? 'spoiling' : ''
                      }`}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (showSpoiler) {
                          delete states.spoilers[id];
                          if (!readingExpandSpoilers) {
                            delete states.spoilersMedia[id];
                          }
                        } else {
                          states.spoilers[id] = true;
                          if (!readingExpandSpoilers) {
                            states.spoilersMedia[id] = true;
                          }
                        }
                      }}
                    >
                      <Icon icon={showSpoiler ? 'eye-open' : 'eye-close'} />{' '}
                      {showSpoiler ? 'Show less' : 'Show content'}
                    </button>
                  </>
                )}
                <MediaFirstContainer
                  mediaAttachments={mediaAttachments}
                  language={language}
                  postID={id}
                  instance={instance}
                />
                {!!content && (
                  <div class="media-first-content content" ref={contentRef}>
                    <PostContent
                      post={status}
                      instance={instance}
                      previewMode={previewMode}
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                {!!spoilerText && (
                  <>
                    <div
                      class="content spoiler-content"
                      lang={language}
                      dir="auto"
                      ref={spoilerContentRef}
                      data-read-more={readMoreText}
                    >
                      <p>
                        <EmojiText text={spoilerText} emojis={emojis} />
                      </p>
                    </div>
                    {readingExpandSpoilers || previewMode ? (
                      <div class="spoiler-divider">
                        <Icon icon="eye-open" /> Content warning
                      </div>
                    ) : (
                      <button
                        class={`light spoiler-button ${
                          showSpoiler ? 'spoiling' : ''
                        }`}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (showSpoiler) {
                            delete states.spoilers[id];
                            if (!readingExpandSpoilers) {
                              delete states.spoilersMedia[id];
                            }
                          } else {
                            states.spoilers[id] = true;
                            if (!readingExpandSpoilers) {
                              states.spoilersMedia[id] = true;
                            }
                          }
                        }}
                      >
                        <Icon icon={showSpoiler ? 'eye-open' : 'eye-close'} />{' '}
                        {showSpoiler ? 'Show less' : 'Show content'}
                      </button>
                    )}
                  </>
                )}
                {!!content && (
                  <div
                    class="content"
                    ref={contentRef}
                    data-read-more={readMoreText}
                  >
                    <PostContent
                      post={status}
                      instance={instance}
                      previewMode={previewMode}
                    />
                    <QuoteStatuses id={id} instance={instance} level={quoted} />
                  </div>
                )}
                {!!poll && (
                  <Poll
                    lang={language}
                    poll={poll}
                    readOnly={readOnly || !sameInstance || !authenticated}
                    onUpdate={(newPoll) => {
                      states.statuses[sKey].poll = newPoll;
                    }}
                    refresh={() => {
                      return masto.v1.polls
                        .$select(poll.id)
                        .fetch()
                        .then((pollResponse) => {
                          states.statuses[sKey].poll = pollResponse;
                        })
                        .catch((e) => {}); // Silently fail
                    }}
                    votePoll={(choices) => {
                      return masto.v1.polls
                        .$select(poll.id)
                        .votes.create({
                          choices,
                        })
                        .then((pollResponse) => {
                          states.statuses[sKey].poll = pollResponse;
                        })
                        .catch((e) => {}); // Silently fail
                    }}
                  />
                )}
                {(((enableTranslate || inlineTranslate) &&
                  !!content.trim() &&
                  !!getHTMLText(emojifyText(content, emojis)) &&
                  differentLanguage) ||
                  forceTranslate) && (
                  <TranslationBlock
                    forceTranslate={forceTranslate || inlineTranslate}
                    mini={!isSizeLarge && !withinContext}
                    sourceLanguage={language}
                    autoDetected={languageAutoDetected}
                    text={getPostText(status)}
                  />
                )}
                {!previewMode &&
                  sensitive &&
                  !!mediaAttachments.length &&
                  readingExpandMedia !== 'show_all' && (
                    <button
                      class={`plain spoiler-media-button ${
                        showSpoilerMedia ? 'spoiling' : ''
                      }`}
                      type="button"
                      hidden={!readingExpandSpoilers && !!spoilerText}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (showSpoilerMedia) {
                          delete states.spoilersMedia[id];
                        } else {
                          states.spoilersMedia[id] = true;
                        }
                      }}
                    >
                      <Icon
                        icon={showSpoilerMedia ? 'eye-open' : 'eye-close'}
                      />{' '}
                      {showSpoilerMedia ? 'Show less' : 'Show media'}
                    </button>
                  )}
                {!!mediaAttachments.length && (
                  <MultipleMediaFigure
                    lang={language}
                    enabled={showMultipleMediaCaptions}
                    captionChildren={captionChildren}
                  >
                    <div
                      ref={mediaContainerRef}
                      class={`media-container media-eq${
                        mediaAttachments.length
                      } ${mediaAttachments.length > 2 ? 'media-gt2' : ''} ${
                        mediaAttachments.length > 4 ? 'media-gt4' : ''
                      }`}
                    >
                      {displayedMediaAttachments.map((media, i) => (
                        <Media
                          key={media.id}
                          media={media}
                          autoAnimate={isSizeLarge}
                          showCaption={mediaAttachments.length === 1}
                          allowLongerCaption={
                            !content && mediaAttachments.length === 1
                          }
                          lang={language}
                          altIndex={
                            showMultipleMediaCaptions &&
                            !!media.description &&
                            i + 1
                          }
                          to={`/${instance}/s/${id}?${
                            withinContext ? 'media' : 'media-only'
                          }=${i + 1}`}
                          onClick={
                            onMediaClick
                              ? (e) => {
                                  onMediaClick(e, i, media, status);
                                }
                              : undefined
                          }
                        />
                      ))}
                    </div>
                  </MultipleMediaFigure>
                )}
                {!!card &&
                  /^https/i.test(card?.url) &&
                  !sensitive &&
                  !spoilerText &&
                  !poll &&
                  !mediaAttachments.length &&
                  !snapStates.statusQuotes[sKey] && (
                    <Card
                      card={card}
                      selfReferential={
                        card?.url === status.url || card?.url === status.uri
                      }
                      instance={currentInstance}
                    />
                  )}
              </>
            )}
          </div>
          {!isSizeLarge && showCommentCount && (
            <div class="content-comment-hint insignificant">
              <Icon icon="comment2" alt="Replies" /> {repliesCount}
            </div>
          )}
          {isSizeLarge && (
            <>
              <div class="extra-meta">
                {_deleted ? (
                  <span class="status-deleted-tag">Deleted</span>
                ) : (
                  <>
                    {/* <Icon
                      icon={visibilityIconsMap[visibility]}
                      alt={visibilityText[visibility]}
                    /> */}
                    <span>{visibilityText[visibility]}</span> &bull;{' '}
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <time
                        class="created"
                        datetime={createdAtDate.toISOString()}
                        title={createdAtDate.toLocaleString()}
                      >
                        {createdDateText}
                      </time>
                    </a>
                    {editedAt && (
                      <>
                        {' '}
                        &bull; <Icon icon="pencil" alt="Edited" />{' '}
                        <time
                          tabIndex="0"
                          class="edited"
                          datetime={editedAtDate.toISOString()}
                          onClick={() => {
                            setShowEdited(id);
                          }}
                        >
                          {editedDateText}
                        </time>
                      </>
                    )}
                  </>
                )}
              </div>
              {!!emojiReactions?.length && (
                <div class="emoji-reactions">
                  {emojiReactions.map((emojiReaction) => {
                    const { name, count, me, url, staticUrl } = emojiReaction;
                    if (url) {
                      // Some servers return url and staticUrl
                      return (
                        <span
                          class={`emoji-reaction tag ${
                            me ? '' : 'insignificant'
                          }`}
                        >
                          <CustomEmoji
                            alt={name}
                            url={url}
                            staticUrl={staticUrl}
                          />{' '}
                          {count}
                        </span>
                      );
                    }
                    const isShortCode = /^:.+?:$/.test(name);
                    if (isShortCode) {
                      const emoji = emojis.find(
                        (e) =>
                          e.shortcode ===
                          name.replace(/^:/, '').replace(/:$/, ''),
                      );
                      if (emoji) {
                        return (
                          <span
                            class={`emoji-reaction tag ${
                              me ? '' : 'insignificant'
                            }`}
                          >
                            <CustomEmoji
                              alt={name}
                              url={emoji.url}
                              staticUrl={emoji.staticUrl}
                            />{' '}
                            {count}
                          </span>
                        );
                      }
                    }
                    return (
                      <span
                        class={`emoji-reaction tag ${
                          me ? '' : 'insignificant'
                        }`}
                      >
                        {name} {count}
                      </span>
                    );
                  })}
                </div>
              )}
              <div class={`actions ${_deleted ? 'disabled' : ''}`}>
                <div class="action has-count">
                  <StatusButton
                    title="Reply"
                    alt="Comments"
                    class="reply-button"
                    icon="comment"
                    count={repliesCount}
                    onClick={replyStatus}
                  />
                </div>
                {/* <div class="action has-count">
                <StatusButton
                  checked={reblogged}
                  title={['Boost', 'Unboost']}
                  alt={['Boost', 'Boosted']}
                  class="reblog-button"
                  icon="rocket"
                  count={reblogsCount}
                  onClick={boostStatus}
                  disabled={!canBoost}
                />
              </div> */}
                <MenuConfirm
                  disabled={!canBoost}
                  onClick={confirmBoostStatus}
                  confirmLabel={
                    <>
                      <Icon icon="rocket" />
                      <span>{reblogged ? 'Unboost' : 'Boost'}</span>
                    </>
                  }
                  menuExtras={
                    <MenuItem
                      onClick={() => {
                        showCompose({
                          draftStatus: {
                            status: `\n${url}`,
                          },
                        });
                      }}
                    >
                      <Icon icon="quote" />
                      <span>Quote</span>
                    </MenuItem>
                  }
                  menuFooter={
                    mediaNoDesc &&
                    !reblogged && (
                      <div class="footer">
                        <Icon icon="alert" />
                        Some media have no descriptions.
                      </div>
                    )
                  }
                >
                  <div class="action has-count">
                    <StatusButton
                      checked={reblogged}
                      title={['Boost', 'Unboost']}
                      alt={['Boost', 'Boosted']}
                      class="reblog-button"
                      icon="rocket"
                      count={reblogsCount}
                      // onClick={boostStatus}
                      disabled={!canBoost}
                    />
                  </div>
                </MenuConfirm>
                <div class="action has-count">
                  <StatusButton
                    checked={favourited}
                    title={['Like', 'Unlike']}
                    alt={['Like', 'Liked']}
                    class="favourite-button"
                    icon="heart"
                    count={favouritesCount}
                    onClick={favouriteStatus}
                  />
                </div>
                {supports('@mastodon/post-bookmark') && (
                  <div class="action">
                    <StatusButton
                      checked={bookmarked}
                      title={['Bookmark', 'Unbookmark']}
                      alt={['Bookmark', 'Bookmarked']}
                      class="bookmark-button"
                      icon="bookmark"
                      onClick={bookmarkStatus}
                    />
                  </div>
                )}
                <Menu2
                  portal={{
                    target:
                      document.querySelector('.status-deck') || document.body,
                  }}
                  align="end"
                  gap={4}
                  overflow="auto"
                  viewScroll="close"
                  menuButton={
                    <div class="action">
                      <button
                        type="button"
                        title="More"
                        class="plain more-button"
                      >
                        <Icon icon="more" size="l" alt="More" />
                      </button>
                    </div>
                  }
                >
                  {StatusMenuItems}
                </Menu2>
              </div>
            </>
          )}
        </div>
        {!!showEdited && (
          <Modal
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowEdited(false);
                // statusRef.current?.focus();
              }
            }}
          >
            <EditedAtModal
              statusID={showEdited}
              instance={instance}
              fetchStatusHistory={() => {
                return masto.v1.statuses.$select(showEdited).history.list();
              }}
              onClose={() => {
                setShowEdited(false);
                statusRef.current?.focus();
              }}
            />
          </Modal>
        )}
        {!!showEmbed && (
          <Modal
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowEmbed(false);
              }
            }}
          >
            <EmbedModal
              post={status}
              instance={instance}
              onClose={() => {
                setShowEmbed(false);
              }}
            />
          </Modal>
        )}
      </article>
    </StatusParent>
  );
}

function MultipleMediaFigure(props) {
  const { enabled, children, lang, captionChildren } = props;
  if (!enabled || !captionChildren) return children;
  return (
    <figure class="media-figure-multiple">
      {children}
      <figcaption lang={lang} dir="auto">
        {captionChildren}
      </figcaption>
    </figure>
  );
}

function MediaFirstContainer(props) {
  const { mediaAttachments, language, postID, instance } = props;
  const moreThanOne = mediaAttachments.length > 1;

  const carouselRef = useRef();
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    let handleScroll = () => {
      const { clientWidth, scrollLeft } = carouselRef.current;
      const index = Math.round(scrollLeft / clientWidth);
      setCurrentIndex(index);
    };
    if (carouselRef.current) {
      carouselRef.current.addEventListener('scroll', handleScroll, {
        passive: true,
      });
    }
    return () => {
      if (carouselRef.current) {
        carouselRef.current.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  return (
    <>
      <div class="media-first-container">
        <div class="media-first-carousel" ref={carouselRef}>
          {mediaAttachments.map((media, i) => (
            <div class="media-first-item" key={media.id}>
              <Media
                media={media}
                lang={language}
                to={`/${instance}/s/${postID}?media=${i + 1}`}
              />
            </div>
          ))}
        </div>
        {moreThanOne && (
          <div class="media-carousel-controls">
            <div class="carousel-indexer">
              {currentIndex + 1}/{mediaAttachments.length}
            </div>
            <label class="media-carousel-button">
              <button
                type="button"
                class="carousel-button"
                hidden={currentIndex === 0}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  carouselRef.current.focus();
                  carouselRef.current.scrollTo({
                    left: carouselRef.current.clientWidth * (currentIndex - 1),
                    behavior: 'smooth',
                  });
                }}
              >
                <Icon icon="arrow-left" />
              </button>
            </label>
            <label class="media-carousel-button">
              <button
                type="button"
                class="carousel-button"
                hidden={currentIndex === mediaAttachments.length - 1}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  carouselRef.current.focus();
                  carouselRef.current.scrollTo({
                    left: carouselRef.current.clientWidth * (currentIndex + 1),
                    behavior: 'smooth',
                  });
                }}
              >
                <Icon icon="arrow-right" />
              </button>
            </label>
          </div>
        )}
      </div>
      {moreThanOne && (
        <div
          class="media-carousel-dots"
          style={{
            '--dots-count': mediaAttachments.length,
          }}
        >
          {mediaAttachments.map((media, i) => (
            <span
              key={media.id}
              class={`carousel-dot ${i === currentIndex ? 'active' : ''}`}
            />
          ))}
        </div>
      )}
    </>
  );
}

function Card({ card, selfReferential, instance }) {
  const snapStates = useSnapshot(states);
  const {
    blurhash,
    title,
    description,
    html,
    providerName,
    providerUrl,
    authorName,
    authorUrl,
    width,
    height,
    image,
    imageDescription,
    url,
    type,
    embedUrl,
    language,
    publishedAt,
  } = card;

  /* type
  link = Link OEmbed
  photo = Photo OEmbed
  video = Video OEmbed
  rich = iframe OEmbed. Not currently accepted, so won’t show up in practice.
  */

  const hasText = title || providerName || authorName;
  const isLandscape = width / height >= 1.2;
  const size = isLandscape ? 'large' : '';

  const [cardStatusURL, setCardStatusURL] = useState(null);
  // const [cardStatusID, setCardStatusID] = useState(null);
  useEffect(() => {
    if (hasText && image && !selfReferential && isMastodonLinkMaybe(url)) {
      unfurlMastodonLink(instance, url).then((result) => {
        if (!result) return;
        const { id, url } = result;
        setCardStatusURL('#' + url);

        // NOTE: This is for quote post
        // (async () => {
        //   const { masto } = api({ instance });
        //   const status = await masto.v1.statuses.$select(id).fetch();
        //   saveStatus(status, instance);
        //   setCardStatusID(id);
        // })();
      });
    }
  }, [hasText, image, selfReferential]);

  // if (cardStatusID) {
  //   return (
  //     <Status statusID={cardStatusID} instance={instance} size="s" readOnly />
  //   );
  // }

  if (snapStates.unfurledLinks[url]) return null;

  const hasIframeHTML = /<iframe/i.test(html);
  const handleClick = useCallback(
    (e) => {
      if (hasIframeHTML) {
        e.preventDefault();
        states.showEmbedModal = {
          html,
          url: url || embedUrl,
          width,
          height,
        };
      }
    },
    [hasIframeHTML],
  );

  if (hasText && (image || (type === 'photo' && blurhash))) {
    const domain = punycode.toUnicode(
      new URL(url).hostname.replace(/^www\./, '').replace(/\/$/, ''),
    );
    let blurhashImage;
    const rgbAverageColor =
      image && blurhash ? getBlurHashAverageColor(blurhash) : null;
    if (!image) {
      const w = 44;
      const h = 44;
      const blurhashPixels = decodeBlurHash(blurhash, w, h);
      const canvas = window.OffscreenCanvas
        ? new OffscreenCanvas(1, 1)
        : document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      const imageData = ctx.createImageData(w, h);
      imageData.data.set(blurhashPixels);
      ctx.putImageData(imageData, 0, 0);
      blurhashImage = canvas.toDataURL();
    }
    return (
      <a
        href={cardStatusURL || url}
        target={cardStatusURL ? null : '_blank'}
        rel="nofollow noopener noreferrer"
        class={`card link ${blurhashImage ? '' : size}`}
        lang={language}
        dir="auto"
        style={{
          '--average-color':
            rgbAverageColor && `rgb(${rgbAverageColor.join(',')})`,
        }}
        onClick={handleClick}
      >
        <div class="card-image">
          <img
            src={image || blurhashImage}
            width={width}
            height={height}
            loading="lazy"
            alt={imageDescription || ''}
            onError={(e) => {
              try {
                e.target.style.display = 'none';
              } catch (e) {}
            }}
          />
        </div>
        <div class="meta-container">
          <p class="meta domain">
            <span class="domain">{domain}</span>{' '}
            {!!publishedAt && <>&middot; </>}
            {!!publishedAt && (
              <>
                <RelativeTime datetime={publishedAt} format="micro" />
              </>
            )}
          </p>
          <p class="title" dir="auto" title={title}>
            {title}
          </p>
          <p class="meta" dir="auto" title={description}>
            {description ||
              (!!publishedAt && (
                <RelativeTime datetime={publishedAt} format="micro" />
              ))}
          </p>
        </div>
      </a>
    );
  } else if (type === 'photo') {
    return (
      <a
        href={url}
        target="_blank"
        rel="nofollow noopener noreferrer"
        class="card photo"
        onClick={handleClick}
      >
        <img
          src={embedUrl}
          width={width}
          height={height}
          alt={title || description}
          loading="lazy"
          style={{
            height: 'auto',
            aspectRatio: `${width}/${height}`,
          }}
        />
      </a>
    );
  } else {
    if (type === 'video') {
      if (/youtube/i.test(providerName)) {
        // Get ID from e.g. https://www.youtube.com/watch?v=[VIDEO_ID]
        const videoID = url.match(/watch\?v=([^&]+)/)?.[1];
        if (videoID) {
          return (
            <a class="card video" onClick={handleClick}>
              <lite-youtube videoid={videoID} nocookie></lite-youtube>
            </a>
          );
        }
      }
      // return (
      //   <div
      //     class="card video"
      //     style={{
      //       aspectRatio: `${width}/${height}`,
      //     }}
      //     dangerouslySetInnerHTML={{ __html: html }}
      //   />
      // );
    }
    if (hasText && !image) {
      const domain = punycode.toUnicode(
        new URL(url).hostname.replace(/^www\./, ''),
      );
      return (
        <a
          href={cardStatusURL || url}
          target={cardStatusURL ? null : '_blank'}
          rel="nofollow noopener noreferrer"
          class={`card link no-image`}
          lang={language}
          onClick={handleClick}
        >
          <div class="meta-container">
            <p class="meta domain">
              <span class="domain">
                <Icon icon="link" size="s" /> <span>{domain}</span>
              </span>{' '}
              {!!publishedAt && <>&middot; </>}
              {!!publishedAt && (
                <>
                  <RelativeTime datetime={publishedAt} format="micro" />
                </>
              )}
            </p>
            <p class="title" title={title}>
              {title}
            </p>
            <p class="meta" title={description || providerName || authorName}>
              {description || providerName || authorName}
            </p>
          </div>
        </a>
      );
    }
  }
}

function EditedAtModal({
  statusID,
  instance,
  fetchStatusHistory = () => {},
  onClose,
}) {
  const [uiState, setUIState] = useState('default');
  const [editHistory, setEditHistory] = useState([]);

  useEffect(() => {
    setUIState('loading');
    (async () => {
      try {
        const editHistory = await fetchStatusHistory();
        console.log(editHistory);
        setEditHistory(editHistory);
        setUIState('default');
      } catch (e) {
        console.error(e);
        setUIState('error');
      }
    })();
  }, []);

  return (
    <div id="edit-history" class="sheet">
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" />
        </button>
      )}
      <header>
        <h2>Edit History</h2>
        {uiState === 'error' && <p>Failed to load history</p>}
        {uiState === 'loading' && (
          <p>
            <Loader abrupt /> Loading&hellip;
          </p>
        )}
      </header>
      <main tabIndex="-1">
        {editHistory.length > 0 && (
          <ol>
            {editHistory.map((status) => {
              const { createdAt } = status;
              const createdAtDate = new Date(createdAt);
              return (
                <li key={createdAt} class="history-item">
                  <h3>
                    <time>
                      {niceDateTime(createdAtDate, {
                        formatOpts: {
                          weekday: 'short',
                          second: 'numeric',
                        },
                      })}
                    </time>
                  </h3>
                  <Status
                    status={status}
                    instance={instance}
                    size="s"
                    withinContext
                    readOnly
                    previewMode
                  />
                </li>
              );
            })}
          </ol>
        )}
      </main>
    </div>
  );
}

function generateHTMLCode(post, instance, level = 0) {
  const {
    account: {
      url: accountURL,
      displayName,
      acct,
      username,
      emojis: accountEmojis,
      bot,
      group,
    },
    id,
    poll,
    spoilerText,
    language,
    editedAt,
    createdAt,
    content,
    mediaAttachments,
    url,
    emojis,
  } = post;

  const sKey = statusKey(id, instance);
  const quotes = states.statusQuotes[sKey] || [];
  const uniqueQuotes = quotes.filter(
    (q, i, arr) => arr.findIndex((q2) => q2.url === q.url) === i,
  );
  const quoteStatusesHTML =
    uniqueQuotes.length && level <= 2
      ? uniqueQuotes
          .map((quote) => {
            const { id, instance } = quote;
            const sKey = statusKey(id, instance);
            const s = states.statuses[sKey];
            if (s) {
              return generateHTMLCode(s, instance, ++level);
            }
          })
          .join('')
      : '';

  const createdAtDate = new Date(createdAt);
  // const editedAtDate = editedAt && new Date(editedAt);

  const contentHTML =
    emojifyText(content, emojis) +
    '\n' +
    quoteStatusesHTML +
    '\n' +
    (poll?.options?.length
      ? `
        <p>📊:</p>
        <ul>
        ${poll.options
          .map(
            (option) => `
              <li>
                ${option.title}
                ${option.votesCount >= 0 ? ` (${option.votesCount})` : ''}
              </li>
            `,
          )
          .join('')}
        </ul>`
      : '') +
    (mediaAttachments.length > 0
      ? '\n' +
        mediaAttachments
          .map((media) => {
            const {
              description,
              meta,
              previewRemoteUrl,
              previewUrl,
              remoteUrl,
              url,
              type,
            } = media;
            const { original = {}, small } = meta || {};
            const width = small?.width || original?.width;
            const height = small?.height || original?.height;

            // Prefer remote over original
            const sourceMediaURL = remoteUrl || url;
            const previewMediaURL = previewRemoteUrl || previewUrl;
            const mediaURL = previewMediaURL || sourceMediaURL;

            const sourceMediaURLObj = sourceMediaURL
              ? new URL(sourceMediaURL)
              : null;
            const isVideoMaybe =
              type === 'unknown' &&
              sourceMediaURLObj &&
              /\.(mp4|m4r|m4v|mov|webm)$/i.test(sourceMediaURLObj.pathname);
            const isAudioMaybe =
              type === 'unknown' &&
              sourceMediaURLObj &&
              /\.(mp3|ogg|wav|m4a|m4p|m4b)$/i.test(sourceMediaURLObj.pathname);
            const isImage =
              type === 'image' ||
              (type === 'unknown' &&
                previewMediaURL &&
                !isVideoMaybe &&
                !isAudioMaybe);
            const isVideo = type === 'gifv' || type === 'video' || isVideoMaybe;
            const isAudio = type === 'audio' || isAudioMaybe;

            let mediaHTML = '';
            if (isImage) {
              mediaHTML = `<img src="${mediaURL}" width="${width}" height="${height}" alt="${description}" loading="lazy" />`;
            } else if (isVideo) {
              mediaHTML = `
                <video src="${sourceMediaURL}" width="${width}" height="${height}" controls preload="auto" poster="${previewMediaURL}" loading="lazy"></video>
                ${description ? `<figcaption>${description}</figcaption>` : ''}
              `;
            } else if (isAudio) {
              mediaHTML = `
                <audio src="${sourceMediaURL}" controls preload="auto"></audio>
                ${description ? `<figcaption>${description}</figcaption>` : ''}
              `;
            } else {
              mediaHTML = `
                <a href="${sourceMediaURL}">📄 ${
                description || sourceMediaURL
              }</a>
              `;
            }

            return `<figure>${mediaHTML}</figure>`;
          })
          .join('\n')
      : '');

  const htmlCode = `
    <blockquote lang="${language}" cite="${url}">
      ${
        spoilerText
          ? `
            <details>
              <summary>${spoilerText}</summary>
              ${contentHTML}
            </details>
          `
          : contentHTML
      }
      <footer>
        — ${emojifyText(
          displayName,
          accountEmojis,
        )} (@${acct}) <a href="${url}"><time datetime="${createdAtDate.toISOString()}">${createdAtDate.toLocaleString()}</time></a>
      </footer>
    </blockquote>
  `;

  return prettify(htmlCode);
}

function EmbedModal({ post, instance, onClose }) {
  const {
    account: {
      url: accountURL,
      displayName,
      username,
      emojis: accountEmojis,
      bot,
      group,
    },
    id,
    poll,
    spoilerText,
    language,
    editedAt,
    createdAt,
    content,
    mediaAttachments,
    url,
    emojis,
  } = post;

  const htmlCode = generateHTMLCode(post, instance);
  return (
    <div id="embed-post" class="sheet">
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" />
        </button>
      )}
      <header>
        <h2>Embed post</h2>
      </header>
      <main tabIndex="-1">
        <h3>HTML Code</h3>
        <textarea
          class="embed-code"
          readonly
          onClick={(e) => {
            e.target.select();
          }}
        >
          {htmlCode}
        </textarea>
        <button
          type="button"
          onClick={() => {
            try {
              navigator.clipboard.writeText(htmlCode);
              showToast('HTML code copied');
            } catch (e) {
              console.error(e);
              showToast('Unable to copy HTML code');
            }
          }}
        >
          <Icon icon="clipboard" /> <span>Copy</span>
        </button>
        {!!mediaAttachments?.length && (
          <section>
            <p>Media attachments:</p>
            <ol class="links-list">
              {mediaAttachments.map((media) => {
                return (
                  <li key={media.id}>
                    <a
                      href={media.remoteUrl || media.url}
                      target="_blank"
                      download
                    >
                      {media.remoteUrl || media.url}
                    </a>
                  </li>
                );
              })}
            </ol>
          </section>
        )}
        {!!accountEmojis?.length && (
          <section>
            <p>Account Emojis:</p>
            <ul>
              {accountEmojis.map((emoji) => {
                return (
                  <li key={emoji.shortcode}>
                    <picture>
                      <source
                        srcset={emoji.staticUrl}
                        media="(prefers-reduced-motion: reduce)"
                      ></source>
                      <img
                        class="shortcode-emoji emoji"
                        src={emoji.url}
                        alt={`:${emoji.shortcode}:`}
                        width="16"
                        height="16"
                        loading="lazy"
                        decoding="async"
                      />
                    </picture>{' '}
                    <code>:{emoji.shortcode}:</code> (
                    <a href={emoji.url} target="_blank" download>
                      url
                    </a>
                    )
                    {emoji.staticUrl ? (
                      <>
                        {' '}
                        (
                        <a href={emoji.staticUrl} target="_blank" download>
                          static
                        </a>
                        )
                      </>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        {!!emojis?.length && (
          <section>
            <p>Emojis:</p>
            <ul>
              {emojis.map((emoji) => {
                return (
                  <li key={emoji.shortcode}>
                    <picture>
                      <source
                        srcset={emoji.staticUrl}
                        media="(prefers-reduced-motion: reduce)"
                      ></source>
                      <img
                        class="shortcode-emoji emoji"
                        src={emoji.url}
                        alt={`:${emoji.shortcode}:`}
                        width="16"
                        height="16"
                        loading="lazy"
                        decoding="async"
                      />
                    </picture>{' '}
                    <code>:{emoji.shortcode}:</code> (
                    <a href={emoji.url} target="_blank" download>
                      url
                    </a>
                    )
                    {emoji.staticUrl ? (
                      <>
                        {' '}
                        (
                        <a href={emoji.staticUrl} target="_blank" download>
                          static
                        </a>
                        )
                      </>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        <section>
          <small>
            <p>Notes:</p>
            <ul>
              <li>
                This is static, unstyled and scriptless. You may need to apply
                your own styles and edit as needed.
              </li>
              <li>
                Polls are not interactive, becomes a list with vote counts.
              </li>
              <li>
                Media attachments can be images, videos, audios or any file
                types.
              </li>
              <li>Post could be edited or deleted later.</li>
            </ul>
          </small>
        </section>
        <h3>Preview</h3>
        <output
          class="embed-preview"
          dangerouslySetInnerHTML={{ __html: htmlCode }}
        />
        <p>
          <small>Note: This preview is lightly styled.</small>
        </p>
      </main>
    </div>
  );
}

function StatusButton({
  checked,
  count,
  class: className,
  title,
  alt,
  size,
  icon,
  iconSize = 'l',
  onClick,
  ...props
}) {
  if (typeof title === 'string') {
    title = [title, title];
  }
  if (typeof alt === 'string') {
    alt = [alt, alt];
  }

  const [buttonTitle, setButtonTitle] = useState(title[0] || '');
  const [iconAlt, setIconAlt] = useState(alt[0] || '');

  useEffect(() => {
    if (checked) {
      setButtonTitle(title[1] || '');
      setIconAlt(alt[1] || '');
    } else {
      setButtonTitle(title[0] || '');
      setIconAlt(alt[0] || '');
    }
  }, [checked, title, alt]);

  return (
    <button
      type="button"
      title={buttonTitle}
      class={`plain ${size ? 'small' : ''} ${className} ${
        checked ? 'checked' : ''
      }`}
      onClick={(e) => {
        if (!onClick) return;
        e.preventDefault();
        e.stopPropagation();
        onClick(e);
      }}
      {...props}
    >
      <Icon icon={icon} size={iconSize} alt={iconAlt} />
      {!!count && (
        <>
          {' '}
          <small title={count}>{shortenNumber(count)}</small>
        </>
      )}
    </button>
  );
}

function nicePostURL(url) {
  if (!url) return;
  const urlObj = new URL(url);
  const { host, pathname } = urlObj;
  const path = pathname.replace(/\/$/, '');
  // split only first slash
  const [_, username, restPath] = path.match(/\/(@[^\/]+)\/(.*)/) || [];
  return (
    <>
      {punycode.toUnicode(host)}
      {username ? (
        <>
          /{username}
          <wbr />
          <span class="more-insignificant">/{restPath}</span>
        </>
      ) : (
        <span class="more-insignificant">{path}</span>
      )}
    </>
  );
}

function StatusCompact({ sKey }) {
  const snapStates = useSnapshot(states);
  const statusReply = snapStates.statusReply[sKey];
  if (!statusReply) return null;

  const { id, instance } = statusReply;
  const status = getStatus(id, instance);
  if (!status) return null;

  const {
    sensitive,
    spoilerText,
    account: { avatar, avatarStatic, bot },
    visibility,
    content,
    language,
    filtered,
  } = status;
  if (sensitive || spoilerText) return null;
  if (!content) return null;

  const srKey = statusKey(id, instance);
  const statusPeekText = statusPeek(status);

  const filterContext = useContext(FilterContext);
  const filterInfo = isFiltered(filtered, filterContext);

  if (filterInfo?.action === 'hide') return null;

  const filterTitleStr = filterInfo?.titlesStr || '';

  return (
    <article
      class={`status compact-reply ${
        visibility === 'direct' ? 'visibility-direct' : ''
      }`}
      tabindex="-1"
      data-state-post-id={srKey}
    >
      <Avatar url={avatarStatic || avatar} squircle={bot} />
      <div
        class="content-compact"
        title={statusPeekText}
        lang={language}
        dir="auto"
      >
        {filterInfo ? (
          <b class="status-filtered-badge badge-meta" title={filterTitleStr}>
            <span>Filtered</span>
            <span>{filterTitleStr}</span>
          </b>
        ) : (
          <span>{statusPeekText}</span>
        )}
      </div>
    </article>
  );
}

function FilteredStatus({
  status,
  filterInfo,
  instance,
  containerProps = {},
  showFollowedTags,
  quoted,
}) {
  const snapStates = useSnapshot(states);
  const {
    id: statusID,
    account: { avatar, avatarStatic, bot, group },
    createdAt,
    visibility,
    reblog,
  } = status;
  const isReblog = !!reblog;
  const filterTitleStr = filterInfo?.titlesStr || '';
  const createdAtDate = new Date(createdAt);
  const statusPeekText = statusPeek(status.reblog || status);

  const [showPeek, setShowPeek] = useState(false);
  const bindLongPressPeek = useLongPress(
    () => {
      setShowPeek(true);
    },
    {
      threshold: 600,
      captureEvent: true,
      detect: 'touch',
      cancelOnMovement: 2, // true allows movement of up to 25 pixels
    },
  );

  const statusPeekRef = useTruncated();
  const sKey = statusKey(status.id, instance);
  const ssKey =
    statusKey(status.id, instance) +
    ' ' +
    (statusKey(reblog?.id, instance) || '');

  const actualStatusID = reblog?.id || statusID;
  const url = instance
    ? `/${instance}/s/${actualStatusID}`
    : `/s/${actualStatusID}`;
  const isFollowedTags =
    showFollowedTags && !!snapStates.statusFollowedTags[sKey]?.length;

  return (
    <div
      class={
        quoted
          ? ''
          : isReblog
          ? group
            ? 'status-group'
            : 'status-reblog'
          : isFollowedTags
          ? 'status-followed-tags'
          : ''
      }
      {...containerProps}
      // title={statusPeekText}
      onContextMenu={(e) => {
        e.preventDefault();
        setShowPeek(true);
      }}
      {...bindLongPressPeek()}
    >
      <article
        data-state-post-id={ssKey}
        class={`status filtered ${quoted ? 'status-card' : ''}`}
        tabindex="-1"
      >
        <b
          class="status-filtered-badge clickable badge-meta"
          title={filterTitleStr}
          onClick={(e) => {
            e.preventDefault();
            setShowPeek(true);
          }}
        >
          <span>Filtered</span>
          <span>{filterTitleStr}</span>
        </b>{' '}
        <Avatar url={avatarStatic || avatar} squircle={bot} />
        <span class="status-filtered-info">
          <span class="status-filtered-info-1">
            <NameText account={status.account} instance={instance} />{' '}
            <Icon
              icon={visibilityIconsMap[visibility]}
              alt={visibilityText[visibility]}
              size="s"
            />{' '}
            {isReblog ? (
              'boosted'
            ) : isFollowedTags ? (
              <span>
                {snapStates.statusFollowedTags[sKey].slice(0, 3).map((tag) => (
                  <span key={tag} class="status-followed-tag-item">
                    #{tag}
                  </span>
                ))}
              </span>
            ) : (
              <RelativeTime datetime={createdAtDate} format="micro" />
            )}
          </span>
          <span class="status-filtered-info-2">
            {isReblog && (
              <>
                <Avatar
                  url={reblog.account.avatarStatic || reblog.account.avatar}
                  squircle={bot}
                />{' '}
              </>
            )}
            {statusPeekText}
          </span>
        </span>
      </article>
      {!!showPeek && (
        <Modal
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPeek(false);
            }
          }}
        >
          <div id="filtered-status-peek" class="sheet">
            <button
              type="button"
              class="sheet-close"
              onClick={() => setShowPeek(false)}
            >
              <Icon icon="x" />
            </button>
            <header>
              <b class="status-filtered-badge">Filtered</b> {filterTitleStr}
            </header>
            <main tabIndex="-1">
              <Link
                ref={statusPeekRef}
                class="status-link"
                to={url}
                onClick={() => {
                  setShowPeek(false);
                }}
                data-read-more="Read more →"
              >
                <Status status={status} instance={instance} size="s" readOnly />
              </Link>
            </main>
          </div>
        </Modal>
      )}
    </div>
  );
}

const QuoteStatuses = memo(({ id, instance, level = 0 }) => {
  if (!id || !instance) return;
  const snapStates = useSnapshot(states);
  const sKey = statusKey(id, instance);
  const quotes = snapStates.statusQuotes[sKey];
  const uniqueQuotes = quotes?.filter(
    (q, i, arr) => arr.findIndex((q2) => q2.url === q.url) === i,
  );

  if (!uniqueQuotes?.length) return;
  if (level > 2) return;

  return uniqueQuotes.map((q) => {
    return (
      <LazyShazam id={q.instance + q.id}>
        <Link
          key={q.instance + q.id}
          to={`${q.instance ? `/${q.instance}` : ''}/s/${q.id}`}
          class="status-card-link"
          data-read-more="Read more →"
        >
          <Status
            statusID={q.id}
            instance={q.instance}
            size="s"
            quoted={level + 1}
            enableCommentHint
          />
        </Link>
      </LazyShazam>
    );
  });
});

export default memo(Status, (oldProps, newProps) => {
  // Shallow equal all props except 'status'
  // This will be pure static until status ID changes
  const { status, ...restOldProps } = oldProps;
  const { status: newStatus, ...restNewProps } = newProps;
  return (
    status?.id === newStatus?.id && shallowEqual(restOldProps, restNewProps)
  );
});
