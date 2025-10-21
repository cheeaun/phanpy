import './status.css';

import { msg, plural } from '@lingui/core/macro';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { ControlledMenu, MenuDivider, MenuItem } from '@szhsin/react-menu';
import { shallowEqual } from 'fast-equals';
import PQueue from 'p-queue';
import { Fragment } from 'preact';
import { memo } from 'preact/compat';
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'preact/hooks';
import punycode from 'punycode/';
import { useHotkeys } from 'react-hotkeys-hook';
import { useLongPress } from 'use-long-press';
import { useSnapshot } from 'valtio';

import { api, getPreferences } from '../utils/api';
import { langDetector } from '../utils/browser-translator';
import { useEditHistory } from '../utils/edit-history-context';
import FilterContext from '../utils/filter-context';
import { isFiltered } from '../utils/filters';
import getTranslateTargetLanguage from '../utils/get-translate-target-language';
import getHTMLText from '../utils/getHTMLText';
import htmlContentLength from '../utils/html-content-length';
import localeMatch from '../utils/locale-match';
import mem from '../utils/mem';
import niceDateTime from '../utils/nice-date-time';
import openCompose from '../utils/open-compose';
import pmem from '../utils/pmem';
import {
  getPostQuoteApprovalPolicy,
  supportsNativeQuote,
} from '../utils/quote-utils';
import RTF from '../utils/relative-time-format';
import safeBoundingBoxPadding from '../utils/safe-bounding-box-padding';
import shortenNumber from '../utils/shorten-number';
import showCompose from '../utils/show-compose';
import showToast from '../utils/show-toast';
import { speak, supportsTTS } from '../utils/speech';
import states, { getStatus, saveStatus, statusKey } from '../utils/states';
import statusPeek from '../utils/status-peek';
import { getAPIVersions, getCurrentAccID } from '../utils/store-utils';
import supports from '../utils/supports';
import useTruncated from '../utils/useTruncated';
import visibilityIconsMap from '../utils/visibility-icons-map';
import visibilityText from '../utils/visibility-text';

import Avatar from './avatar';
import CustomEmoji from './custom-emoji';
import EmojiText from './emoji-text';
import Icon from './icon';
import LazyShazam from './lazy-shazam';
import Link from './link';
import Loader from './loader';
import MathBlock from './math-block';
import Media, { isMediaCaptionLong } from './media';
import MediaFirstContainer from './media-first-container';
import MenuConfirm from './menu-confirm';
import MenuLink from './menu-link';
import Menu2 from './menu2';
import Modal from './modal';
import MultipleMediaFigure from './multiple-media-figure';
import NameText from './name-text';
import Poll from './poll';
import PostContent from './post-content';
import PostEmbedModal from './post-embed-modal';
import QuoteSettingsSheet from './quote-settings-sheet';
import QuotesModal from './quotes-modal';
import RelativeTime from './relative-time';
import StatusButton from './status-button';
import StatusCard from './status-card';
import StatusCompact from './status-compact';
import SubMenu2 from './submenu2';
import ThreadBadge from './thread-badge';
import TranslationBlock from './translation-block';

const SHOW_COMMENT_COUNT_LIMIT = 280;
const INLINE_TRANSLATE_LIMIT = 140;

const accountQueue = new PQueue({
  concurrency: 1,
  interval: 1000,
  intervalCap: 1,
});
function fetchAccount(id, masto, signal) {
  return accountQueue.add(() => masto.v1.accounts.$select(id).fetch(), {
    signal,
  });
}
const memFetchAccount = pmem(fetchAccount);

const isIOS =
  window.ontouchstart !== undefined &&
  /iPad|iPhone|iPod/.test(navigator.userAgent);

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
function getPostText(status, opts) {
  const {
    maskCustomEmojis,
    maskURLs,
    hideInlineQuote,
    htmlTextOpts = {},
  } = opts || {};
  const { spoilerText, poll, emojis } = status;
  let { content } = status;
  if (maskCustomEmojis && emojis?.length) {
    const emojisRegex = new RegExp(
      `:(${emojis.map((e) => e.shortcode).join('|')}):`,
      'g',
    );
    content = content.replace(emojisRegex, '⬚');
  }
  return (
    (spoilerText ? `${spoilerText}\n\n` : '') +
    getHTMLText(content, {
      ...htmlTextOpts,
      preProcess:
        (maskURLs || hideInlineQuote) &&
        ((dom) => {
          // Remove links that contains text that starts with https?://
          if (maskURLs) {
            for (const a of dom.querySelectorAll('a')) {
              const text = a.innerText.trim();
              if (/^https?:\/\//i.test(text)) {
                a.replaceWith('«🔗»');
              }
            }
          }
          // Hide inline quote
          if (hideInlineQuote) {
            const reContainer = dom.querySelector('.quote-inline');
            if (reContainer) {
              reContainer.remove();
            }
          }
        }),
    }) +
    getPollText(poll)
  );
}

function forgivingQSA(selectors = [], dom = document) {
  // Run QSA for list of selectors
  // If a selector return invalid selector error, try the next one
  for (const selector of selectors) {
    try {
      return dom.querySelectorAll(selector);
    } catch (e) {}
  }
  return [];
}

const getHTMLTextForDetectLang = mem((content, emojis) => {
  if (!content) return '';
  if (emojis?.length) {
    const emojisRegex = new RegExp(
      `:(${emojis.map((e) => e.shortcode).join('|')}):`,
      'g',
    );
    content = content.replace(emojisRegex, '');
  }
  content = content.trim();
  if (!content) return '';
  return getHTMLText(content, {
    preProcess: (dom) => {
      // Remove anything that can skew the language detection

      // Remove .mention, .hashtag, pre, code, a:has(.invisible)
      for (const a of forgivingQSA(
        [
          '.mention, .hashtag, pre, code, a:has(.invisible)',
          '.mention, .hashtag, pre, code',
        ],
        dom,
      )) {
        a.remove();
      }

      // Remove links that contains text that starts with https?://
      for (const a of dom.querySelectorAll('a')) {
        const text = a.innerText.trim();
        if (text.startsWith('https://') || text.startsWith('http://')) {
          a.remove();
        }
      }
    },
  });
});

function isTranslateble(content, emojis) {
  return !!getHTMLTextForDetectLang(content, emojis);
}

const SIZE_CLASS = {
  s: 'small',
  m: 'medium',
  l: 'large',
};

const detectLang = pmem(async (text) => {
  text = text?.trim();

  // Ref: https://github.com/komodojp/tinyld/blob/develop/docs/benchmark.md
  // 500 should be enough for now, also the default max chars for Mastodon
  if (text?.length > 500) {
    return null;
  }

  if (langDetector) {
    const langs = await langDetector.detect(text);
    console.groupCollapsed(
      '💬 DETECTLANG BROWSER',
      langs.slice(0, 3).map((l) => l.detectedLanguage),
    );
    console.log(text, langs.slice(0, 3));
    console.groupEnd();
    const lang = langs[0];
    if (lang?.detectedLanguage && lang?.confidence > 0.5) {
      return lang.detectedLanguage;
    }
  }

  const { detectAll } = await import('tinyld/light');
  const langs = detectAll(text);
  console.groupCollapsed(
    '💬 DETECTLANG TINYLD',
    langs.slice(0, 3).map((l) => l.lang),
  );
  console.log(text, langs.slice(0, 3));
  console.groupEnd();
  const lang = langs[0];
  if (lang?.lang && lang?.accuracy > 0.5) {
    // If > 50% accurate, use it
    // It can be accurate if < 50% but better be safe
    // Though > 50% also can be inaccurate 🤷‍♂️
    return lang.lang;
  }
  return null;
});

const readMoreText = msg`Read more →`;

// All this work just to make sure this only lazy-run once
// Because first run is slow due to intl-localematcher
const DIFFERENT_LANG_CHECK = {};
const diffLangCheckCacheKey = (l, hls) => `${l}:${hls.join('|')}`;
const checkDifferentLanguage = (
  language,
  contentTranslationHideLanguages = [],
) => {
  if (!language) return false;
  const cacheKey = diffLangCheckCacheKey(
    language,
    contentTranslationHideLanguages,
  );
  const targetLanguage = getTranslateTargetLanguage(true);
  const different =
    language !== targetLanguage &&
    !localeMatch([language], [targetLanguage]) &&
    !contentTranslationHideLanguages.find(
      (l) => language === l || localeMatch([language], [l]),
    );
  if (different) {
    DIFFERENT_LANG_CHECK[cacheKey] = true;
  }
  return different;
};

const quoteMessages = {
  quotePrivate: msg`Private posts cannot be quoted`,
  requestQuote: msg`Request to quote`,
  quoteManualReview: msg`Author will manually review`,
  quoteFollowersOnly: msg`Only followers can quote this post`,
  quoteCannot: msg`You are not allowed to quote this post`,
};

const quoteApprovalPolicyMessages = {
  public: msg`Anyone can quote`,
  followers: msg`Your followers can quote`,
  nobody: msg`Only you can quote`,
};

const QUESTION_REGEX = /[??？︖❓❔⁇⁈⁉¿‽؟]/;

const { DEV } = import.meta.env;

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
  allowFilters,
  onMediaClick,
  quoted,
  quoteDomain,
  onStatusLinkClick = () => {},
  showFollowedTags,
  allowContextMenu,
  showActionsBar,
  showReplyParent,
  mediaFirst,
  showCommentCount: forceShowCommentCount,
}) {
  const { _, t, i18n } = useLingui();
  const rtf = RTF(i18n.locale);

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

  // const originalStatus = useRef(status);
  const { editHistoryRef, editHistoryMode, editedAtIndex } = useEditHistory();
  if (editHistoryMode && status?.editedAt && editHistoryRef.current.length) {
    const eStatus = editHistoryRef.current[editedAtIndex];
    if (eStatus) {
      status = {
        ...status,
        ...eStatus,
      };
    }
  } else {
    // Revert back to original status
    // Don't need to do anything, re-render will use the original status above
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
    } = {},
    id,
    repliesCount,
    reblogged,
    reblogsCount,
    favourited,
    favouritesCount,
    quotesCount,
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
    mediaAttachments = [],
    reblog,
    quote,
    uri,
    url,
    emojis,
    tags,
    pinned,
    quoteApproval,
    // Non-API props
    _deleted,
    _pinned,
    // _filtered,
    // Non-Mastodon
    emojiReactions,
  } = status;

  const [languageAutoDetected, setLanguageAutoDetected] = useState(null);
  useEffect(() => {
    if (!content) return;
    if (_language) return;
    if (languageAutoDetected) return;
    let timer;
    timer = setTimeout(async () => {
      let detected = await detectLang(
        getHTMLTextForDetectLang(content, emojis),
      );
      setLanguageAutoDetected(detected);
    }, 1000);
    return () => clearTimeout(timer);
  }, [content, _language]);
  const language = _language || languageAutoDetected;

  // if (!mediaAttachments?.length) mediaFirst = false;
  const hasMediaAttachments = !!mediaAttachments?.length;
  if (mediaFirst && hasMediaAttachments) size = 's';

  const currentAccount = getCurrentAccID();
  const isSelf = currentAccount && currentAccount === accountId;

  const filterContext = useContext(FilterContext);
  const filterInfo =
    !isSelf &&
    ((!readOnly && !previewMode) || allowFilters) &&
    isFiltered(filtered, filterContext);

  if (filterInfo?.action === 'hide') {
    return null;
  }

  console.debug('RENDER Status', id, status?.account?.displayName, quoted);

  const debugHover = (e) => {
    if (e.shiftKey) {
      console.log({
        ...status,
      });
    }
  };

  if (
    (allowFilters || size !== 'l') &&
    filterInfo &&
    filterInfo.action !== 'blur'
  ) {
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
  useEffect(() => {
    if (!withinContext && !inReplyToAccount && inReplyToAccountId) {
      const account = states.accounts[inReplyToAccountId];
      if (account) {
        setInReplyToAccount(account);
        return;
      }

      const abortController = new AbortController();
      memFetchAccount(inReplyToAccountId, masto, abortController.signal)
        .then((account) => {
          setInReplyToAccount(account);
          states.accounts[account.id] = account;
        })
        .catch((e) => {});

      return () => {
        abortController.abort();
      };
    }
  }, [withinContext, inReplyToAccount, inReplyToAccountId]);
  const mentionSelf =
    (inReplyToAccountId && inReplyToAccountId === currentAccount) ||
    mentions?.find((mention) => mention.id === currentAccount);

  const prefs = getPreferences();
  const readingExpandSpoilers = !!prefs['reading:expand:spoilers'];

  // default | show_all | hide_all
  // Ignore hide_all because it means hide *ALL* media including non-sensitive ones
  const readingExpandMedia =
    prefs['reading:expand:media']?.toLowerCase() || 'default';

  // FOR TESTING:
  // const readingExpandSpoilers = true;
  // const readingExpandMedia = 'show_all';
  const showSpoiler =
    previewMode || readingExpandSpoilers || !!snapStates.spoilers[id];
  const showSpoilerMedia =
    previewMode ||
    (readingExpandMedia === 'show_all' && filterInfo?.action !== 'blur') ||
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
            <Icon icon="group" size="l" alt={t`Group`} />{' '}
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
          <Trans>
            <NameText account={status.account} instance={instance} showAvatar />{' '}
            <span>boosted</span>
          </Trans>
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

  const contentLength = useMemo(() => htmlContentLength(content), [content]);

  const [forceTranslate, setForceTranslate] = useState(_forceTranslate);
  // const targetLanguage = getTranslateTargetLanguage(true);
  // const contentTranslationHideLanguages =
  //   snapStates.settings.contentTranslationHideLanguages || [];
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
      card /*||
      mediaAttachments?.length*/
    ) {
      return false;
    }
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
    contentLength,
  ]);

  const [showEdited, setShowEdited] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);
  const [showQuoteSettings, setShowQuoteSettings] = useState(false);
  const [showQuotes, setShowQuotes] = useState(false);

  const spoilerContentRef = useTruncated();
  const contentRef = useTruncated();
  const mediaContainerRef = useTruncated();

  const statusRef = useRef(null);
  const [reloadPostContentCount, reloadPostContent] = useReducer(
    (c) => c + 1,
    0,
  );

  const unauthInteractionErrorMessage = t`Sorry, your current logged-in instance can't interact with this post from another instance.`;

  const textWeight = useCallback(
    () =>
      Math.max(
        Math.round(((spoilerText?.length || 0) + contentLength) / 140) || 1,
        1,
      ),
    [spoilerText, contentLength],
  );

  const createdDateText = createdAt && niceDateTime(createdAtDate);
  const editedDateText = editedAt && niceDateTime(editedAtDate);

  // Can boost if:
  // - authenticated AND
  // - visibility != direct OR
  // - visibility = private AND isSelf
  const isPublic = ['public', 'unlisted'].includes(visibility);
  let canBoost = authenticated && isPublic;
  if (visibility === 'private' && isSelf) {
    canBoost = true;
  }

  // Quote logic blatantly copied from https://github.com/mastodon/mastodon/blob/854aaec6fe69df02e6d850cb90eef37032b4d72f/app/javascript/mastodon/components/status/boost_button_utils.ts#L131-L163
  let quoteDisabled = false;
  let quoteText = t`Quote`;
  let quoteMetaText;

  if (supportsNativeQuote()) {
    const isMine = isSelf;
    const isMineAndPrivate = isMine && visibility === 'private';
    const isQuoteAutomaticallyAccepted =
      quoteApproval?.currentUser === 'automatic' &&
      (isPublic || isMineAndPrivate);
    const isQuoteManuallyAccepted =
      quoteApproval?.currentUser === 'manual' && (isPublic || isMineAndPrivate);
    const isQuoteFollowersOnly =
      quoteApproval?.automatic?.[0] === 'followers' ||
      quoteApproval?.manual?.[0] === 'followers';
    if (!isPublic && !isMine) {
      quoteDisabled = true;
      quoteMetaText = _(quoteMessages.quotePrivate);
    } else if (isQuoteAutomaticallyAccepted) {
      // No need to do anything
    } else if (isQuoteManuallyAccepted) {
      quoteText = _(quoteMessages.requestQuote);
      quoteMetaText = _(quoteMessages.quoteManualReview);
    } else {
      quoteDisabled = true;
      quoteMetaText = isQuoteFollowersOnly
        ? _(quoteMessages.quoteFollowersOnly)
        : _(quoteMessages.quoteCannot);
    }
  }
  const canQuote = supportsNativeQuote() && !quoteDisabled;

  const postQuoteApprovalPolicy = getPostQuoteApprovalPolicy(quoteApproval);

  const replyStatus = (e, replyMode = 'all') => {
    if (!sameInstance || !authenticated) {
      return alert(unauthInteractionErrorMessage);
    }
    // syntheticEvent comes from MenuItem
    if (e?.shiftKey || e?.syntheticEvent?.shiftKey) {
      const newWin = openCompose({
        replyToStatus: status,
        replyMode,
      });
      if (newWin) return;
    }
    showCompose({
      replyToStatus: status,
      replyMode,
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

  // const boostStatus = async () => {
  //   if (!sameInstance || !authenticated) {
  //     alert(unauthInteractionErrorMessage);
  //     return false;
  //   }
  //   try {
  //     if (!reblogged) {
  //       let confirmText = 'Boost this post?';
  //       if (mediaNoDesc) {
  //         confirmText += '\n\n⚠️ Some media have no descriptions.';
  //       }
  //       const yes = confirm(confirmText);
  //       if (!yes) {
  //         return false;
  //       }
  //     }
  //     // Optimistic
  //     states.statuses[sKey] = {
  //       ...status,
  //       reblogged: !reblogged,
  //       reblogsCount: reblogsCount + (reblogged ? -1 : 1),
  //     };
  //     if (reblogged) {
  //       const newStatus = await masto.v1.statuses.$select(id).unreblog();
  //       saveStatus(newStatus, instance);
  //       return true;
  //     } else {
  //       const newStatus = await masto.v1.statuses.$select(id).reblog();
  //       saveStatus(newStatus, instance);
  //       return true;
  //     }
  //   } catch (e) {
  //     console.error(e);
  //     // Revert optimistism
  //     states.statuses[sKey] = status;
  //     return false;
  //   }
  // };
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
            ? t`Unliked @${username || acct}'s post`
            : t`Liked @${username || acct}'s post`,
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
            ? t`Unbookmarked @${username || acct}'s post`
            : t`Bookmarked @${username || acct}'s post`,
        );
      }
    } catch (e) {}
  };

  // const differentLanguage =
  //   !!language &&
  //   language !== targetLanguage &&
  //   !localeMatch([language], [targetLanguage]) &&
  //   !contentTranslationHideLanguages.find(
  //     (l) => language === l || localeMatch([language], [l]),
  //   );
  const contentTranslationHideLanguages =
    snapStates.settings.contentTranslationHideLanguages || [];
  const [differentLanguage, setDifferentLanguage] = useState(
    DIFFERENT_LANG_CHECK[
      diffLangCheckCacheKey(language, contentTranslationHideLanguages)
    ],
  );
  useEffect(() => {
    if (!language || differentLanguage) {
      return;
    }
    if (
      !differentLanguage &&
      DIFFERENT_LANG_CHECK[
        diffLangCheckCacheKey(language, contentTranslationHideLanguages)
      ]
    ) {
      setDifferentLanguage(true);
      return;
    }
    let timeout = setTimeout(() => {
      const different = checkDifferentLanguage(
        language,
        contentTranslationHideLanguages,
      );
      if (different) setDifferentLanguage(different);
    }, 100);
    return () => clearTimeout(timeout);
  }, [language, differentLanguage]);

  const reblogIterator = useRef();
  const favouriteIterator = useRef();
  async function fetchBoostedLikedByAccounts(firstLoad) {
    if (firstLoad) {
      reblogIterator.current = masto.v1.statuses
        .$select(statusID)
        .rebloggedBy.list({
          limit: REACTIONS_LIMIT,
        })
        .values();
      favouriteIterator.current = masto.v1.statuses
        .$select(statusID)
        .favouritedBy.list({
          limit: REACTIONS_LIMIT,
        })
        .values();
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

  const isQuotingMyPost =
    quote?.state === 'accepted' &&
    quote?.quotedStatus?.account?.id === currentAccount;

  const actionsRef = useRef();
  const isPinnable = ['public', 'unlisted', 'private'].includes(visibility);
  const menuFooter =
    mediaNoDesc && !reblogged ? (
      <div class="footer">
        <Icon icon="alert" />
        <Trans>Some media have no descriptions.</Trans>
      </div>
    ) : (
      statusMonthsAgo >= 3 && (
        <div class="footer">
          <Icon icon="info" />
          <span>
            <Trans>
              Old post (<strong>{rtf.format(-statusMonthsAgo, 'month')}</strong>
              )
            </Trans>
          </span>
        </div>
      )
    );
  const mentionsCount = useMemo(() => {
    if (!mentions?.length) return false;
    const allMentions = new Set([accountId, ...mentions.map((m) => m.id)]);
    return [...allMentions].filter((m) => m !== currentAccount).length;
  }, [accountId, mentions?.length, currentAccount]);
  const tooManyMentions = mentionsCount > 3;
  const ReplyMenuContent = () => (
    <>
      <Icon icon="comment" />
      <span>
        {repliesCount > 0
          ? shortenNumber(repliesCount)
          : tooManyMentions
            ? t`Reply…`
            : t`Reply`}
      </span>
    </>
  );
  const replyModeMenuItems = (
    <>
      <MenuItem onClick={(e) => replyStatus(e, 'all')}>
        <small>
          <Trans>Reply all</Trans>
          <br />
          <span class="more-insignificant">
            <Plural value={mentionsCount} other="# mentions" />
          </span>
        </small>
      </MenuItem>
      <MenuItem onClick={(e) => replyStatus(e, 'author-first')}>
        <small>
          <Trans>Reply all</Trans>
          <br />
          <span class="more-insignificant">
            <Plural
              value={mentionsCount - 1}
              other={
                <Trans comment="Author mention appears first, other mentions appear below with newlines in between">
                  <span class="bidi-isolate">@{username || acct}</span> first, #
                  others below
                </Trans>
              }
            />
          </span>
        </small>
      </MenuItem>
      <MenuItem onClick={(e) => replyStatus(e, 'author-only')}>
        <small>
          <Trans>Reply</Trans>
          <br />
          <span class="more-insignificant">
            <Trans>
              Only <span class="bidi-isolate">@{username || acct}</span>
            </Trans>
          </span>
        </small>
      </MenuItem>
    </>
  );
  const StatusMenuItems = (
    <>
      {!isSizeLarge && sameInstance && (
        <>
          <div class="menu-control-group-horizontal status-menu">
            {tooManyMentions ? (
              <SubMenu2
                openTrigger="clickOnly"
                direction="bottom"
                overflow="auto"
                gap={-8}
                shift={8}
                menuClassName="menu-emphasized"
                label={<ReplyMenuContent />}
              >
                {replyModeMenuItems}
              </SubMenu2>
            ) : (
              <MenuItem onClick={replyStatus}>{<ReplyMenuContent />}</MenuItem>
            )}
            <MenuConfirm
              subMenu
              confirmLabel={
                <>
                  <Icon icon="rocket" />
                  <span>{reblogged ? t`Unboost` : t`Boost`}</span>
                </>
              }
              className={`menu-reblog ${reblogged ? 'checked' : ''}`}
              menuExtras={
                <>
                  {supportsNativeQuote() && (
                    <MenuItem
                      disabled={quoteDisabled}
                      onClick={() => {
                        showCompose({
                          quoteStatus: status,
                        });
                      }}
                    >
                      <Icon icon="quote" />
                      {quoteMetaText ? (
                        <small>
                          {quoteText}
                          <br />
                          {quoteMetaText}
                        </small>
                      ) : (
                        <span>{quoteText}</span>
                      )}
                    </MenuItem>
                  )}
                  {(DEV || !supportsNativeQuote()) && (
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
                      <span>
                        <Trans>Quote with link</Trans>
                      </span>
                      {supportsNativeQuote() && DEV && (
                        <small class="tag collapsed">DEV</small>
                      )}
                    </MenuItem>
                  )}
                </>
              }
              menuFooter={menuFooter}
              disabled={!canBoost}
              onClick={async () => {
                try {
                  const done = await confirmBoostStatus();
                  if (!isSizeLarge && done) {
                    showToast(
                      reblogged
                        ? t`Unboosted @${username || acct}'s post`
                        : t`Boosted @${username || acct}'s post`,
                    );
                  }
                } catch (e) {}
              }}
            >
              {canQuote ? (
                <span class="icon">
                  <Icon icon="rocket" />
                  <Icon icon="quote" />
                </span>
              ) : (
                <Icon icon="rocket" />
              )}
              <span>
                {reblogsCount > 0 || quotesCount > 0
                  ? `${reblogsCount > 0 ? shortenNumber(reblogsCount) : ''}${
                      reblogsCount > 0 && quotesCount > 0 ? '+' : ''
                    }${quotesCount > 0 ? shortenNumber(quotesCount) : ''}`
                  : reblogged
                    ? t`Unboost`
                    : canQuote
                      ? t`Boost/Quote…`
                      : t`Boost…`}
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
                    ? t`Unlike`
                    : t`Like`}
              </span>
            </MenuItem>
            {supports('@mastodon/post-bookmark') && (
              <MenuItem
                onClick={bookmarkStatusNotify}
                className={`menu-bookmark ${bookmarked ? 'checked' : ''}`}
              >
                <Icon icon="bookmark" />
                <span>{bookmarked ? t`Unbookmark` : t`Bookmark`}</span>
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
                heading: t`Boosted/Liked by…`,
                fetchAccounts: fetchBoostedLikedByAccounts,
                instance,
                showReactions: true,
                postID: sKey,
              };
            }}
          >
            <Icon icon="react" />
            <span>
              <Trans>Boosted/Liked by…</Trans>
            </span>
          </MenuItem>
          {supportsNativeQuote() && (
            <MenuItem
              onClick={() => {
                setShowQuotes(true);
              }}
            >
              <Icon icon="quote" />
              <span>
                <Trans>View Quotes</Trans>
              </span>
            </MenuItem>
          )}
        </>
      )}
      {(isSizeLarge ||
        (!mediaFirst &&
          (enableTranslate || !language || differentLanguage))) && (
        <MenuDivider />
      )}
      {!mediaFirst && (enableTranslate || !language || differentLanguage) && (
        <div class={supportsTTS ? 'menu-horizontal' : ''}>
          {enableTranslate ? (
            <MenuItem
              disabled={forceTranslate}
              onClick={() => setForceTranslate(true)}
            >
              <Icon icon="translate" />
              <span>
                <Trans>Translate</Trans>
              </span>
            </MenuItem>
          ) : (
            <MenuLink
              to={`${instance ? `/${instance}` : ''}/s/${id}?translate=1`}
            >
              <Icon icon="translate" />
              <span>
                <Trans>Translate</Trans>
              </span>
            </MenuLink>
          )}
          {supportsTTS && (
            <MenuItem
              onClick={() => {
                try {
                  const postText = getPostText(status, {
                    hideInlineQuote: supportsNativeQuote(),
                  });
                  if (postText) {
                    speak(postText, language);
                  }
                } catch (error) {
                  console.error('Failed to speak text:', error);
                }
              }}
            >
              <Icon icon="speak" />
              <span>
                <Trans>Speak</Trans>
              </span>
            </MenuItem>
          )}
        </div>
      )}
      {isSizeLarge && (
        <MenuItem
          onClick={() => {
            try {
              const postText = getPostText(status, {
                hideInlineQuote: supportsNativeQuote(),
                htmlTextOpts: {
                  truncateLinks: false,
                },
              });
              navigator.clipboard.writeText(postText);
              showToast(t`Post text copied`);
            } catch (e) {
              console.error(e);
              showToast(t`Unable to copy post text`);
            }
          }}
        >
          <Icon icon="clipboard" />
          <span>
            <Trans>Copy post text</Trans>
          </span>
        </MenuItem>
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
              <Trans>
                View post by{' '}
                <span class="bidi-isolate">@{username || acct}</span>
              </Trans>
              <br />
              <span class="more-insignificant">
                {_(visibilityText[visibility])} • {createdDateText}
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
              <Trans>Show Edit History</Trans>
              <br />
              <span class="more-insignificant">
                <Trans>Edited: {editedDateText}</Trans>
              </span>
            </small>
          </MenuItem>
        </>
      )}
      <MenuItem href={url} target="_blank">
        <Icon icon="external" />
        <small
          class="menu-double-lines should-cloak"
          style={{
            maxWidth: '16em',
          }}
        >
          {nicePostURL(url)}
        </small>
      </MenuItem>
      <div class="menu-horizontal">
        <MenuItem
          onClick={() => {
            // Copy url to clipboard
            try {
              navigator.clipboard.writeText(url);
              showToast(t`Link copied`);
            } catch (e) {
              console.error(e);
              showToast(t`Unable to copy link`);
            }
          }}
        >
          <Icon icon="link" />
          <span>
            <Trans>Copy</Trans>
          </span>
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
                  alert(t`Sharing doesn't seem to work.`);
                }
              }}
            >
              <Icon icon="share" />
              <span>
                <Trans>Share…</Trans>
              </span>
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
          <span>
            <Trans>Embed post</Trans>
          </span>
        </MenuItem>
      )}
      {authenticated && (
        <>
          {(isSelf || mentionSelf) && <MenuDivider />}
          {(isSelf || mentionSelf) && (
            <MenuItem
              onClick={async () => {
                try {
                  const newStatus = await masto.v1.statuses
                    .$select(id)
                    [muted ? 'unmute' : 'mute']();
                  saveStatus(newStatus, instance);
                  showToast(
                    muted ? t`Conversation unmuted` : t`Conversation muted`,
                  );
                } catch (e) {
                  console.error(e);
                  showToast(
                    muted
                      ? t`Unable to unmute conversation`
                      : t`Unable to mute conversation`,
                  );
                }
              }}
            >
              {muted ? (
                <>
                  <Icon icon="unmute" />
                  <span>
                    <Trans>Unmute conversation</Trans>
                  </span>
                </>
              ) : (
                <>
                  <Icon icon="mute" />
                  <span>
                    <Trans>Mute conversation</Trans>
                  </span>
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
                    [pinned ? 'unpin' : 'pin']();
                  saveStatus(newStatus, instance);
                  showToast(
                    pinned
                      ? t`Post unpinned from profile`
                      : t`Post pinned to profile`,
                  );
                } catch (e) {
                  console.error(e);
                  showToast(
                    pinned ? t`Unable to unpin post` : t`Unable to pin post`,
                  );
                }
              }}
            >
              {pinned ? (
                <>
                  <Icon icon="unpin" />
                  <span>
                    <Trans>Unpin from profile</Trans>
                  </span>
                </>
              ) : (
                <>
                  <Icon icon="pin" />
                  <span>
                    <Trans>Pin to profile</Trans>
                  </span>
                </>
              )}
            </MenuItem>
          )}
          {isSelf && (
            <>
              {supportsNativeQuote() &&
                !['private', 'direct'].includes(visibility) && (
                  <MenuItem onClick={() => setShowQuoteSettings(true)}>
                    <Icon icon="quote2" />
                    <small>
                      <Trans>Quote settings</Trans>
                      <br />
                      <span class="more-insignificant">
                        {_(
                          quoteApprovalPolicyMessages[postQuoteApprovalPolicy],
                        )}
                      </span>
                    </small>
                  </MenuItem>
                )}
              <div class="menu-horizontal">
                {supports('@mastodon/post-edit') && (
                  <MenuItem
                    onClick={() => {
                      showCompose({
                        editStatus: status,
                        quoteStatus: status.quote?.quotedStatus,
                      });
                    }}
                  >
                    <Icon icon="pencil" />
                    <span>
                      <Trans>Edit</Trans>
                    </span>
                  </MenuItem>
                )}
                {isSizeLarge && (
                  <MenuConfirm
                    subMenu
                    confirmLabel={
                      <>
                        <Icon icon="trash" />
                        <span>
                          <Trans>Delete this post?</Trans>
                        </span>
                      </>
                    }
                    itemProps={{
                      className: 'danger',
                    }}
                    menuItemClassName="danger"
                    onClick={() => {
                      // const yes = confirm('Delete this post?');
                      // if (yes) {
                      (async () => {
                        try {
                          await masto.v1.statuses.$select(id).remove();
                          const cachedStatus = getStatus(id, instance);
                          cachedStatus._deleted = true;
                          showToast(t`Post deleted`);
                        } catch (e) {
                          console.error(e);
                          showToast(t`Unable to delete post`);
                        }
                      })();
                      // }
                    }}
                  >
                    <Icon icon="trash" />
                    <span>
                      <Trans>Delete…</Trans>
                    </span>
                  </MenuConfirm>
                )}
              </div>
            </>
          )}
          {!isSelf && isSizeLarge && (
            <>
              <MenuDivider />
              {isQuotingMyPost && (
                <MenuConfirm
                  subMenu
                  confirmLabel={
                    <>
                      <Icon icon="quote" />
                      <span>
                        <Trans>
                          Remove my post from{' '}
                          <span class="bidi-isolate">@{username || acct}</span>
                          's post?
                        </Trans>
                      </span>
                    </>
                  }
                  itemProps={{
                    className: 'danger',
                  }}
                  menuItemClassName="danger"
                  onClick={() => {
                    (async () => {
                      try {
                        // POST /api/v1/statuses/:id/quotes/:quoting_status_id/revoke
                        const quotedStatusID = quote.quotedStatus.id;
                        await masto.v1.statuses
                          .$select(quotedStatusID)
                          .quotes.$select(id)
                          .revoke.create();
                        showToast(t`Quote removed`);
                        states.reloadStatusPage++;
                      } catch (e) {
                        console.error(e);
                        showToast(t`Unable to remove quote`);
                      }
                    })();
                  }}
                >
                  <Icon icon="quote" />
                  <Trans>Remove quote…</Trans>
                </MenuConfirm>
              )}
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
                <span>
                  <Trans>Report post…</Trans>
                </span>
              </MenuItem>
            </>
          )}
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
  const rRef = useHotkeys(
    'r, shift+r',
    (e, handler) => {
      // Fix bug: shift+r is fired even when r is pressed due to useKey: true
      if (e.shiftKey !== handler.shift) return;
      replyStatus(e);
    },
    {
      enabled: hotkeysEnabled,
      useKey: true,
      ignoreEventWhen: (e) => e.metaKey || e.ctrlKey || e.altKey,
    },
  );
  const fRef = useHotkeys('f, l', favouriteStatusNotify, {
    enabled: hotkeysEnabled,
    ignoreEventWhen: (e) => e.metaKey || e.ctrlKey || e.altKey || e.shiftKey,
    useKey: true,
  });
  const dRef = useHotkeys('d', bookmarkStatusNotify, {
    enabled: hotkeysEnabled,
    useKey: true,
    ignoreEventWhen: (e) => e.metaKey || e.ctrlKey || e.altKey || e.shiftKey,
  });
  const bRef = useHotkeys(
    'shift+b',
    (e) => {
      // Need shiftKey check due to useKey: true
      if (!e.shiftKey) return;

      (async () => {
        try {
          const done = await confirmBoostStatus();
          if (!isSizeLarge && done) {
            showToast(
              reblogged
                ? t`Unboosted @${username || acct}'s post`
                : t`Boosted @${username || acct}'s post`,
            );
          }
        } catch (e) {}
      })();
    },
    {
      enabled: hotkeysEnabled && canBoost,
      useKey: true,
      ignoreEventWhen: (e) => e.metaKey || e.ctrlKey || e.altKey,
    },
  );
  const xRef = useHotkeys(
    'x',
    (e) => {
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
    },
    {
      useKey: true,
      ignoreEventWhen: (e) => e.metaKey || e.ctrlKey || e.altKey || e.shiftKey,
    },
  );
  const qRef = useHotkeys(
    'q',
    (e) => {
      if (!sameInstance || !authenticated) {
        return alert(unauthInteractionErrorMessage);
      }

      if (supportsNativeQuote()) {
        if (quoteDisabled) {
          showToast(quoteMetaText);
        } else {
          showCompose({
            quoteStatus: status,
          });
        }
        // Don't fallback to non-native if quoteDisabled
      } else {
        showCompose({
          draftStatus: {
            status: `\n${url}`,
          },
        });
      }
    },
    {
      enabled: hotkeysEnabled,
      useKey: true,
      ignoreEventWhen: (e) => e.metaKey || e.ctrlKey || e.altKey || e.shiftKey,
    },
  );

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
    if (forceShowCommentCount && repliesCount > 0) return true;
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
    const containsQuestion = QUESTION_REGEX.test(content);
    if (!containsQuestion) return false;
    if (contentLength > 0 && contentLength <= SHOW_COMMENT_COUNT_LIMIT) {
      return true;
    }
  }, [
    forceShowCommentCount,
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
    contentLength,
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
          qRef.current = nodeRef;
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
                title={t`Reply`}
                alt={t`Reply`}
                class="reply-button"
                icon="comment"
                iconSize="m"
                // Menu doesn't work here
                // Temporary solution: reply author-first if too many mentions
                onClick={(e) =>
                  replyStatus(e, tooManyMentions ? 'author-first' : 'all')
                }
              />
              <StatusButton
                size="s"
                checked={favourited}
                title={[t`Like`, t`Unlike`]}
                alt={[t`Like`, t`Liked`]}
                class="favourite-button"
                icon="heart"
                iconSize="m"
                count={favouritesCount}
                onClick={favouriteStatusNotify}
              />
              <button
                type="button"
                title={t`More`}
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
                <Icon icon="more2" size="m" alt={t`More`} />
              </button>
            </div>
          )}
        {size !== 'l' && (
          <div class="status-badge">
            {reblogged && (
              <Icon class="reblog" icon="rocket" size="s" alt={t`Boosted`} />
            )}
            {favourited && (
              <Icon class="favourite" icon="heart" size="s" alt={t`Liked`} />
            )}
            {bookmarked && (
              <Icon
                class="bookmark"
                icon="bookmark"
                size="s"
                alt={t`Bookmarked`}
              />
            )}
            {_pinned && (
              <Icon class="pin" icon="pin" size="s" alt={t`Pinned`} />
            )}
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
          {!!quoteDomain && (
            <div class="status-quote-meta">
              <span class="domain">{quoteDomain}</span>
            </div>
          )}
          {!!(status.account || createdAt) && (
            <div class="meta">
              <span class="meta-name">
                <NameText
                  account={status.account}
                  instance={instance}
                  showAvatar={size === 's'}
                  showAcct={isSizeLarge}
                />
              </span>
              {withinContext && isThread && (
                <ThreadBadge
                  showIcon={isSizeLarge}
                  index={snapStates.statusThreadNumber[sKey]}
                />
              )}
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
                  <span class="status-deleted-tag">
                    <Trans>Deleted</Trans>
                  </span>
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
                        // alt={`${repliesCount} ${
                        //   repliesCount === 1 ? 'reply' : 'replies'
                        // }`}
                        alt={plural(repliesCount, {
                          one: '# reply',
                          other: '# replies',
                        })}
                      />
                    ) : (
                      visibility !== 'public' &&
                      visibility !== 'direct' && (
                        <Icon
                          icon={visibilityIconsMap[visibility]}
                          alt={_(visibilityText[visibility])}
                          size="s"
                        />
                      )
                    )}{' '}
                    <RelativeTime datetime={createdAtDate} format="micro" />
                    {!previewMode && !readOnly && (
                      <Icon icon="more2" class="more" alt={t`More`} />
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
                          alt={_(visibilityText[visibility])}
                          size="s"
                        />{' '}
                      </>
                    )}
                    <RelativeTime datetime={createdAtDate} format="micro" />
                  </span>
                ))}
            </div>
          )}
          {visibility === 'direct' && (
            <>
              <div class="status-direct-badge">
                <Trans>Private mention</Trans>
              </div>{' '}
            </>
          )}
          {!withinContext && (
            <>
              {isThread ? (
                <ThreadBadge
                  showIcon
                  showText
                  index={snapStates.statusThreadNumber[sKey]}
                />
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
              spoilerText || sensitive || filterInfo?.action === 'blur'
                ? 'has-spoiler'
                : ''
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
                        data-read-more={_(readMoreText)}
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
                      {showSpoiler ? t`Show less` : t`Show content`}
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
                      data-read-more={_(readMoreText)}
                    >
                      <p>
                        <EmojiText text={spoilerText} emojis={emojis} />
                      </p>
                    </div>
                    {readingExpandSpoilers || previewMode ? (
                      <div class="spoiler-divider">
                        <Icon icon="eye-open" /> <Trans>Content warning</Trans>
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
                        {showSpoiler ? t`Show less` : t`Show content`}
                      </button>
                    )}
                  </>
                )}
                {!!content && (
                  <div
                    class="content"
                    ref={contentRef}
                    data-read-more={_(readMoreText)}
                    inert={!!spoilerText && !showSpoiler ? true : undefined}
                  >
                    <PostContent
                      key={reloadPostContentCount}
                      post={status}
                      instance={instance}
                      previewMode={previewMode}
                    />
                  </div>
                )}
                {!!content && (
                  <MathBlock
                    content={content}
                    contentRef={contentRef}
                    onRevert={reloadPostContent}
                  />
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
                  isTranslateble(content, emojis) &&
                  differentLanguage) ||
                  forceTranslate) && (
                  <TranslationBlock
                    forceTranslate={forceTranslate || inlineTranslate}
                    mini={!isSizeLarge && !withinContext}
                    sourceLanguage={language}
                    autoDetected={languageAutoDetected}
                    text={getPostText(status, {
                      maskCustomEmojis: true,
                      maskURLs: true,
                      // Hide regardless of native quote support
                      // They are not useful in translation context
                      hideInlineQuote: true,
                    })}
                  />
                )}
                {!previewMode &&
                  (sensitive || filterInfo?.action === 'blur') &&
                  !!mediaAttachments.length &&
                  (readingExpandMedia !== 'show_all' ||
                    filterInfo?.action === 'blur') && (
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
                      <span>
                        {filterInfo?.action === 'blur' && (
                          <small>
                            <Trans>Filtered: {filterInfo?.titlesStr}</Trans>
                            <br />
                          </small>
                        )}
                        {showSpoilerMedia ? t`Show less` : t`Show media`}
                      </span>
                    </button>
                  )}
                {!!mediaAttachments.length &&
                  (mediaAttachments.length > 1 &&
                  (isSizeLarge || (withinContext && size === 'm')) ? (
                    <div class="media-large-container">
                      {mediaAttachments.map((media, i) => (
                        <div key={media.id} class={`media-container media-eq1`}>
                          <Media
                            media={media}
                            autoAnimate
                            showCaption
                            allowLongerCaption={!content || isSizeLarge}
                            lang={language}
                            to={`/${instance}/s/${id}?${
                              withinContext ? 'media' : 'media-only'
                            }=${i + 1}`}
                            onClick={
                              onMediaClick
                                ? (e) => onMediaClick(e, i, media, status)
                                : undefined
                            }
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
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
                            checkAspectRatio={mediaAttachments.length === 1}
                          />
                        ))}
                      </div>
                    </MultipleMediaFigure>
                  ))}
                <QuoteStatuses
                  id={id}
                  instance={instance}
                  level={quoted}
                  collapsed={!isSizeLarge && !withinContext}
                />
                {!!card &&
                  /^https/i.test(card?.url) &&
                  !sensitive &&
                  !spoilerText &&
                  !poll &&
                  !mediaAttachments.length &&
                  !snapStates.statusQuotes[sKey] && (
                    <StatusCard
                      card={card}
                      selfReferential={
                        card?.url === status.url || card?.url === status.uri
                      }
                      selfAuthor={card?.authors?.some(
                        (a) => a.account?.url === accountURL,
                      )}
                      instance={currentInstance}
                    />
                  )}
              </>
            )}
          </div>
          {!isSizeLarge && showCommentCount && (
            <div class="content-comment-hint insignificant">
              <Icon icon="comment2" alt={t`Replies`} /> {repliesCount}
            </div>
          )}
          {isSizeLarge && (
            <>
              <div class="extra-meta">
                {_deleted ? (
                  <span class="status-deleted-tag">
                    <Trans>Deleted</Trans>
                  </span>
                ) : (
                  <>
                    {/* <Icon
                      icon={visibilityIconsMap[visibility]}
                      alt={visibilityText[visibility]}
                    /> */}
                    <span>{_(visibilityText[visibility])}</span> &bull;{' '}
                    <a href={url} target="_blank" rel="noopener">
                      {
                        // within a day
                        Date.now() - createdAtDate.getTime() < 86400000 && (
                          <>
                            <RelativeTime
                              datetime={createdAtDate}
                              format="micro"
                            />{' '}
                            ‒{' '}
                          </>
                        )
                      }
                      {!!createdAt && (
                        <time
                          class="created"
                          datetime={createdAtDate.toISOString()}
                          title={createdAtDate.toLocaleString()}
                        >
                          {createdDateText}
                        </time>
                      )}
                    </a>
                    {editedAt && (
                      <span class="edited-container">
                        {' '}
                        &bull; <Icon icon="pencil" alt={t`Edited`} />{' '}
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
                      </span>
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
                  {tooManyMentions ? (
                    <Menu2
                      openTrigger="clickOnly"
                      direction="bottom"
                      overflow="auto"
                      gap={-8}
                      shift={8}
                      menuClassName="menu-emphasized"
                      menuButton={
                        <StatusButton
                          title={t`Reply`}
                          alt={t`Comments`}
                          class="reply-button"
                          icon="comment"
                          count={repliesCount}
                        />
                      }
                    >
                      {replyModeMenuItems}
                    </Menu2>
                  ) : (
                    <StatusButton
                      title={t`Reply`}
                      alt={t`Comments`}
                      class="reply-button"
                      icon="comment"
                      count={repliesCount}
                      onClick={replyStatus}
                    />
                  )}
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
                <div
                  class={`action ${canQuote && reblogsCount > 0 && quotesCount > 0 ? 'has-counts' : 'has-count'}`}
                >
                  <MenuConfirm
                    disabled={!canBoost}
                    onClick={confirmBoostStatus}
                    confirmLabel={
                      <>
                        <Icon icon="rocket" />
                        <span>{reblogged ? t`Unboost` : t`Boost`}</span>
                      </>
                    }
                    menuExtras={
                      <>
                        {supportsNativeQuote() && (
                          <MenuItem
                            disabled={quoteDisabled}
                            onClick={() => {
                              showCompose({
                                quoteStatus: status,
                              });
                            }}
                          >
                            <Icon icon="quote" />
                            {quoteMetaText ? (
                              <small>
                                {quoteText}
                                <br />
                                {quoteMetaText}
                              </small>
                            ) : (
                              <span>{quoteText}</span>
                            )}
                          </MenuItem>
                        )}
                        {(DEV || !supportsNativeQuote()) && (
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
                            <span>
                              <Trans>Quote with link</Trans>
                            </span>
                            {supportsNativeQuote() && DEV && (
                              <small class="tag collapsed">DEV</small>
                            )}
                          </MenuItem>
                        )}
                      </>
                    }
                    menuFooter={menuFooter}
                  >
                    <StatusButton
                      checked={reblogged}
                      title={[
                        canQuote ? t`Boost/Quote…` : t`Boost…`,
                        t`Unboost`,
                      ]}
                      alt={[t`Boost`, t`Boosted`]}
                      class="reblog-button"
                      icon="rocket"
                      count={reblogsCount}
                      extraCount={quotesCount}
                      // onClick={boostStatus}
                      disabled={!canBoost}
                    />
                  </MenuConfirm>
                </div>
                <div class="action has-count">
                  <StatusButton
                    checked={favourited}
                    title={[t`Like`, t`Unlike`]}
                    alt={[t`Like`, t`Liked`]}
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
                      title={[t`Bookmark`, t`Unbookmark`]}
                      alt={[t`Bookmark`, t`Bookmarked`]}
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
                        title={t`More`}
                        class="plain more-button"
                      >
                        <Icon icon="more" size="l" alt={t`More`} />
                      </button>
                    </div>
                  }
                >
                  {StatusMenuItems}{' '}
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
            onClose={() => {
              setShowEmbed(false);
            }}
          >
            <PostEmbedModal
              post={status}
              instance={instance}
              onClose={() => {
                setShowEmbed(false);
              }}
            />
          </Modal>
        )}
        {!!showQuoteSettings && (
          <Modal
            onClose={() => {
              setShowQuoteSettings(false);
              states.reloadStatusPage++;
            }}
          >
            <QuoteSettingsSheet
              onClose={() => {
                setShowQuoteSettings(false);
                states.reloadStatusPage++;
              }}
              post={status}
              currentPolicy={postQuoteApprovalPolicy}
            />
          </Modal>
        )}
        {!!showQuotes && (
          <Modal
            onClose={() => {
              setShowQuotes(false);
            }}
          >
            <QuotesModal
              statusId={id}
              instance={instance}
              onClose={() => {
                setShowQuotes(false);
              }}
            />
          </Modal>
        )}
      </article>
    </StatusParent>
  );
}

function nicePostURL(url) {
  if (!url) return;
  const urlObj = URL.parse(url);
  if (!urlObj) return;
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

const handledUnfulfilledStates = [
  'deleted',
  'unauthorized',
  'pending',
  'rejected',
  'revoked',
];
const unfulfilledText = {
  filterHidden: msg`Post hidden by your filters`,
  pending: msg`Post pending`,
  deleted: msg`Post unavailable`,
  unauthorized: msg`Post unavailable`,
  rejected: msg`Post unavailable`,
  revoked: msg`Post removed by author`,
};

const QuoteStatuses = memo(({ id, instance, level = 0, collapsed = false }) => {
  if (!id || !instance) return;
  const { _ } = useLingui();
  const snapStates = useSnapshot(states);
  const sKey = statusKey(id, instance);
  const quotes = snapStates.statusQuotes[sKey];
  let uniqueQuotes = quotes?.filter(
    (q, i, arr) => q.native || arr.findIndex((q2) => q2.url === q.url) === i,
  );

  if (!uniqueQuotes?.length) return;
  if (level > 2) return;

  if (collapsed) {
    // Only show the first quote if "collapsed"
    uniqueQuotes = [uniqueQuotes[0]];
  }

  const filterContext = useContext(FilterContext);
  const currentAccount = getCurrentAccID();
  const containerRef = useTruncated();

  return (
    <div
      class="status-card-container"
      ref={containerRef}
      data-read-more={_(readMoreText)}
    >
      {uniqueQuotes.map((q) => {
        let unfulfilledState;

        const quoteStatus = snapStates.statuses[statusKey(q.id, q.instance)];
        if (quoteStatus) {
          const isSelf =
            currentAccount && currentAccount === quoteStatus.account?.id;
          const filterInfo =
            !isSelf && isFiltered(quoteStatus.filtered, filterContext);

          if (filterInfo?.action === 'hide') {
            unfulfilledState = 'filterHidden';
          }
        }

        if (!unfulfilledState) {
          unfulfilledState = handledUnfulfilledStates.find(
            (state) => q.state === state,
          );
        }

        if (unfulfilledState) {
          return (
            <div
              class={`status-card-unfulfilled ${
                unfulfilledState === 'filterHidden' ? 'status-card-ghost' : ''
              } ${q.native ? 'quote-post-native' : ''}`}
            >
              <Icon icon="quote" />
              <i>{_(unfulfilledText[unfulfilledState])}</i>
            </div>
          );
        }

        const Parent = q.native ? Fragment : LazyShazam;
        return (
          <Parent id={q.instance + q.id} key={q.instance + q.id}>
            <Link
              key={q.instance + q.id}
              to={`${q.instance ? `/${q.instance}` : ''}/s/${q.id}`}
              class={`status-card-link ${q.native ? 'quote-post-native' : ''}`}
              data-read-more={_(readMoreText)}
            >
              <Status
                statusID={q.id}
                instance={q.instance}
                size="s"
                quoted={level + 1}
                quoteDomain={q.originalDomain}
                enableCommentHint
              />
            </Link>
          </Parent>
        );
      })}
    </div>
  );
});

function EditedAtModal({
  statusID,
  instance,
  fetchStatusHistory = () => {},
  onClose,
}) {
  const { t } = useLingui();
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
          <Icon icon="x" alt={t`Close`} />
        </button>
      )}
      <header>
        <h2>
          <Trans>Edit History</Trans>
        </h2>
        {uiState === 'error' && (
          <p>
            <Trans>Failed to load history</Trans>
          </p>
        )}
        {uiState === 'loading' && (
          <p>
            <Loader abrupt /> <Trans>Loading…</Trans>
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

function FilteredStatus({
  status,
  filterInfo,
  instance,
  containerProps = {},
  showFollowedTags,
  quoted,
}) {
  const { _, t } = useLingui();
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
      class={`${
        quoted
          ? ''
          : isReblog
            ? group
              ? 'status-group'
              : 'status-reblog'
            : isFollowedTags
              ? 'status-followed-tags'
              : ''
      } visibility-${visibility}`}
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
          <span>
            <Trans>Filtered</Trans>
          </span>
          <span>{filterTitleStr}</span>
        </b>{' '}
        <Avatar url={avatarStatic || avatar} squircle={bot} />
        <span class="status-filtered-info">
          <span class="status-filtered-info-1">
            {isReblog ? (
              <Trans comment="[Name] [Visibility icon] boosted">
                <NameText account={status.account} instance={instance} />{' '}
                <Icon
                  icon={visibilityIconsMap[visibility]}
                  alt={_(visibilityText[visibility])}
                  size="s"
                />{' '}
                boosted
              </Trans>
            ) : isFollowedTags ? (
              <>
                <NameText account={status.account} instance={instance} />{' '}
                <Icon
                  icon={visibilityIconsMap[visibility]}
                  alt={_(visibilityText[visibility])}
                  size="s"
                />{' '}
                <span>
                  {snapStates.statusFollowedTags[sKey]
                    .slice(0, 3)
                    .map((tag) => (
                      <span key={tag} class="status-followed-tag-item">
                        #{tag}
                      </span>
                    ))}
                </span>
              </>
            ) : (
              <>
                <NameText account={status.account} instance={instance} />{' '}
                <Icon
                  icon={visibilityIconsMap[visibility]}
                  alt={_(visibilityText[visibility])}
                  size="s"
                />{' '}
                <RelativeTime datetime={createdAtDate} format="micro" />
              </>
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
              <Icon icon="x" alt={t`Close`} />
            </button>
            <header>
              <b class="status-filtered-badge">
                <Trans>Filtered</Trans>
              </b>{' '}
              {filterTitleStr}
            </header>
            <main tabIndex="-1">
              <Link
                ref={statusPeekRef}
                class="status-link"
                to={url}
                onClick={() => {
                  setShowPeek(false);
                }}
                data-read-more={_(readMoreText)}
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

export default memo(Status, (oldProps, newProps) => {
  // Shallow equal all props except 'status'
  // This will be pure static until status ID changes
  const { status, ...restOldProps } = oldProps;
  const { status: newStatus, ...restNewProps } = newProps;
  return (
    status?.id === newStatus?.id && shallowEqual(restOldProps, restNewProps)
  );
});
