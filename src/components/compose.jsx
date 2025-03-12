import './compose.css';
import '@github/text-expander-element';

import { msg, plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { MenuItem } from '@szhsin/react-menu';
import { deepEqual } from 'fast-equals';
import Fuse from 'fuse.js';
import { forwardRef, memo } from 'preact/compat';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import { useHotkeys } from 'react-hotkeys-hook';
import stringLength from 'string-length';
// import { detectAll } from 'tinyld/light';
import { uid } from 'uid/single';
import { useDebouncedCallback, useThrottledCallback } from 'use-debounce';
import useResizeObserver from 'use-resize-observer';
import { useSnapshot } from 'valtio';

import poweredByGiphyURL from '../assets/powered-by-giphy.svg';

import Menu2 from '../components/menu2';
import supportedLanguages from '../data/status-supported-languages';
import urlRegex from '../data/url-regex';
import { api } from '../utils/api';
import { langDetector } from '../utils/browser-translator';
import db from '../utils/db';
import emojifyText from '../utils/emojify-text';
import i18nDuration from '../utils/i18n-duration';
import isRTL from '../utils/is-rtl';
import localeMatch from '../utils/locale-match';
import localeCode2Text from '../utils/localeCode2Text';
import mem from '../utils/mem';
import openCompose from '../utils/open-compose';
import pmem from '../utils/pmem';
import prettyBytes from '../utils/pretty-bytes';
import { fetchRelationships } from '../utils/relationships';
import shortenNumber from '../utils/shorten-number';
import showToast from '../utils/show-toast';
import states, { saveStatus } from '../utils/states';
import store from '../utils/store';
import {
  getCurrentAccount,
  getCurrentAccountNS,
  getCurrentInstance,
  getCurrentInstanceConfiguration,
} from '../utils/store-utils';
import supports from '../utils/supports';
import useCloseWatcher from '../utils/useCloseWatcher';
import useInterval from '../utils/useInterval';
import visibilityIconsMap from '../utils/visibility-icons-map';

import AccountBlock from './account-block';
// import Avatar from './avatar';
import Icon from './icon';
import Loader from './loader';
import Modal from './modal';
import ScheduledAtField, {
  getLocalTimezoneName,
  MIN_SCHEDULED_AT,
} from './ScheduledAtField';
import Status from './status';

const {
  PHANPY_IMG_ALT_API_URL: IMG_ALT_API_URL,
  PHANPY_GIPHY_API_KEY: GIPHY_API_KEY,
} = import.meta.env;

const supportedLanguagesMap = supportedLanguages.reduce((acc, l) => {
  const [code, common, native] = l;
  acc[code] = {
    common,
    native,
  };
  return acc;
}, {});

/* NOTES:
  - Max character limit includes BOTH status text and Content Warning text
*/

const expiryOptions = {
  300: i18nDuration(5, 'minute'),
  1_800: i18nDuration(30, 'minute'),
  3_600: i18nDuration(1, 'hour'),
  21_600: i18nDuration(6, 'hour'),
  86_400: i18nDuration(1, 'day'),
  259_200: i18nDuration(3, 'day'),
  604_800: i18nDuration(1, 'week'),
};
const expirySeconds = Object.keys(expiryOptions);
const oneDay = 24 * 60 * 60;

const expiresInFromExpiresAt = (expiresAt) => {
  if (!expiresAt) return oneDay;
  const delta = (new Date(expiresAt).getTime() - Date.now()) / 1000;
  return expirySeconds.find((s) => s >= delta) || oneDay;
};

const menu = document.createElement('ul');
menu.role = 'listbox';
menu.className = 'text-expander-menu';

// Set IntersectionObserver on menu, reposition it because text-expander doesn't handle it
const windowMargin = 16;
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const { left, width } = entry.boundingClientRect;
      const { innerWidth } = window;
      if (left + width > innerWidth) {
        const insetInlineStart = isRTL() ? 'right' : 'left';
        menu.style[insetInlineStart] = innerWidth - width - windowMargin + 'px';
      }
    }
  });
});
observer.observe(menu);

const DEFAULT_LANG = localeMatch(
  [new Intl.DateTimeFormat().resolvedOptions().locale, ...navigator.languages],
  supportedLanguages.map((l) => l[0]),
  'en',
);

// https://github.com/mastodon/mastodon/blob/c4a429ed47e85a6bbf0d470a41cc2f64cf120c19/app/javascript/mastodon/features/compose/util/counter.js
const urlRegexObj = new RegExp(urlRegex.source, urlRegex.flags);
const usernameRegex = /(^|[^\/\w])@(([a-z0-9_]+)@[a-z0-9\.\-]+[a-z0-9]+)/gi;
const urlPlaceholder = '$2xxxxxxxxxxxxxxxxxxxxxxx';
function countableText(inputText) {
  return inputText
    .replace(urlRegexObj, urlPlaceholder)
    .replace(usernameRegex, '$1@$3');
}

// https://github.com/mastodon/mastodon/blob/c03bd2a238741a012aa4b98dc4902d6cf948ab63/app/models/account.rb#L69
const USERNAME_RE = /[a-z0-9_]+([a-z0-9_.-]+[a-z0-9_]+)?/i;
const MENTION_RE = new RegExp(
  `(^|[^=\\/\\w])(@${USERNAME_RE.source}(?:@[\\p{L}\\w.-]+[\\w]+)?)`,
  'uig',
);

// AI-generated, all other regexes are too complicated
const HASHTAG_RE = new RegExp(
  `(^|[^=\\/\\w])(#[\\p{L}\\p{N}_]+([\\p{L}\\p{N}_.]+[\\p{L}\\p{N}_]+)?)(?![\\/\\w])`,
  'iug',
);

// https://github.com/mastodon/mastodon/blob/23e32a4b3031d1da8b911e0145d61b4dd47c4f96/app/models/custom_emoji.rb#L31
const SHORTCODE_RE_FRAGMENT = '[a-zA-Z0-9_]{2,}';
const SCAN_RE = new RegExp(
  `(^|[^=\\/\\w])(:${SHORTCODE_RE_FRAGMENT}:)(?=[^A-Za-z0-9_:]|$)`,
  'g',
);

const segmenter = new Intl.Segmenter();
function escapeHTML(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
function highlightText(text, { maxCharacters = Infinity }) {
  // Exceeded characters limit
  const { composerCharacterCount } = states;
  if (composerCharacterCount > maxCharacters) {
    // Highlight exceeded characters
    let withinLimitHTML = '',
      exceedLimitHTML = '';
    const htmlSegments = segmenter.segment(text);
    for (const { segment, index } of htmlSegments) {
      if (index < maxCharacters) {
        withinLimitHTML += segment;
      } else {
        exceedLimitHTML += segment;
      }
    }
    if (exceedLimitHTML) {
      exceedLimitHTML =
        '<mark class="compose-highlight-exceeded">' +
        escapeHTML(exceedLimitHTML) +
        '</mark>';
    }
    return escapeHTML(withinLimitHTML) + exceedLimitHTML;
  }

  return escapeHTML(text)
    .replace(urlRegexObj, '$2<mark class="compose-highlight-url">$3</mark>') // URLs
    .replace(MENTION_RE, '$1<mark class="compose-highlight-mention">$2</mark>') // Mentions
    .replace(HASHTAG_RE, '$1<mark class="compose-highlight-hashtag">$2</mark>') // Hashtags
    .replace(
      SCAN_RE,
      '$1<mark class="compose-highlight-emoji-shortcode">$2</mark>',
    ); // Emoji shortcodes
}

// const rtf = new Intl.RelativeTimeFormat();
const RTF = mem((locale) => new Intl.RelativeTimeFormat(locale || undefined));
const LF = mem((locale) => new Intl.ListFormat(locale || undefined));

const CUSTOM_EMOJIS_COUNT = 100;

const ADD_LABELS = {
  camera: msg`Take photo or video`,
  media: msg`Add media`,
  customEmoji: msg`Add custom emoji`,
  gif: msg`Add GIF`,
  poll: msg`Add poll`,
  scheduledPost: msg`Schedule post`,
};

function Compose({
  onClose,
  replyToStatus,
  editStatus,
  draftStatus,
  standalone,
  hasOpener,
}) {
  const { i18n, _, t } = useLingui();
  const rtf = RTF(i18n.locale);
  const lf = LF(i18n.locale);

  console.warn('RENDER COMPOSER');
  const { masto, instance } = api();
  const [uiState, setUIState] = useState('default');
  const UID = useRef(draftStatus?.uid || uid());
  console.log('Compose UID', UID.current);

  const currentAccount = getCurrentAccount();
  const currentAccountInfo = currentAccount.info;

  const configuration = getCurrentInstanceConfiguration();
  console.log('⚙️ Configuration', configuration);

  const {
    statuses: {
      maxCharacters,
      maxMediaAttachments, // Beware: it can be undefined!
      charactersReservedPerUrl,
    } = {},
    mediaAttachments: {
      supportedMimeTypes,
      imageSizeLimit,
      imageMatrixLimit,
      videoSizeLimit,
      videoMatrixLimit,
      videoFrameRateLimit,
    } = {},
    polls: {
      maxOptions,
      maxCharactersPerOption,
      maxExpiration,
      minExpiration,
    } = {},
  } = configuration || {};
  const supportedImagesVideosTypes = supportedMimeTypes?.filter((mimeType) =>
    /^(image|video)/i.test(mimeType),
  );

  const textareaRef = useRef();
  const spoilerTextRef = useRef();
  const [visibility, setVisibility] = useState('public');
  const [sensitive, setSensitive] = useState(false);
  const [language, setLanguage] = useState(
    store.session.get('currentLanguage') || DEFAULT_LANG,
  );
  const prevLanguage = useRef(language);
  const [mediaAttachments, setMediaAttachments] = useState([]);
  const [poll, setPoll] = useState(null);
  const [scheduledAt, setScheduledAt] = useState(null);

  const prefs = store.account.get('preferences') || {};

  const oninputTextarea = () => {
    if (!textareaRef.current) return;
    textareaRef.current.dispatchEvent(new Event('input'));
  };
  const focusTextarea = () => {
    setTimeout(() => {
      if (!textareaRef.current) return;
      // status starts with newline, focus on first position
      if (draftStatus?.status?.startsWith?.('\n')) {
        textareaRef.current.selectionStart = 0;
        textareaRef.current.selectionEnd = 0;
      }
      console.debug('FOCUS textarea');
      textareaRef.current?.focus();
    }, 300);
  };

  useEffect(() => {
    if (replyToStatus) {
      const { spoilerText, visibility, language, sensitive } = replyToStatus;
      if (spoilerText && spoilerTextRef.current) {
        spoilerTextRef.current.value = spoilerText;
      }
      const mentions = new Set([
        replyToStatus.account.acct,
        ...replyToStatus.mentions.map((m) => m.acct),
      ]);
      const allMentions = [...mentions].filter(
        (m) => m !== currentAccountInfo.acct,
      );
      if (allMentions.length > 0) {
        textareaRef.current.value = `${allMentions
          .map((m) => `@${m}`)
          .join(' ')} `;
        oninputTextarea();
      }
      focusTextarea();
      setVisibility(
        visibility === 'public' && prefs['posting:default:visibility']
          ? prefs['posting:default:visibility'].toLowerCase()
          : visibility,
      );
      setLanguage(
        language ||
          prefs['posting:default:language']?.toLowerCase() ||
          DEFAULT_LANG,
      );
      setSensitive(sensitive && !!spoilerText);
    } else if (editStatus) {
      const { visibility, language, sensitive, poll, mediaAttachments } =
        editStatus;
      const composablePoll = !!poll?.options && {
        ...poll,
        options: poll.options.map((o) => o?.title || o),
        expiresIn: poll?.expiresIn || expiresInFromExpiresAt(poll.expiresAt),
      };
      setUIState('loading');
      (async () => {
        try {
          const statusSource = await masto.v1.statuses
            .$select(editStatus.id)
            .source.fetch();
          console.log({ statusSource });
          const { text, spoilerText } = statusSource;
          textareaRef.current.value = text;
          textareaRef.current.dataset.source = text;
          oninputTextarea();
          focusTextarea();
          spoilerTextRef.current.value = spoilerText;
          setVisibility(visibility);
          setLanguage(
            language ||
              prefs['posting:default:language']?.toLowerCase() ||
              DEFAULT_LANG,
          );
          setSensitive(sensitive);
          if (composablePoll) setPoll(composablePoll);
          setMediaAttachments(mediaAttachments);
          setUIState('default');
        } catch (e) {
          console.error(e);
          alert(e?.reason || e);
          setUIState('error');
        }
      })();
    } else {
      focusTextarea();
      console.log('Apply prefs', prefs);
      if (prefs['posting:default:visibility']) {
        setVisibility(prefs['posting:default:visibility'].toLowerCase());
      }
      if (prefs['posting:default:language']) {
        setLanguage(prefs['posting:default:language'].toLowerCase());
      }
      if (prefs['posting:default:sensitive']) {
        setSensitive(!!prefs['posting:default:sensitive']);
      }
    }
    if (draftStatus) {
      const {
        status,
        spoilerText,
        visibility,
        language,
        sensitive,
        poll,
        mediaAttachments,
        scheduledAt,
      } = draftStatus;
      const composablePoll = !!poll?.options && {
        ...poll,
        options: poll.options.map((o) => o?.title || o),
        expiresIn: poll?.expiresIn || expiresInFromExpiresAt(poll.expiresAt),
      };
      textareaRef.current.value = status;
      oninputTextarea();
      focusTextarea();
      if (spoilerText) spoilerTextRef.current.value = spoilerText;
      if (visibility) setVisibility(visibility);
      setLanguage(
        language ||
          prefs['posting:default:language']?.toLowerCase() ||
          DEFAULT_LANG,
      );
      if (sensitive !== null) setSensitive(sensitive);
      if (composablePoll) setPoll(composablePoll);
      if (mediaAttachments) setMediaAttachments(mediaAttachments);
      if (scheduledAt) setScheduledAt(scheduledAt);
    }
  }, [draftStatus, editStatus, replyToStatus]);

  const formRef = useRef();

  const beforeUnloadCopy = t`You have unsaved changes. Discard this post?`;
  const canClose = () => {
    const { value, dataset } = textareaRef.current;

    // check if loading
    if (uiState === 'loading') {
      console.log('canClose', { uiState });
      return false;
    }

    // check for status and media attachments
    const hasValue = (value || '')
      .trim()
      .replace(/^\p{White_Space}+|\p{White_Space}+$/gu, '');
    const hasMediaAttachments = mediaAttachments.length > 0;
    if (!hasValue && !hasMediaAttachments) {
      console.log('canClose', { value, mediaAttachments });
      return true;
    }

    // check if all media attachments have IDs
    const hasIDMediaAttachments =
      mediaAttachments.length > 0 &&
      mediaAttachments.every((media) => media.id);
    if (hasIDMediaAttachments) {
      console.log('canClose', { hasIDMediaAttachments });
      return true;
    }

    // check if status contains only "@acct", if replying
    const isSelf = replyToStatus?.account.id === currentAccountInfo.id;
    const hasOnlyAcct =
      replyToStatus && value.trim() === `@${replyToStatus.account.acct}`;
    // TODO: check for mentions, or maybe just generic "@username<space>", including multiple mentions like "@username1<space>@username2<space>"
    if (!isSelf && hasOnlyAcct) {
      console.log('canClose', { isSelf, hasOnlyAcct });
      return true;
    }

    // check if status is same with source
    const sameWithSource = value === dataset?.source;
    if (sameWithSource) {
      console.log('canClose', { sameWithSource });
      return true;
    }

    console.log('canClose', {
      value,
      hasMediaAttachments,
      hasIDMediaAttachments,
      poll,
      isSelf,
      hasOnlyAcct,
      sameWithSource,
      uiState,
    });

    return false;
  };

  const confirmClose = () => {
    if (!canClose()) {
      const yes = confirm(beforeUnloadCopy);
      return yes;
    }
    return true;
  };

  useEffect(() => {
    // Show warning if user tries to close window with unsaved changes
    const handleBeforeUnload = (e) => {
      if (!canClose()) {
        e.preventDefault();
        e.returnValue = beforeUnloadCopy;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload, {
      capture: true,
    });
    return () =>
      window.removeEventListener('beforeunload', handleBeforeUnload, {
        capture: true,
      });
  }, []);

  const getCharCount = () => {
    const { value } = textareaRef.current;
    const { value: spoilerText } = spoilerTextRef.current;
    return stringLength(countableText(value)) + stringLength(spoilerText);
  };
  const updateCharCount = () => {
    const count = getCharCount();
    states.composerCharacterCount = count;
  };
  useEffect(updateCharCount, []);

  const supportsCloseWatcher = window.CloseWatcher;
  const escDownRef = useRef(false);
  useHotkeys(
    'esc',
    () => {
      escDownRef.current = true;
      // This won't be true if this event is already handled and not propagated 🤞
    },
    {
      enabled: !supportsCloseWatcher,
      enableOnFormTags: true,
    },
  );
  useHotkeys(
    'esc',
    () => {
      if (!standalone && escDownRef.current && confirmClose()) {
        onClose();
      }
      escDownRef.current = false;
    },
    {
      enabled: !supportsCloseWatcher,
      enableOnFormTags: true,
      // Use keyup because Esc keydown will close the confirm dialog on Safari
      keyup: true,
      ignoreEventWhen: () => {
        const modals = document.querySelectorAll('#modal-container > *');
        const hasModal = !!modals;
        const hasOnlyComposer =
          modals.length === 1 && modals[0].querySelector('#compose-container');
        return hasModal && !hasOnlyComposer;
      },
    },
  );
  useCloseWatcher(() => {
    if (!standalone && confirmClose()) {
      onClose();
    }
  }, []);

  const prevBackgroundDraft = useRef({});
  const draftKey = () => {
    const ns = getCurrentAccountNS();
    return `${ns}#${UID.current}`;
  };
  const saveUnsavedDraft = () => {
    // Not enabling this for editing status
    // I don't think this warrant a draft mode for a status that's already posted
    // Maybe it could be a big edit change but it should be rare
    if (editStatus) return;
    if (states.composerState.minimized) return;
    const key = draftKey();
    const backgroundDraft = {
      key,
      replyTo: replyToStatus
        ? {
            /* Smaller payload of replyToStatus. Reasons:
              - No point storing whole thing
              - Could have media attachments
              - Could be deleted/edited later
            */
            id: replyToStatus.id,
            account: {
              id: replyToStatus.account.id,
              username: replyToStatus.account.username,
              acct: replyToStatus.account.acct,
            },
          }
        : null,
      draftStatus: {
        uid: UID.current,
        status: textareaRef.current.value,
        spoilerText: spoilerTextRef.current.value,
        visibility,
        language,
        sensitive,
        poll,
        mediaAttachments,
        scheduledAt,
      },
    };
    if (
      !deepEqual(backgroundDraft, prevBackgroundDraft.current) &&
      !canClose()
    ) {
      console.debug('not equal', backgroundDraft, prevBackgroundDraft.current);
      db.drafts
        .set(key, {
          ...backgroundDraft,
          state: 'unsaved',
          updatedAt: Date.now(),
        })
        .then(() => {
          console.debug('DRAFT saved', key, backgroundDraft);
        })
        .catch((e) => {
          console.error('DRAFT failed', key, e);
        });
      prevBackgroundDraft.current = structuredClone(backgroundDraft);
    }
  };
  useInterval(saveUnsavedDraft, 5000); // background save every 5s
  useEffect(() => {
    saveUnsavedDraft();
    // If unmounted, means user discarded the draft
    // Also means pop-out 🙈, but it's okay because the pop-out will persist the ID and re-create the draft
    return () => {
      db.drafts.del(draftKey());
    };
  }, []);

  useEffect(() => {
    const handleItems = (e) => {
      const { items } = e.clipboardData || e.dataTransfer;
      const files = [];
      const unsupportedFiles = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (
            supportedMimeTypes !== undefined &&
            !supportedMimeTypes.includes(file.type)
          ) {
            unsupportedFiles.push(file);
          } else {
            files.push(file);
          }
        }
      }
      if (unsupportedFiles.length > 0) {
        alert(
          plural(unsupportedFiles.length, {
            one: `File ${unsupportedFiles[0].name} is not supported.`,
            other: `Files ${lf.format(
              unsupportedFiles.map((f) => f.name),
            )} are not supported.`,
          }),
        );
      }
      if (files.length > 0 && mediaAttachments.length >= maxMediaAttachments) {
        alert(
          plural(maxMediaAttachments, {
            one: 'You can only attach up to 1 file.',
            other: 'You can only attach up to # files.',
          }),
        );
        return;
      }
      console.log({ files });
      if (files.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        // Auto-cut-off files to avoid exceeding maxMediaAttachments
        let allowedFiles = files;
        if (maxMediaAttachments !== undefined) {
          const max = maxMediaAttachments - mediaAttachments.length;
          allowedFiles = allowedFiles.slice(0, max);
          if (allowedFiles.length <= 0) {
            alert(
              plural(maxMediaAttachments, {
                one: 'You can only attach up to 1 file.',
                other: 'You can only attach up to # files.',
              }),
            );
            return;
          }
        }
        const mediaFiles = allowedFiles.map((file) => ({
          file,
          type: file.type,
          size: file.size,
          url: URL.createObjectURL(file),
          id: null,
          description: null,
        }));
        setMediaAttachments([...mediaAttachments, ...mediaFiles]);
      }
    };
    window.addEventListener('paste', handleItems);
    const handleDragover = (e) => {
      // Prevent default if there's files
      if (e.dataTransfer.items.length > 0) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('dragover', handleDragover);
    window.addEventListener('drop', handleItems);
    return () => {
      window.removeEventListener('paste', handleItems);
      window.removeEventListener('dragover', handleDragover);
      window.removeEventListener('drop', handleItems);
    };
  }, [mediaAttachments]);

  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [showEmoji2Picker, setShowEmoji2Picker] = useState(false);
  const [showGIFPicker, setShowGIFPicker] = useState(false);

  const [autoDetectedLanguages, setAutoDetectedLanguages] = useState(null);
  const [topSupportedLanguages, restSupportedLanguages] = useMemo(() => {
    const topLanguages = [];
    const restLanguages = [];
    const { contentTranslationHideLanguages = [] } = states.settings;
    supportedLanguages.forEach((l) => {
      const [code] = l;
      if (
        code === language ||
        code === prevLanguage.current ||
        code === DEFAULT_LANG ||
        contentTranslationHideLanguages.includes(code) ||
        (autoDetectedLanguages?.length && autoDetectedLanguages.includes(code))
      ) {
        topLanguages.push(l);
      } else {
        restLanguages.push(l);
      }
    });
    topLanguages.sort(([codeA, commonA], [codeB, commonB]) => {
      if (codeA === language) return -1;
      if (codeB === language) return 1;
      return commonA.localeCompare(commonB);
    });
    restLanguages.sort(([codeA, commonA], [codeB, commonB]) =>
      commonA.localeCompare(commonB),
    );
    return [topLanguages, restLanguages];
  }, [language, autoDetectedLanguages]);

  const replyToStatusMonthsAgo = useMemo(
    () =>
      !!replyToStatus?.createdAt &&
      Math.floor(
        (Date.now() - new Date(replyToStatus.createdAt)) /
          (1000 * 60 * 60 * 24 * 30),
      ),
    [replyToStatus],
  );

  const onMinimize = () => {
    saveUnsavedDraft();
    states.composerState.minimized = true;
  };

  const gifPickerDisabled =
    uiState === 'loading' ||
    (maxMediaAttachments !== undefined &&
      mediaAttachments.length >= maxMediaAttachments) ||
    !!poll;

  // If maxOptions is not defined or defined and is greater than 1, show poll button
  const showPollButton = maxOptions == null || maxOptions > 1;
  const pollButtonDisabled =
    uiState === 'loading' || !!poll || !!mediaAttachments.length;
  const onPollButtonClick = () => {
    setPoll({
      options: ['', ''],
      expiresIn: 24 * 60 * 60, // 1 day
      multiple: false,
    });
  };

  const addSubToolbarRef = useRef();
  const [showAddButton, setShowAddButton] = useState(false);
  useResizeObserver({
    ref: addSubToolbarRef,
    box: 'border-box',
    onResize: ({ width }) => {
      // If scrollable, it's truncated
      const { scrollWidth } = addSubToolbarRef.current;
      const truncated = scrollWidth > width;
      const overTruncated = width < 84; // roughly two buttons width
      setShowAddButton(overTruncated || truncated);
      addSubToolbarRef.current.hidden = overTruncated;
    },
  });

  const showScheduledAt = !editStatus;
  const scheduledAtButtonDisabled = uiState === 'loading' || !!scheduledAt;
  const onScheduledAtClick = () => {
    const date = new Date(Date.now() + MIN_SCHEDULED_AT);
    setScheduledAt(date);
  };

  return (
    <div id="compose-container-outer">
      <div id="compose-container" class={standalone ? 'standalone' : ''}>
        <div class="compose-top">
          {currentAccountInfo?.avatarStatic && (
            // <Avatar
            //   url={currentAccountInfo.avatarStatic}
            //   size="xl"
            //   alt={currentAccountInfo.username}
            //   squircle={currentAccountInfo?.bot}
            // />
            <AccountBlock
              account={currentAccountInfo}
              accountInstance={currentAccount.instanceURL}
              hideDisplayName
              useAvatarStatic
            />
          )}
          {!standalone ? (
            <span class="compose-controls">
              <button
                type="button"
                class="plain4 pop-button"
                disabled={uiState === 'loading'}
                onClick={() => {
                  // If there are non-ID media attachments (not yet uploaded), show confirmation dialog because they are not going to be passed to the new window
                  // const containNonIDMediaAttachments =
                  //   mediaAttachments.length > 0 &&
                  //   mediaAttachments.some((media) => !media.id);
                  // if (containNonIDMediaAttachments) {
                  //   const yes = confirm(
                  //     'You have media attachments that are not yet uploaded. Opening a new window will discard them and you will need to re-attach them. Are you sure you want to continue?',
                  //   );
                  //   if (!yes) {
                  //     return;
                  //   }
                  // }

                  // const mediaAttachmentsWithIDs = mediaAttachments.filter(
                  //   (media) => media.id,
                  // );

                  const newWin = openCompose({
                    editStatus,
                    replyToStatus,
                    draftStatus: {
                      uid: UID.current,
                      status: textareaRef.current.value,
                      spoilerText: spoilerTextRef.current.value,
                      visibility,
                      language,
                      sensitive,
                      poll,
                      mediaAttachments,
                      scheduledAt,
                    },
                  });

                  if (!newWin) {
                    return;
                  }

                  onClose();
                }}
              >
                <Icon icon="popout" alt={t`Pop out`} />
              </button>
              <button
                type="button"
                class="plain4 min-button"
                onClick={onMinimize}
              >
                <Icon icon="minimize" alt={t`Minimize`} />
              </button>{' '}
              <button
                type="button"
                class="light close-button"
                disabled={uiState === 'loading'}
                onClick={() => {
                  if (confirmClose()) {
                    onClose();
                  }
                }}
              >
                <Icon icon="x" alt={t`Close`} />
              </button>
            </span>
          ) : (
            hasOpener && (
              <button
                type="button"
                class="light pop-button"
                disabled={uiState === 'loading'}
                onClick={() => {
                  // If there are non-ID media attachments (not yet uploaded), show confirmation dialog because they are not going to be passed to the new window
                  // const containNonIDMediaAttachments =
                  //   mediaAttachments.length > 0 &&
                  //   mediaAttachments.some((media) => !media.id);
                  // if (containNonIDMediaAttachments) {
                  //   const yes = confirm(
                  //     'You have media attachments that are not yet uploaded. Opening a new window will discard them and you will need to re-attach them. Are you sure you want to continue?',
                  //   );
                  //   if (!yes) {
                  //     return;
                  //   }
                  // }

                  if (!window.opener) {
                    alert(t`Looks like you closed the parent window.`);
                    return;
                  }

                  if (window.opener.__STATES__.showCompose) {
                    if (window.opener.__STATES__.composerState?.publishing) {
                      alert(
                        t`Looks like you already have a compose field open in the parent window and currently publishing. Please wait for it to be done and try again later.`,
                      );
                      return;
                    }

                    let confirmText = t`Looks like you already have a compose field open in the parent window. Popping in this window will discard the changes you made in the parent window. Continue?`;
                    const yes = confirm(confirmText);
                    if (!yes) return;
                  }

                  // const mediaAttachmentsWithIDs = mediaAttachments.filter(
                  //   (media) => media.id,
                  // );

                  onClose({
                    fn: () => {
                      const passData = {
                        editStatus,
                        replyToStatus,
                        draftStatus: {
                          uid: UID.current,
                          status: textareaRef.current.value,
                          spoilerText: spoilerTextRef.current.value,
                          visibility,
                          language,
                          sensitive,
                          poll,
                          mediaAttachments,
                          scheduledAt,
                        },
                      };
                      window.opener.__COMPOSE__ = passData; // Pass it here instead of `showCompose` due to some weird proxy issue again
                      if (window.opener.__STATES__.showCompose) {
                        window.opener.__STATES__.showCompose = false;
                        setTimeout(() => {
                          window.opener.__STATES__.showCompose = true;
                        }, 10);
                      } else {
                        window.opener.__STATES__.showCompose = true;
                      }
                      if (window.opener.__STATES__.composerState.minimized) {
                        // Maximize it
                        window.opener.__STATES__.composerState.minimized = false;
                      }
                    },
                  });
                }}
              >
                <Icon icon="popin" alt={t`Pop in`} />
              </button>
            )
          )}
        </div>
        {!!replyToStatus && (
          <div class="status-preview">
            <Status status={replyToStatus} size="s" previewMode />
            <div class="status-preview-legend reply-to">
              {replyToStatusMonthsAgo > 0 ? (
                <Trans>
                  Replying to @
                  {replyToStatus.account.acct || replyToStatus.account.username}
                  &rsquo;s post (
                  <strong>
                    {rtf.format(-replyToStatusMonthsAgo, 'month')}
                  </strong>
                  )
                </Trans>
              ) : (
                <Trans>
                  Replying to @
                  {replyToStatus.account.acct || replyToStatus.account.username}
                  &rsquo;s post
                </Trans>
              )}
            </div>
          </div>
        )}
        {!!editStatus && (
          <div class="status-preview">
            <Status status={editStatus} size="s" previewMode />
            <div class="status-preview-legend">
              <Trans>Editing source post</Trans>
            </div>
          </div>
        )}
        <form
          ref={formRef}
          class={`form-visibility-${visibility}`}
          style={{
            pointerEvents: uiState === 'loading' ? 'none' : 'auto',
            opacity: uiState === 'loading' ? 0.5 : 1,
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              formRef.current.dispatchEvent(
                new Event('submit', { cancelable: true }),
              );
            }
          }}
          onSubmit={(e) => {
            e.preventDefault();

            const formData = new FormData(e.target);
            const entries = Object.fromEntries(formData.entries());
            console.log('ENTRIES', entries);
            let { status, visibility, sensitive, spoilerText, scheduledAt } =
              entries;

            // Pre-cleanup
            sensitive = sensitive === 'on'; // checkboxes return "on" if checked

            // Convert datetime-local input value to RFC3339 Date string value
            scheduledAt = scheduledAt
              ? new Date(scheduledAt).toISOString()
              : undefined;

            // Validation
            /* Let the backend validate this
          if (stringLength(status) > maxCharacters) {
            alert(`Status is too long! Max characters: ${maxCharacters}`);
            return;
          }
          if (
            sensitive &&
            stringLength(status) + stringLength(spoilerText) > maxCharacters
          ) {
            alert(
              `Status and content warning is too long! Max characters: ${maxCharacters}`,
            );
            return;
          }
          */
            if (poll) {
              if (poll.options.length < 2) {
                alert(t`Poll must have at least 2 options`);
                return;
              }
              if (poll.options.some((option) => option === '')) {
                alert(t`Some poll choices are empty`);
                return;
              }
            }
            // TODO: check for URLs and use `charactersReservedPerUrl` to calculate max characters

            if (mediaAttachments.length > 0) {
              // If there are media attachments, check if they have no descriptions
              const hasNoDescriptions = mediaAttachments.some(
                (media) => !media.description?.trim?.(),
              );
              if (hasNoDescriptions) {
                const yes = confirm(
                  t`Some media have no descriptions. Continue?`,
                );
                if (!yes) return;
              }
            }

            // Post-cleanup
            spoilerText = (sensitive && spoilerText) || undefined;
            status = status === '' ? undefined : status;

            // states.composerState.minimized = true;
            states.composerState.publishing = true;
            setUIState('loading');
            (async () => {
              try {
                console.log('MEDIA ATTACHMENTS', mediaAttachments);
                if (mediaAttachments.length > 0) {
                  // Upload media attachments first
                  const mediaPromises = mediaAttachments.map((attachment) => {
                    const { file, description, id } = attachment;
                    console.log('UPLOADING', attachment);
                    if (id) {
                      // If already uploaded
                      return attachment;
                    } else {
                      const params = removeNullUndefined({
                        file,
                        description,
                      });
                      return masto.v2.media.create(params).then((res) => {
                        if (res.id) {
                          attachment.id = res.id;
                        }
                        return res;
                      });
                    }
                  });
                  const results = await Promise.allSettled(mediaPromises);

                  // If any failed, return
                  if (
                    results.some((result) => {
                      return result.status === 'rejected' || !result.value?.id;
                    })
                  ) {
                    states.composerState.publishing = false;
                    states.composerState.publishingError = true;
                    setUIState('error');
                    // Alert all the reasons
                    results.forEach((result) => {
                      if (result.status === 'rejected') {
                        console.error(result);
                        alert(result.reason || t`Attachment #${i} failed`);
                      }
                    });
                    return;
                  }

                  console.log({ results, mediaAttachments });
                }

                /* NOTE:
                Using snakecase here because masto.js's `isObject` returns false for `params`, ONLY happens when opening in pop-out window. This is maybe due to `window.masto` variable being passed from the parent window. The check that failed is `x.constructor === Object`, so maybe the `Object` in new window is different than parent window's?
                Code: https://github.com/neet/masto.js/blob/dd0d649067b6a2b6e60fbb0a96597c373a255b00/src/serializers/is-object.ts#L2

                // TODO: Note above is no longer true in Masto.js v6. Revisit this.
              */
                let params = {
                  status,
                  // spoilerText,
                  spoiler_text: spoilerText,
                  language,
                  sensitive,
                  poll,
                  // mediaIds: mediaAttachments.map((attachment) => attachment.id),
                  media_ids: mediaAttachments.map(
                    (attachment) => attachment.id,
                  ),
                };
                if (editStatus && supports('@mastodon/edit-media-attributes')) {
                  params.media_attributes = mediaAttachments.map(
                    (attachment) => {
                      return {
                        id: attachment.id,
                        description: attachment.description,
                        // focus
                        // thumbnail
                      };
                    },
                  );
                } else if (!editStatus) {
                  params.visibility = visibility;
                  // params.inReplyToId = replyToStatus?.id || undefined;
                  params.in_reply_to_id = replyToStatus?.id || undefined;
                  params.scheduled_at = scheduledAt;
                }
                params = removeNullUndefined(params);
                console.log('POST', params);

                let newStatus;
                if (editStatus) {
                  newStatus = await masto.v1.statuses
                    .$select(editStatus.id)
                    .update(params);
                  saveStatus(newStatus, instance, {
                    skipThreading: true,
                  });
                } else {
                  try {
                    newStatus = await masto.v1.statuses.create(params, {
                      requestInit: {
                        headers: {
                          'Idempotency-Key': UID.current,
                        },
                      },
                    });
                  } catch (_) {
                    // If idempotency key fails, try again without it
                    newStatus = await masto.v1.statuses.create(params);
                  }
                }
                states.composerState.minimized = false;
                states.composerState.publishing = false;
                setUIState('default');

                // Close
                onClose({
                  // type: post, reply, edit
                  type: editStatus ? 'edit' : replyToStatus ? 'reply' : 'post',
                  newStatus,
                  instance,
                  scheduledAt,
                });
              } catch (e) {
                states.composerState.publishing = false;
                states.composerState.publishingError = true;
                console.error(e);
                alert(e?.reason || e);
                setUIState('error');
              }
            })();
          }}
        >
          <div class="toolbar stretch">
            <input
              ref={spoilerTextRef}
              type="text"
              name="spoilerText"
              placeholder={t`Content warning`}
              disabled={uiState === 'loading'}
              class="spoiler-text-field"
              lang={language}
              spellCheck="true"
              dir="auto"
              style={{
                opacity: sensitive ? 1 : 0,
                pointerEvents: sensitive ? 'auto' : 'none',
              }}
              onInput={() => {
                updateCharCount();
              }}
            />
            <label
              class={`toolbar-button ${sensitive ? 'highlight' : ''}`}
              title={t`Content warning or sensitive media`}
            >
              <input
                name="sensitive"
                type="checkbox"
                checked={sensitive}
                disabled={uiState === 'loading'}
                onChange={(e) => {
                  const sensitive = e.target.checked;
                  setSensitive(sensitive);
                  if (sensitive) {
                    spoilerTextRef.current?.focus();
                  } else {
                    textareaRef.current?.focus();
                  }
                }}
              />
              <Icon icon={`eye-${sensitive ? 'close' : 'open'}`} />
            </label>{' '}
            <label
              class={`toolbar-button ${
                visibility !== 'public' && !sensitive ? 'show-field' : ''
              } ${visibility !== 'public' ? 'highlight' : ''}`}
              title={visibility}
            >
              <Icon icon={visibilityIconsMap[visibility]} alt={visibility} />
              <select
                name="visibility"
                value={visibility}
                onChange={(e) => {
                  setVisibility(e.target.value);
                }}
                disabled={uiState === 'loading' || !!editStatus}
                dir="auto"
              >
                <option value="public">
                  <Trans>Public</Trans>
                </option>
                {(supports('@pleroma/local-visibility-post') ||
                  supports('@akkoma/local-visibility-post')) && (
                  <option value="local">
                    <Trans>Local</Trans>
                  </option>
                )}
                <option value="unlisted">
                  <Trans>Unlisted</Trans>
                </option>
                <option value="private">
                  <Trans>Followers only</Trans>
                </option>
                <option value="direct">
                  <Trans>Private mention</Trans>
                </option>
              </select>
            </label>{' '}
          </div>
          <Textarea
            ref={textareaRef}
            placeholder={
              replyToStatus
                ? t`Post your reply`
                : editStatus
                  ? t`Edit your post`
                  : t`What are you doing?`
            }
            required={mediaAttachments?.length === 0}
            disabled={uiState === 'loading'}
            lang={language}
            onInput={() => {
              updateCharCount();
            }}
            maxCharacters={maxCharacters}
            performSearch={(params) => {
              const { type, q, limit } = params;
              if (type === 'accounts') {
                return masto.v1.accounts.search.list({
                  q,
                  limit,
                  resolve: false,
                });
              }
              return masto.v2.search.fetch(params);
            }}
            onTrigger={(action) => {
              if (action?.name === 'custom-emojis') {
                setShowEmoji2Picker({
                  defaultSearchTerm: action?.defaultSearchTerm || null,
                });
              } else if (action?.name === 'mention') {
                setShowMentionPicker({
                  defaultSearchTerm: action?.defaultSearchTerm || null,
                });
              } else if (
                action?.name === 'auto-detect-language' &&
                action?.languages
              ) {
                setAutoDetectedLanguages(action.languages);
              }
            }}
          />
          {mediaAttachments?.length > 0 && (
            <div class="media-attachments">
              {mediaAttachments.map((attachment, i) => {
                const { id, file } = attachment;
                const fileID = file?.size + file?.type + file?.name;
                return (
                  <MediaAttachment
                    key={id || fileID || i}
                    attachment={attachment}
                    disabled={uiState === 'loading'}
                    lang={language}
                    onDescriptionChange={(value) => {
                      setMediaAttachments((attachments) => {
                        const newAttachments = [...attachments];
                        newAttachments[i] = {
                          ...newAttachments[i],
                          description: value,
                        };
                        return newAttachments;
                      });
                    }}
                    onRemove={() => {
                      setMediaAttachments((attachments) => {
                        return attachments.filter((_, j) => j !== i);
                      });
                    }}
                  />
                );
              })}
              <label class="media-sensitive">
                <input
                  name="sensitive"
                  type="checkbox"
                  checked={sensitive}
                  disabled={uiState === 'loading'}
                  onChange={(e) => {
                    const sensitive = e.target.checked;
                    setSensitive(sensitive);
                  }}
                />{' '}
                <span>
                  <Trans>Mark media as sensitive</Trans>
                </span>{' '}
                <Icon icon={`eye-${sensitive ? 'close' : 'open'}`} />
              </label>
            </div>
          )}
          {!!poll && (
            <Poll
              lang={language}
              maxOptions={maxOptions}
              maxExpiration={maxExpiration}
              minExpiration={minExpiration}
              maxCharactersPerOption={maxCharactersPerOption}
              poll={poll}
              disabled={uiState === 'loading'}
              onInput={(poll) => {
                if (poll) {
                  const newPoll = { ...poll };
                  setPoll(newPoll);
                } else {
                  setPoll(null);
                }
              }}
            />
          )}
          {scheduledAt && (
            <div class="toolbar scheduled-at">
              <button
                type="button"
                class="plain4 small"
                onClick={() => {
                  setScheduledAt(null);
                }}
              >
                <Icon icon="x" />
              </button>
              <label>
                <Trans>
                  Posting on{' '}
                  <ScheduledAtField
                    scheduledAt={scheduledAt}
                    setScheduledAt={setScheduledAt}
                  />
                </Trans>
                <br />
                <small>{getLocalTimezoneName()}</small>
              </label>
            </div>
          )}
          <div class="toolbar compose-footer">
            <span class="add-toolbar-button-group spacer">
              {showAddButton && (
                <Menu2
                  portal={{
                    target: document.body,
                  }}
                  containerProps={{
                    style: {
                      zIndex: 1001,
                    },
                  }}
                  menuButton={({ open }) => (
                    <button
                      type="button"
                      class={`toolbar-button add-button ${
                        open ? 'active' : ''
                      }`}
                    >
                      <Icon icon="plus" title={t`Add`} />
                    </button>
                  )}
                >
                  {supportsCameraCapture && (
                    <MenuItem className="compose-menu-add-media">
                      <label class="compose-menu-add-media-field">
                        <CameraCaptureInput
                          hidden
                          supportedMimeTypes={supportedImagesVideosTypes}
                          disabled={
                            uiState === 'loading' ||
                            mediaAttachments.length >= maxMediaAttachments ||
                            !!poll
                          }
                          setMediaAttachments={setMediaAttachments}
                        />
                      </label>
                      <Icon icon="camera" /> <span>{_(ADD_LABELS.camera)}</span>
                    </MenuItem>
                  )}
                  <MenuItem className="compose-menu-add-media">
                    <label class="compose-menu-add-media-field">
                      <FilePickerInput
                        hidden
                        supportedMimeTypes={supportedMimeTypes}
                        maxMediaAttachments={maxMediaAttachments}
                        mediaAttachments={mediaAttachments}
                        disabled={
                          uiState === 'loading' ||
                          mediaAttachments.length >= maxMediaAttachments ||
                          !!poll
                        }
                        setMediaAttachments={setMediaAttachments}
                      />
                    </label>
                    <Icon icon="media" /> <span>{_(ADD_LABELS.media)}</span>
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setShowEmoji2Picker(true);
                    }}
                  >
                    <Icon icon="emoji2" />{' '}
                    <span>{_(ADD_LABELS.customEmoji)}</span>
                  </MenuItem>
                  {!!states.settings.composerGIFPicker && (
                    <MenuItem
                      disabled={gifPickerDisabled}
                      onClick={() => {
                        setShowGIFPicker(true);
                      }}
                    >
                      <span class="icon icon-gif" role="img" />
                      <span>{_(ADD_LABELS.gif)}</span>
                    </MenuItem>
                  )}
                  {showPollButton && (
                    <MenuItem
                      disabled={pollButtonDisabled}
                      onClick={onPollButtonClick}
                    >
                      <Icon icon="poll" /> <span>{_(ADD_LABELS.poll)}</span>
                    </MenuItem>
                  )}
                  {showScheduledAt && (
                    <MenuItem
                      disabled={scheduledAtButtonDisabled}
                      onClick={onScheduledAtClick}
                    >
                      <Icon icon="schedule" />{' '}
                      <span>{_(ADD_LABELS.scheduledPost)}</span>
                    </MenuItem>
                  )}
                </Menu2>
              )}
              <span class="add-sub-toolbar-button-group" ref={addSubToolbarRef}>
                {supportsCameraCapture && (
                  <label class="toolbar-button">
                    <CameraCaptureInput
                      supportedMimeTypes={supportedImagesVideosTypes}
                      mediaAttachments={mediaAttachments}
                      disabled={
                        uiState === 'loading' ||
                        mediaAttachments.length >= maxMediaAttachments ||
                        !!poll
                      }
                      setMediaAttachments={setMediaAttachments}
                    />
                    <Icon icon="camera" alt={_(ADD_LABELS.camera)} />
                  </label>
                )}
                <label class="toolbar-button">
                  <FilePickerInput
                    supportedMimeTypes={supportedMimeTypes}
                    maxMediaAttachments={maxMediaAttachments}
                    mediaAttachments={mediaAttachments}
                    disabled={
                      uiState === 'loading' ||
                      mediaAttachments.length >= maxMediaAttachments ||
                      !!poll
                    }
                    setMediaAttachments={setMediaAttachments}
                  />
                  <Icon icon="media" alt={_(ADD_LABELS.media)} />
                </label>
                {/* <button
                type="button"
                class="toolbar-button"
                disabled={uiState === 'loading'}
                onClick={() => {
                  setShowMentionPicker(true);
                }}
              >
                <Icon icon="at" />
              </button> */}
                <button
                  type="button"
                  class="toolbar-button"
                  disabled={uiState === 'loading'}
                  onClick={() => {
                    setShowEmoji2Picker(true);
                  }}
                >
                  <Icon icon="emoji2" alt={_(ADD_LABELS.customEmoji)} />
                </button>
                {!!states.settings.composerGIFPicker && (
                  <button
                    type="button"
                    class="toolbar-button gif-picker-button"
                    disabled={gifPickerDisabled}
                    onClick={() => {
                      setShowGIFPicker(true);
                    }}
                  >
                    <span
                      class="icon icon-gif"
                      aria-label={_(ADD_LABELS.gif)}
                    />
                  </button>
                )}
                {showPollButton && (
                  <>
                    <button
                      type="button"
                      class="toolbar-button"
                      disabled={pollButtonDisabled}
                      onClick={onPollButtonClick}
                    >
                      <Icon icon="poll" alt={_(ADD_LABELS.poll)} />
                    </button>
                  </>
                )}
                {showScheduledAt && (
                  <button
                    type="button"
                    class={`toolbar-button ${scheduledAt ? 'highlight' : ''}`}
                    disabled={scheduledAtButtonDisabled}
                    onClick={onScheduledAtClick}
                  >
                    <Icon icon="schedule" alt={_(ADD_LABELS.scheduledPost)} />
                  </button>
                )}
              </span>
            </span>
            {/* <div class="spacer" /> */}
            {uiState === 'loading' ? (
              <Loader abrupt />
            ) : (
              <CharCountMeter
                maxCharacters={maxCharacters}
                hidden={uiState === 'loading'}
              />
            )}
            <label
              class={`toolbar-button ${
                language !== prevLanguage.current ||
                (autoDetectedLanguages?.length &&
                  !autoDetectedLanguages.includes(language))
                  ? 'highlight'
                  : ''
              }`}
            >
              <span class="icon-text">
                {supportedLanguagesMap[language]?.native}
              </span>
              <select
                name="language"
                value={language}
                onChange={(e) => {
                  const { value } = e.target;
                  setLanguage(value || DEFAULT_LANG);
                  store.session.set('currentLanguage', value || DEFAULT_LANG);
                }}
                disabled={uiState === 'loading'}
                dir="auto"
              >
                {topSupportedLanguages.map(([code, common, native]) => {
                  const commonText = localeCode2Text({
                    code,
                    fallback: common,
                  });
                  const showCommon = commonText !== native;
                  return (
                    <option value={code} key={code}>
                      {showCommon ? `${native} - ${commonText}` : commonText}
                    </option>
                  );
                })}
                <hr />
                {restSupportedLanguages.map(([code, common, native]) => {
                  const commonText = localeCode2Text({
                    code,
                    fallback: common,
                  });
                  const showCommon = commonText !== native;
                  return (
                    <option value={code} key={code}>
                      {showCommon ? `${native} - ${commonText}` : commonText}
                    </option>
                  );
                })}
              </select>
            </label>{' '}
            <button type="submit" disabled={uiState === 'loading'}>
              {scheduledAt
                ? t`Schedule`
                : replyToStatus
                  ? t`Reply`
                  : editStatus
                    ? t`Update`
                    : t({
                        message: 'Post',
                        context: 'Submit button in composer',
                      })}
            </button>
          </div>
        </form>
      </div>
      {showMentionPicker && (
        <Modal
          onClose={() => {
            setShowMentionPicker(false);
          }}
        >
          <MentionModal
            masto={masto}
            instance={instance}
            onClose={() => {
              setShowMentionPicker(false);
            }}
            defaultSearchTerm={showMentionPicker?.defaultSearchTerm}
            onSelect={(socialAddress) => {
              const textarea = textareaRef.current;
              if (!textarea) return;
              const { selectionStart, selectionEnd } = textarea;
              const text = textarea.value;
              const textBeforeMention = text.slice(0, selectionStart);
              const spaceBeforeMention = textBeforeMention
                ? /[\s\t\n\r]$/.test(textBeforeMention)
                  ? ''
                  : ' '
                : '';
              const textAfterMention = text.slice(selectionEnd);
              const spaceAfterMention = /^[\s\t\n\r]/.test(textAfterMention)
                ? ''
                : ' ';
              const newText =
                textBeforeMention +
                spaceBeforeMention +
                '@' +
                socialAddress +
                spaceAfterMention +
                textAfterMention;
              textarea.value = newText;
              textarea.selectionStart = textarea.selectionEnd =
                selectionEnd +
                1 +
                socialAddress.length +
                spaceAfterMention.length;
              textarea.focus();
              textarea.dispatchEvent(new Event('input'));
            }}
          />
        </Modal>
      )}
      {showEmoji2Picker && (
        <Modal
          onClose={() => {
            setShowEmoji2Picker(false);
          }}
        >
          <CustomEmojisModal
            masto={masto}
            instance={instance}
            onClose={() => {
              setShowEmoji2Picker(false);
            }}
            defaultSearchTerm={showEmoji2Picker?.defaultSearchTerm}
            onSelect={(emojiShortcode) => {
              const textarea = textareaRef.current;
              if (!textarea) return;
              const { selectionStart, selectionEnd } = textarea;
              const text = textarea.value;
              const textBeforeEmoji = text.slice(0, selectionStart);
              const spaceBeforeEmoji = textBeforeEmoji
                ? /[\s\t\n\r]$/.test(textBeforeEmoji)
                  ? ''
                  : ' '
                : '';
              const textAfterEmoji = text.slice(selectionEnd);
              const spaceAfterEmoji = /^[\s\t\n\r]/.test(textAfterEmoji)
                ? ''
                : ' ';
              const newText =
                textBeforeEmoji +
                spaceBeforeEmoji +
                emojiShortcode +
                spaceAfterEmoji +
                textAfterEmoji;
              textarea.value = newText;
              textarea.selectionStart = textarea.selectionEnd =
                selectionEnd + emojiShortcode.length + spaceAfterEmoji.length;
              textarea.focus();
              textarea.dispatchEvent(new Event('input'));
            }}
          />
        </Modal>
      )}
      {showGIFPicker && (
        <Modal
          onClose={() => {
            setShowGIFPicker(false);
          }}
        >
          <GIFPickerModal
            onClose={() => setShowGIFPicker(false)}
            onSelect={({ url, type, alt_text }) => {
              console.log('GIF URL', url);
              if (mediaAttachments.length >= maxMediaAttachments) {
                alert(
                  plural(maxMediaAttachments, {
                    one: 'You can only attach up to 1 file.',
                    other: 'You can only attach up to # files.',
                  }),
                );
                return;
              }
              // Download the GIF and insert it as media attachment
              (async () => {
                let theToast;
                try {
                  theToast = showToast({
                    text: t`Downloading GIF…`,
                    duration: -1,
                  });
                  const blob = await fetch(url, {
                    referrerPolicy: 'no-referrer',
                  }).then((res) => res.blob());
                  const file = new File(
                    [blob],
                    type === 'video/mp4' ? 'video.mp4' : 'image.gif',
                    {
                      type,
                    },
                  );
                  const newMediaAttachments = [
                    ...mediaAttachments,
                    {
                      file,
                      type,
                      size: file.size,
                      id: null,
                      description: alt_text || '',
                    },
                  ];
                  setMediaAttachments(newMediaAttachments);
                  theToast?.hideToast?.();
                } catch (err) {
                  console.error(err);
                  theToast?.hideToast?.();
                  showToast(t`Failed to download GIF`);
                }
              })();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

const supportsCameraCapture = (() => {
  const input = document.createElement('input');
  return 'capture' in input;
})();
function CameraCaptureInput({
  hidden,
  disabled = false,
  supportedMimeTypes,
  setMediaAttachments,
}) {
  return (
    <input
      type="file"
      hidden={hidden}
      accept={supportedMimeTypes?.join(',')}
      capture="environment"
      disabled={disabled}
      onChange={(e) => {
        const files = e.target.files;
        if (!files) return;
        const mediaFile = Array.from(files)[0];
        if (!mediaFile) return;
        setMediaAttachments((attachments) => [
          ...attachments,
          {
            file: mediaFile,
            type: mediaFile.type,
            size: mediaFile.size,
            url: URL.createObjectURL(mediaFile),
            id: null, // indicate uploaded state
            description: null,
          },
        ]);
        e.target.value = null;
      }}
    />
  );
}

function FilePickerInput({
  hidden,
  supportedMimeTypes,
  maxMediaAttachments,
  mediaAttachments,
  disabled = false,
  setMediaAttachments,
}) {
  return (
    <input
      type="file"
      hidden={hidden}
      accept={supportedMimeTypes?.join(',')}
      multiple={
        maxMediaAttachments === undefined ||
        maxMediaAttachments - mediaAttachments >= 2
      }
      disabled={disabled}
      onChange={(e) => {
        const files = e.target.files;
        if (!files) return;

        const mediaFiles = Array.from(files).map((file) => ({
          file,
          type: file.type,
          size: file.size,
          url: URL.createObjectURL(file),
          id: null, // indicate uploaded state
          description: null,
        }));
        console.log('MEDIA ATTACHMENTS', files, mediaFiles);

        // Validate max media attachments
        if (mediaAttachments.length + mediaFiles.length > maxMediaAttachments) {
          alert(
            plural(maxMediaAttachments, {
              one: 'You can only attach up to 1 file.',
              other: 'You can only attach up to # files.',
            }),
          );
        } else {
          setMediaAttachments((attachments) => {
            return attachments.concat(mediaFiles);
          });
        }
        // Reset
        e.target.value = '';
      }}
    />
  );
}

function autoResizeTextarea(textarea) {
  if (!textarea) return;
  const { value, offsetHeight, scrollHeight, clientHeight } = textarea;
  if (offsetHeight < window.innerHeight) {
    // NOTE: This check is needed because the offsetHeight return 50000 (really large number) on first render
    // No idea why it does that, will re-investigate in far future
    const offset = offsetHeight - clientHeight;
    const height = value ? scrollHeight + offset + 'px' : null;
    textarea.style.height = height;
  }
}

async function _getCustomEmojis(instance, masto) {
  const emojis = await masto.v1.customEmojis.list();
  const visibleEmojis = emojis.filter((e) => e.visibleInPicker);
  const searcher = new Fuse(visibleEmojis, {
    keys: ['shortcode'],
    findAllMatches: true,
  });
  return [visibleEmojis, searcher];
}
const getCustomEmojis = pmem(_getCustomEmojis, {
  // Limit by time to reduce memory usage
  // Cached by instance
  matchesArg: (cacheKeyArg, keyArg) => cacheKeyArg.instance === keyArg.instance,
  maxAge: 30 * 60 * 1000, // 30 minutes
});

const detectLangs = async (text) => {
  if (langDetector) {
    const langs = await langDetector.detect(text);
    if (langs?.length) {
      return langs.slice(0, 2).map((lang) => lang.detectedLanguage);
    }
  }
  const { detectAll } = await import('tinyld/light');
  const langs = detectAll(text);
  if (langs?.length) {
    // return max 2
    return langs.slice(0, 2).map((lang) => lang.lang);
  }
  return null;
};

const Textarea = forwardRef((props, ref) => {
  const { t } = useLingui();
  const { masto, instance } = api();
  const [text, setText] = useState(ref.current?.value || '');
  const {
    maxCharacters,
    performSearch = () => {},
    onTrigger = () => {},
    ...textareaProps
  } = props;
  // const snapStates = useSnapshot(states);
  // const charCount = snapStates.composerCharacterCount;

  // const customEmojis = useRef();
  const searcherRef = useRef();
  useEffect(() => {
    getCustomEmojis(instance, masto)
      .then((r) => {
        const [emojis, searcher] = r;
        searcherRef.current = searcher;
      })
      .catch((e) => {
        console.error(e);
      });
  }, []);

  const textExpanderRef = useRef();
  const textExpanderTextRef = useRef('');
  const hasTextExpanderRef = useRef(false);
  useEffect(() => {
    let handleChange,
      handleValue,
      handleCommited,
      handleActivate,
      handleDeactivate;
    if (textExpanderRef.current) {
      handleChange = (e) => {
        // console.log('text-expander-change', e);
        const { key, provide, text } = e.detail;
        textExpanderTextRef.current = text;

        if (text === '') {
          provide(
            Promise.resolve({
              matched: false,
            }),
          );
          return;
        }

        if (key === ':') {
          // const emojis = customEmojis.current.filter((emoji) =>
          //   emoji.shortcode.startsWith(text),
          // );
          // const emojis = filterShortcodes(customEmojis.current, text);
          const results = searcherRef.current?.search(text, {
            limit: 5,
          });
          let html = '';
          results.forEach(({ item: emoji }) => {
            const { shortcode, url } = emoji;
            html += `
                <li role="option" data-value="${encodeHTML(shortcode)}">
                <img src="${encodeHTML(
                  url,
                )}" width="16" height="16" alt="" loading="lazy" /> 
                ${encodeHTML(shortcode)}
              </li>`;
          });
          html += `<li role="option" data-value="" data-more="${text}">${t`More…`}</li>`;
          // console.log({ emojis, html });
          menu.innerHTML = html;
          provide(
            Promise.resolve({
              matched: results.length > 0,
              fragment: menu,
            }),
          );
          return;
        }

        const type = {
          '@': 'accounts',
          '#': 'hashtags',
        }[key];
        provide(
          new Promise((resolve) => {
            const searchResults = performSearch({
              type,
              q: text,
              limit: 5,
            });
            searchResults.then((value) => {
              if (text !== textExpanderTextRef.current) {
                return;
              }
              console.log({ value, type, v: value[type] });
              const results = value[type] || value;
              console.log('RESULTS', value, results);
              let html = '';
              results.forEach((result) => {
                const {
                  name,
                  avatarStatic,
                  displayName,
                  username,
                  acct,
                  emojis,
                  history,
                } = result;
                const displayNameWithEmoji = emojifyText(displayName, emojis);
                // const item = menuItem.cloneNode();
                if (acct) {
                  html += `
                    <li role="option" data-value="${encodeHTML(acct)}">
                      <span class="avatar">
                        <img src="${encodeHTML(
                          avatarStatic,
                        )}" width="16" height="16" alt="" loading="lazy" />
                      </span>
                      <span>
                        <b>${displayNameWithEmoji || username}</b>
                        <br><span class="bidi-isolate">@${encodeHTML(
                          acct,
                        )}</span>
                      </span>
                    </li>
                  `;
                } else {
                  const total = history?.reduce?.(
                    (acc, cur) => acc + +cur.uses,
                    0,
                  );
                  html += `
                    <li role="option" data-value="${encodeHTML(name)}">
                      <span class="grow">#<b>${encodeHTML(name)}</b></span>
                      ${
                        total
                          ? `<span class="count">${shortenNumber(total)}</span>`
                          : ''
                      }
                    </li>
                  `;
                }
              });
              if (type === 'accounts') {
                html += `<li role="option" data-value="" data-more="${text}">${t`More…`}</li>`;
              }
              menu.innerHTML = html;
              console.log('MENU', results, menu);
              resolve({
                matched: results.length > 0,
                fragment: menu,
              });
            });
          }),
        );
      };

      textExpanderRef.current.addEventListener(
        'text-expander-change',
        handleChange,
      );

      handleValue = (e) => {
        const { key, item } = e.detail;
        const { value, more } = item.dataset;
        if (key === ':') {
          e.detail.value = value ? `:${value}:` : '​'; // zero-width space
          if (more) {
            // Prevent adding space after the above value
            e.detail.continue = true;

            setTimeout(() => {
              onTrigger?.({
                name: 'custom-emojis',
                defaultSearchTerm: more,
              });
            }, 300);
          }
        } else if (key === '@') {
          e.detail.value = value ? `@${value} ` : '​'; // zero-width space
          if (more) {
            e.detail.continue = true;
            setTimeout(() => {
              onTrigger?.({
                name: 'mention',
                defaultSearchTerm: more,
              });
            }, 300);
          }
        } else {
          e.detail.value = `${key}${value}`;
        }
      };

      textExpanderRef.current.addEventListener(
        'text-expander-value',
        handleValue,
      );

      handleCommited = (e) => {
        const { input } = e.detail;
        setText(input.value);
        // fire input event
        if (ref.current) {
          const event = new Event('input', { bubbles: true });
          ref.current.dispatchEvent(event);
        }
      };

      textExpanderRef.current.addEventListener(
        'text-expander-committed',
        handleCommited,
      );

      handleActivate = () => {
        hasTextExpanderRef.current = true;
      };

      textExpanderRef.current.addEventListener(
        'text-expander-activate',
        handleActivate,
      );

      handleDeactivate = () => {
        hasTextExpanderRef.current = false;
      };

      textExpanderRef.current.addEventListener(
        'text-expander-deactivate',
        handleDeactivate,
      );
    }

    return () => {
      if (textExpanderRef.current) {
        textExpanderRef.current.removeEventListener(
          'text-expander-change',
          handleChange,
        );
        textExpanderRef.current.removeEventListener(
          'text-expander-value',
          handleValue,
        );
        textExpanderRef.current.removeEventListener(
          'text-expander-committed',
          handleCommited,
        );
        textExpanderRef.current.removeEventListener(
          'text-expander-activate',
          handleActivate,
        );
        textExpanderRef.current.removeEventListener(
          'text-expander-deactivate',
          handleDeactivate,
        );
      }
    };
  }, []);

  useEffect(() => {
    // Resize observer for textarea
    const textarea = ref.current;
    if (!textarea) return;
    const resizeObserver = new ResizeObserver(() => {
      // Get height of textarea, set height to textExpander
      if (textExpanderRef.current) {
        const { height } = textarea.getBoundingClientRect();
        textExpanderRef.current.style.height = height + 'px';
      }
    });
    resizeObserver.observe(textarea);
  }, []);

  const slowHighlightPerf = useRef(0); // increment if slow
  const composeHighlightRef = useRef();
  const throttleHighlightText = useThrottledCallback((text) => {
    if (!composeHighlightRef.current) return;
    if (slowHighlightPerf.current > 3) {
      // After 3 times of lag, disable highlighting
      composeHighlightRef.current.innerHTML = '';
      composeHighlightRef.current = null; // Destroy the whole thing
      throttleHighlightText?.cancel?.();
      return;
    }
    let start;
    let end;
    if (slowHighlightPerf.current <= 3) start = Date.now();
    composeHighlightRef.current.innerHTML =
      highlightText(text, {
        maxCharacters,
      }) + '\n';
    if (slowHighlightPerf.current <= 3) end = Date.now();
    console.debug('HIGHLIGHT PERF', { start, end, diff: end - start });
    if (start && end && end - start > 50) {
      // if slow, increment
      slowHighlightPerf.current++;
    }
    // Newline to prevent multiple line breaks at the end from being collapsed, no idea why
  }, 500);

  const debouncedAutoDetectLanguage = useDebouncedCallback(() => {
    // Make use of the highlightRef to get the DOM
    // Clone the dom
    const dom = composeHighlightRef.current?.cloneNode(true);
    if (!dom) return;
    // Remove mark
    dom.querySelectorAll('mark').forEach((mark) => {
      mark.remove();
    });
    const text = dom.innerText?.trim();
    if (!text) return;
    (async () => {
      const langs = await detectLangs(text);
      if (langs?.length) {
        onTrigger?.({
          name: 'auto-detect-language',
          languages: langs,
        });
      }
    })();
  }, 2000);

  return (
    <text-expander
      ref={textExpanderRef}
      keys="@ # :"
      class="compose-field-container"
    >
      <textarea
        class="compose-field"
        autoCapitalize="sentences"
        autoComplete="on"
        autoCorrect="on"
        spellCheck="true"
        dir="auto"
        rows="6"
        cols="50"
        {...textareaProps}
        ref={ref}
        name="status"
        value={text}
        onKeyDown={(e) => {
          // Get line before cursor position after pressing 'Enter'
          const { key, target } = e;
          const hasTextExpander = hasTextExpanderRef.current;
          if (key === 'Enter' && !(e.ctrlKey || e.metaKey || hasTextExpander)) {
            try {
              const { value, selectionStart } = target;
              const textBeforeCursor = value.slice(0, selectionStart);
              const lastLine = textBeforeCursor.split('\n').slice(-1)[0];
              if (lastLine) {
                // If line starts with "- " or "12. "
                if (/^\s*(-|\d+\.)\s/.test(lastLine)) {
                  // insert "- " at cursor position
                  const [_, preSpaces, bullet, postSpaces, anything] =
                    lastLine.match(/^(\s*)(-|\d+\.)(\s+)(.+)?/) || [];
                  if (anything) {
                    e.preventDefault();
                    const [number] = bullet.match(/\d+/) || [];
                    const newBullet = number ? `${+number + 1}.` : '-';
                    const text = `\n${preSpaces}${newBullet}${postSpaces}`;
                    target.setRangeText(text, selectionStart, selectionStart);
                    const pos = selectionStart + text.length;
                    target.setSelectionRange(pos, pos);
                  } else {
                    // trim the line before the cursor, then insert new line
                    const pos = selectionStart - lastLine.length;
                    target.setRangeText('', pos, selectionStart);
                  }
                  autoResizeTextarea(target);
                  target.dispatchEvent(new Event('input'));
                }
              }
            } catch (e) {
              // silent fail
              console.error(e);
            }
          }
          if (composeHighlightRef.current) {
            composeHighlightRef.current.scrollTop = target.scrollTop;
          }
        }}
        onInput={(e) => {
          const { target } = e;
          // Replace zero-width space
          const text = target.value.replace(/\u200b/g, '');
          setText(text);
          autoResizeTextarea(target);
          props.onInput?.(e);
          throttleHighlightText(text);
          debouncedAutoDetectLanguage();
        }}
        style={{
          width: '100%',
          height: '4em',
          // '--text-weight': (1 + charCount / 140).toFixed(1) || 1,
        }}
        onScroll={(e) => {
          if (composeHighlightRef.current) {
            const { scrollTop } = e.target;
            composeHighlightRef.current.scrollTop = scrollTop;
          }
        }}
      />
      <div
        ref={composeHighlightRef}
        class="compose-highlight"
        aria-hidden="true"
      />
    </text-expander>
  );
});

function CharCountMeter({ maxCharacters = 500, hidden }) {
  const snapStates = useSnapshot(states);
  const charCount = snapStates.composerCharacterCount;
  const leftChars = maxCharacters - charCount;
  if (hidden) {
    return <span class="char-counter" hidden />;
  }
  return (
    <span
      class="char-counter"
      title={`${leftChars}/${maxCharacters}`}
      style={{
        '--percentage': (charCount / maxCharacters) * 100,
      }}
    >
      <meter
        class={`${
          leftChars <= -10
            ? 'explode'
            : leftChars <= 0
              ? 'danger'
              : leftChars <= 20
                ? 'warning'
                : ''
        }`}
        value={charCount}
        max={maxCharacters}
      />
      <span class="counter">{leftChars}</span>
    </span>
  );
}

function scaleDimension(matrix, matrixLimit, width, height) {
  // matrix = number of pixels
  // matrixLimit = max number of pixels
  // Calculate new width and height, downsize to within the limit, preserve aspect ratio, no decimals
  const scalingFactor = Math.sqrt(matrixLimit / matrix);
  const newWidth = Math.floor(width * scalingFactor);
  const newHeight = Math.floor(height * scalingFactor);
  return { newWidth, newHeight };
}

function MediaAttachment({
  attachment,
  disabled,
  lang,
  onDescriptionChange = () => {},
  onRemove = () => {},
}) {
  const { i18n, t } = useLingui();
  const [uiState, setUIState] = useState('default');
  const supportsEdit = supports('@mastodon/edit-media-attributes');
  const { type, id, file } = attachment;
  const url = useMemo(
    () => (file ? URL.createObjectURL(file) : attachment.url),
    [file, attachment.url],
  );
  console.log({ attachment });

  const checkMaxError = !!file?.size;
  const configuration = checkMaxError ? getCurrentInstanceConfiguration() : {};
  const {
    mediaAttachments: {
      imageSizeLimit,
      imageMatrixLimit,
      videoSizeLimit,
      videoMatrixLimit,
      videoFrameRateLimit,
    } = {},
  } = configuration || {};

  const [maxError, setMaxError] = useState(() => {
    if (!checkMaxError) return null;
    if (
      type.startsWith('image') &&
      imageSizeLimit &&
      file.size > imageSizeLimit
    ) {
      return {
        type: 'imageSizeLimit',
        details: {
          imageSize: file.size,
          imageSizeLimit,
        },
      };
    } else if (
      type.startsWith('video') &&
      videoSizeLimit &&
      file.size > videoSizeLimit
    ) {
      return {
        type: 'videoSizeLimit',
        details: {
          videoSize: file.size,
          videoSizeLimit,
        },
      };
    }
    return null;
  });

  const [imageMatrix, setImageMatrix] = useState({});
  useEffect(() => {
    if (!checkMaxError || !imageMatrixLimit) return;
    if (imageMatrix?.matrix > imageMatrixLimit) {
      setMaxError({
        type: 'imageMatrixLimit',
        details: {
          imageMatrix: imageMatrix?.matrix,
          imageMatrixLimit,
          width: imageMatrix?.width,
          height: imageMatrix?.height,
        },
      });
    }
  }, [imageMatrix, imageMatrixLimit, checkMaxError]);

  const [videoMatrix, setVideoMatrix] = useState({});
  useEffect(() => {
    if (!checkMaxError || !videoMatrixLimit) return;
    if (videoMatrix?.matrix > videoMatrixLimit) {
      setMaxError({
        type: 'videoMatrixLimit',
        details: {
          videoMatrix: videoMatrix?.matrix,
          videoMatrixLimit,
          width: videoMatrix?.width,
          height: videoMatrix?.height,
        },
      });
    }
  }, [videoMatrix, videoMatrixLimit, checkMaxError]);

  const [description, setDescription] = useState(attachment.description);
  const [suffixType, subtype] = type.split('/');
  const debouncedOnDescriptionChange = useDebouncedCallback(
    onDescriptionChange,
    250,
  );
  useEffect(() => {
    debouncedOnDescriptionChange(description);
  }, [description, debouncedOnDescriptionChange]);

  const [showModal, setShowModal] = useState(false);
  const textareaRef = useRef(null);
  useEffect(() => {
    let timer;
    if (showModal && textareaRef.current) {
      timer = setTimeout(() => {
        textareaRef.current.focus();
      }, 100);
    }
    return () => {
      clearTimeout(timer);
    };
  }, [showModal]);

  const descTextarea = (
    <>
      {!!id && !supportsEdit ? (
        <div class="media-desc">
          <span class="tag">
            <Trans>Uploaded</Trans>
          </span>
          <p title={description}>
            {attachment.description || <i>No description</i>}
          </p>
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={description || ''}
          lang={lang}
          placeholder={
            {
              image: t`Image description`,
              video: t`Video description`,
              audio: t`Audio description`,
            }[suffixType]
          }
          autoCapitalize="sentences"
          autoComplete="on"
          autoCorrect="on"
          spellCheck="true"
          dir="auto"
          disabled={disabled || uiState === 'loading'}
          class={uiState === 'loading' ? 'loading' : ''}
          maxlength="1500" // Not unicode-aware :(
          // TODO: Un-hard-code this maxlength, ref: https://github.com/mastodon/mastodon/blob/b59fb28e90bc21d6fd1a6bafd13cfbd81ab5be54/app/models/media_attachment.rb#L39
          onInput={(e) => {
            const { value } = e.target;
            setDescription(value);
            // debouncedOnDescriptionChange(value);
          }}
        ></textarea>
      )}
    </>
  );

  const toastRef = useRef(null);
  useEffect(() => {
    return () => {
      toastRef.current?.hideToast?.();
    };
  }, []);

  const maxErrorToast = useRef(null);

  const maxErrorText = (err) => {
    const { type, details } = err;
    switch (type) {
      case 'imageSizeLimit': {
        const { imageSize, imageSizeLimit } = details;
        return t`File size too large. Uploading might encounter issues. Try reduce the file size from ${prettyBytes(
          imageSize,
        )} to ${prettyBytes(imageSizeLimit)} or lower.`;
      }
      case 'imageMatrixLimit': {
        const { imageMatrix, imageMatrixLimit, width, height } = details;
        const { newWidth, newHeight } = scaleDimension(
          imageMatrix,
          imageMatrixLimit,
          width,
          height,
        );
        return t`Dimension too large. Uploading might encounter issues. Try reduce dimension from ${i18n.number(
          width,
        )}×${i18n.number(height)}px to ${i18n.number(newWidth)}×${i18n.number(
          newHeight,
        )}px.`;
      }
      case 'videoSizeLimit': {
        const { videoSize, videoSizeLimit } = details;
        return t`File size too large. Uploading might encounter issues. Try reduce the file size from ${prettyBytes(
          videoSize,
        )} to ${prettyBytes(videoSizeLimit)} or lower.`;
      }
      case 'videoMatrixLimit': {
        const { videoMatrix, videoMatrixLimit, width, height } = details;
        const { newWidth, newHeight } = scaleDimension(
          videoMatrix,
          videoMatrixLimit,
          width,
          height,
        );
        return t`Dimension too large. Uploading might encounter issues. Try reduce dimension from ${i18n.number(
          width,
        )}×${i18n.number(height)}px to ${i18n.number(newWidth)}×${i18n.number(
          newHeight,
        )}px.`;
      }
      case 'videoFrameRateLimit': {
        // Not possible to detect this on client-side for now
        return t`Frame rate too high. Uploading might encounter issues.`;
      }
    }
  };

  return (
    <>
      <div class="media-attachment">
        <div
          class="media-preview"
          tabIndex="0"
          onClick={() => {
            setShowModal(true);
          }}
        >
          {suffixType === 'image' ? (
            <img
              src={url}
              alt=""
              onLoad={(e) => {
                if (!checkMaxError) return;
                const { naturalWidth, naturalHeight } = e.target;
                setImageMatrix({
                  matrix: naturalWidth * naturalHeight,
                  width: naturalWidth,
                  height: naturalHeight,
                });
              }}
            />
          ) : suffixType === 'video' || suffixType === 'gifv' ? (
            <video
              src={url + '#t=0.1'} // Make Safari show 1st-frame preview
              playsinline
              muted
              disablePictureInPicture
              preload="metadata"
              onLoadedMetadata={(e) => {
                if (!checkMaxError) return;
                const { videoWidth, videoHeight } = e.target;
                if (videoWidth && videoHeight) {
                  setVideoMatrix({
                    matrix: videoWidth * videoHeight,
                    width: videoWidth,
                    height: videoHeight,
                  });
                }
              }}
            />
          ) : suffixType === 'audio' ? (
            <audio src={url} controls />
          ) : null}
        </div>
        {descTextarea}
        <div class="media-aside">
          <button
            type="button"
            class="plain close-button"
            disabled={disabled}
            onClick={onRemove}
          >
            <Icon icon="x" alt={t`Remove`} />
          </button>
          {!!maxError && (
            <button
              type="button"
              class="media-error"
              title={maxErrorText(maxError)}
              onClick={() => {
                if (maxErrorToast.current) {
                  maxErrorToast.current.hideToast();
                }
                maxErrorToast.current = showToast({
                  text: maxErrorText(maxError),
                  duration: 10_000,
                });
              }}
            >
              <Icon icon="alert" alt={t`Error`} />
            </button>
          )}
        </div>
      </div>
      {showModal && (
        <Modal
          onClose={() => {
            setShowModal(false);
          }}
        >
          <div id="media-sheet" class="sheet sheet-max">
            <button
              type="button"
              class="sheet-close"
              onClick={() => {
                setShowModal(false);
              }}
            >
              <Icon icon="x" alt={t`Close`} />
            </button>
            <header>
              <h2>
                {
                  {
                    image: t`Edit image description`,
                    video: t`Edit video description`,
                    audio: t`Edit audio description`,
                  }[suffixType]
                }
              </h2>
            </header>
            <main tabIndex="-1">
              <div class="media-preview">
                {suffixType === 'image' ? (
                  <img src={url} alt="" />
                ) : suffixType === 'video' || suffixType === 'gifv' ? (
                  <video src={url} playsinline controls />
                ) : suffixType === 'audio' ? (
                  <audio src={url} controls />
                ) : null}
              </div>
              <div class="media-form">
                {descTextarea}
                <footer>
                  {suffixType === 'image' &&
                    /^(png|jpe?g|gif|webp)$/i.test(subtype) &&
                    !!states.settings.mediaAltGenerator &&
                    !!IMG_ALT_API_URL && (
                      <Menu2
                        portal={{
                          target: document.body,
                        }}
                        containerProps={{
                          style: {
                            zIndex: 1001,
                          },
                        }}
                        align="center"
                        position="anchor"
                        overflow="auto"
                        menuButton={
                          <button type="button" class="plain">
                            <Icon icon="more" size="l" alt={t`More`} />
                          </button>
                        }
                      >
                        <MenuItem
                          disabled={uiState === 'loading'}
                          onClick={() => {
                            setUIState('loading');
                            toastRef.current = showToast({
                              text: t`Generating description. Please wait…`,
                              duration: -1,
                            });
                            // POST with multipart
                            (async function () {
                              try {
                                const body = new FormData();
                                body.append('image', file);
                                const response = await fetch(IMG_ALT_API_URL, {
                                  method: 'POST',
                                  body,
                                }).then((r) => r.json());
                                if (response.error) {
                                  throw new Error(response.error);
                                }
                                setDescription(response.description);
                              } catch (e) {
                                console.error(e);
                                showToast(
                                  e.message
                                    ? t`Failed to generate description: ${e.message}`
                                    : t`Failed to generate description`,
                                );
                              } finally {
                                setUIState('default');
                                toastRef.current?.hideToast?.();
                              }
                            })();
                          }}
                        >
                          <Icon icon="sparkles2" />
                          {lang && lang !== 'en' ? (
                            <small>
                              <Trans>Generate description…</Trans>
                              <br />
                              (English)
                            </small>
                          ) : (
                            <span>
                              <Trans>Generate description…</Trans>
                            </span>
                          )}
                        </MenuItem>
                        {!!lang && lang !== 'en' && (
                          <MenuItem
                            disabled={uiState === 'loading'}
                            onClick={() => {
                              setUIState('loading');
                              toastRef.current = showToast({
                                text: t`Generating description. Please wait…`,
                                duration: -1,
                              });
                              // POST with multipart
                              (async function () {
                                try {
                                  const body = new FormData();
                                  body.append('image', file);
                                  const params = `?lang=${lang}`;
                                  const response = await fetch(
                                    IMG_ALT_API_URL + params,
                                    {
                                      method: 'POST',
                                      body,
                                    },
                                  ).then((r) => r.json());
                                  if (response.error) {
                                    throw new Error(response.error);
                                  }
                                  setDescription(response.description);
                                } catch (e) {
                                  console.error(e);
                                  showToast(
                                    t`Failed to generate description${
                                      e?.message ? `: ${e.message}` : ''
                                    }`,
                                  );
                                } finally {
                                  setUIState('default');
                                  toastRef.current?.hideToast?.();
                                }
                              })();
                            }}
                          >
                            <Icon icon="sparkles2" />
                            <small>
                              <Trans>Generate description…</Trans>
                              <br />
                              <Trans>
                                ({localeCode2Text(lang)}){' '}
                                <span class="more-insignificant">
                                  — experimental
                                </span>
                              </Trans>
                            </small>
                          </MenuItem>
                        )}
                      </Menu2>
                    )}
                  <button
                    type="button"
                    class="light block"
                    onClick={() => {
                      setShowModal(false);
                    }}
                    disabled={uiState === 'loading'}
                  >
                    <Trans>Done</Trans>
                  </button>
                </footer>
              </div>
            </main>
          </div>
        </Modal>
      )}
    </>
  );
}

function Poll({
  lang,
  poll,
  disabled,
  onInput = () => {},
  maxOptions,
  maxExpiration,
  minExpiration,
  maxCharactersPerOption,
}) {
  const { t } = useLingui();
  const { options, expiresIn, multiple } = poll;

  return (
    <div class={`poll ${multiple ? 'multiple' : ''}`}>
      <div class="poll-choices">
        {options.map((option, i) => (
          <div class="poll-choice" key={i}>
            <input
              required
              type="text"
              value={option}
              disabled={disabled}
              maxlength={maxCharactersPerOption}
              placeholder={t`Choice ${i + 1}`}
              lang={lang}
              spellCheck="true"
              dir="auto"
              onInput={(e) => {
                const { value } = e.target;
                options[i] = value;
                onInput(poll);
              }}
            />
            <button
              type="button"
              class="plain2 poll-button"
              disabled={disabled || options.length <= 1}
              onClick={() => {
                options.splice(i, 1);
                onInput(poll);
              }}
            >
              <Icon icon="x" size="s" alt={t`Remove`} />
            </button>
          </div>
        ))}
      </div>
      <div class="poll-toolbar">
        <button
          type="button"
          class="plain2 poll-button"
          disabled={disabled || options.length >= maxOptions}
          onClick={() => {
            options.push('');
            onInput(poll);
          }}
        >
          +
        </button>{' '}
        <label class="multiple-choices">
          <input
            type="checkbox"
            checked={multiple}
            disabled={disabled}
            onChange={(e) => {
              const { checked } = e.target;
              poll.multiple = checked;
              onInput(poll);
            }}
          />{' '}
          <Trans>Multiple choices</Trans>
        </label>
        <label class="expires-in">
          <Trans>Duration</Trans>{' '}
          <select
            value={expiresIn}
            disabled={disabled}
            onChange={(e) => {
              const { value } = e.target;
              poll.expiresIn = value;
              onInput(poll);
            }}
          >
            {Object.entries(expiryOptions)
              .filter(([value]) => {
                return value >= minExpiration && value <= maxExpiration;
              })
              .map(([value, label]) => (
                <option value={value} key={value}>
                  {label()}
                </option>
              ))}
          </select>
        </label>
      </div>
      <div class="poll-toolbar">
        <button
          type="button"
          class="plain remove-poll-button"
          disabled={disabled}
          onClick={() => {
            onInput(null);
          }}
        >
          <Trans>Remove poll</Trans>
        </button>
      </div>
    </div>
  );
}

function filterShortcodes(emojis, searchTerm) {
  searchTerm = searchTerm.toLowerCase();

  // Return an array of shortcodes that start with or contain the search term, sorted by relevance and limited to the first 5
  return emojis
    .sort((a, b) => {
      let aLower = a.shortcode.toLowerCase();
      let bLower = b.shortcode.toLowerCase();

      let aStartsWith = aLower.startsWith(searchTerm);
      let bStartsWith = bLower.startsWith(searchTerm);
      let aContains = aLower.includes(searchTerm);
      let bContains = bLower.includes(searchTerm);
      let bothStartWith = aStartsWith && bStartsWith;
      let bothContain = aContains && bContains;

      return bothStartWith
        ? a.length - b.length
        : aStartsWith
          ? -1
          : bStartsWith
            ? 1
            : bothContain
              ? a.length - b.length
              : aContains
                ? -1
                : bContains
                  ? 1
                  : 0;
    })
    .slice(0, 5);
}

function encodeHTML(str) {
  return str.replace(/[&<>"']/g, function (char) {
    return '&#' + char.charCodeAt(0) + ';';
  });
}

function removeNullUndefined(obj) {
  for (let key in obj) {
    if (obj[key] === null || obj[key] === undefined) {
      delete obj[key];
    }
  }
  return obj;
}

function MentionModal({
  onClose = () => {},
  onSelect = () => {},
  defaultSearchTerm,
}) {
  const { t } = useLingui();
  const { masto } = api();
  const [uiState, setUIState] = useState('default');
  const [accounts, setAccounts] = useState([]);
  const [relationshipsMap, setRelationshipsMap] = useState({});

  const [selectedIndex, setSelectedIndex] = useState(0);

  const loadRelationships = async (accounts) => {
    if (!accounts?.length) return;
    const relationships = await fetchRelationships(accounts, relationshipsMap);
    if (relationships) {
      setRelationshipsMap({
        ...relationshipsMap,
        ...relationships,
      });
    }
  };

  const loadAccounts = (term) => {
    if (!term) return;
    setUIState('loading');
    (async () => {
      try {
        const accounts = await masto.v1.accounts.search.list({
          q: term,
          limit: 40,
          resolve: false,
        });
        setAccounts(accounts);
        loadRelationships(accounts);
        setUIState('default');
      } catch (e) {
        setUIState('error');
        console.error(e);
      }
    })();
  };

  const debouncedLoadAccounts = useDebouncedCallback(loadAccounts, 1000);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const inputRef = useRef();
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      // Put cursor at the end
      if (inputRef.current.value) {
        inputRef.current.selectionStart = inputRef.current.value.length;
        inputRef.current.selectionEnd = inputRef.current.value.length;
      }
    }
  }, []);

  useEffect(() => {
    if (defaultSearchTerm) {
      loadAccounts(defaultSearchTerm);
    }
  }, [defaultSearchTerm]);

  const selectAccount = (account) => {
    const socialAddress = account.acct;
    onSelect(socialAddress);
    onClose();
  };

  useHotkeys(
    'enter',
    () => {
      const selectedAccount = accounts[selectedIndex];
      if (selectedAccount) {
        selectAccount(selectedAccount);
      }
    },
    {
      preventDefault: true,
      enableOnFormTags: ['input'],
    },
  );

  const listRef = useRef();
  useHotkeys(
    'down',
    () => {
      if (selectedIndex < accounts.length - 1) {
        setSelectedIndex(selectedIndex + 1);
      } else {
        setSelectedIndex(0);
      }
      setTimeout(() => {
        const selectedItem = listRef.current.querySelector('.selected');
        if (selectedItem) {
          selectedItem.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center',
          });
        }
      }, 1);
    },
    {
      preventDefault: true,
      enableOnFormTags: ['input'],
    },
  );

  useHotkeys(
    'up',
    () => {
      if (selectedIndex > 0) {
        setSelectedIndex(selectedIndex - 1);
      } else {
        setSelectedIndex(accounts.length - 1);
      }
      setTimeout(() => {
        const selectedItem = listRef.current.querySelector('.selected');
        if (selectedItem) {
          selectedItem.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center',
          });
        }
      }, 1);
    },
    {
      preventDefault: true,
      enableOnFormTags: ['input'],
    },
  );

  return (
    <div id="mention-sheet" class="sheet">
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" alt={t`Close`} />
        </button>
      )}
      <header>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            debouncedLoadAccounts.flush?.();
            // const searchTerm = inputRef.current.value;
            // debouncedLoadAccounts(searchTerm);
          }}
        >
          <input
            ref={inputRef}
            required
            type="search"
            class="block"
            placeholder={t`Search accounts`}
            onInput={(e) => {
              const { value } = e.target;
              debouncedLoadAccounts(value);
            }}
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellCheck="false"
            dir="auto"
            defaultValue={defaultSearchTerm || ''}
          />
        </form>
      </header>
      <main>
        {accounts?.length > 0 ? (
          <ul
            ref={listRef}
            class={`accounts-list ${uiState === 'loading' ? 'loading' : ''}`}
          >
            {accounts.map((account, i) => {
              const relationship = relationshipsMap[account.id];
              return (
                <li
                  key={account.id}
                  class={i === selectedIndex ? 'selected' : ''}
                >
                  <AccountBlock
                    avatarSize="xxl"
                    account={account}
                    relationship={relationship}
                    showStats
                    showActivity
                  />
                  <button
                    type="button"
                    class="plain2"
                    onClick={() => {
                      selectAccount(account);
                    }}
                  >
                    <Icon icon="plus" size="xl" alt={t`Add`} />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : uiState === 'loading' ? (
          <div class="ui-state">
            <Loader abrupt />
          </div>
        ) : uiState === 'error' ? (
          <div class="ui-state">
            <p>
              <Trans>Error loading accounts</Trans>
            </p>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function CustomEmojisModal({
  masto,
  instance,
  onClose = () => {},
  onSelect = () => {},
  defaultSearchTerm,
}) {
  const { t } = useLingui();
  const [uiState, setUIState] = useState('default');
  const customEmojisList = useRef([]);
  const [customEmojis, setCustomEmojis] = useState([]);
  const recentlyUsedCustomEmojis = useMemo(
    () => store.account.get('recentlyUsedCustomEmojis') || [],
  );
  const searcherRef = useRef();
  useEffect(() => {
    setUIState('loading');
    (async () => {
      try {
        const [emojis, searcher] = await getCustomEmojis(instance, masto);
        console.log('emojis', emojis);
        searcherRef.current = searcher;
        setCustomEmojis(emojis);
        setUIState('default');
      } catch (e) {
        setUIState('error');
        console.error(e);
      }
    })();
  }, []);

  const customEmojisCatList = useMemo(() => {
    // Group emojis by category
    const emojisCat = {
      '--recent--': recentlyUsedCustomEmojis.filter((emoji) =>
        customEmojis.find((e) => e.shortcode === emoji.shortcode),
      ),
    };
    const othersCat = [];
    customEmojis.forEach((emoji) => {
      customEmojisList.current?.push?.(emoji);
      if (!emoji.category) {
        othersCat.push(emoji);
        return;
      }
      if (!emojisCat[emoji.category]) {
        emojisCat[emoji.category] = [];
      }
      emojisCat[emoji.category].push(emoji);
    });
    if (othersCat.length) {
      emojisCat['--others--'] = othersCat;
    }
    return emojisCat;
  }, [customEmojis]);

  const scrollableRef = useRef();
  const [matches, setMatches] = useState(null);
  const onFind = useCallback(
    (e) => {
      const { value } = e.target;
      if (value) {
        const results = searcherRef.current?.search(value, {
          limit: CUSTOM_EMOJIS_COUNT,
        });
        setMatches(results.map((r) => r.item));
        scrollableRef.current?.scrollTo?.(0, 0);
      } else {
        setMatches(null);
      }
    },
    [customEmojis],
  );
  useEffect(() => {
    if (defaultSearchTerm && customEmojis?.length) {
      onFind({ target: { value: defaultSearchTerm } });
    }
  }, [defaultSearchTerm, onFind, customEmojis]);

  const onSelectEmoji = useCallback(
    (emoji) => {
      onSelect?.(emoji);
      onClose?.();

      queueMicrotask(() => {
        let recentlyUsedCustomEmojis =
          store.account.get('recentlyUsedCustomEmojis') || [];
        const recentlyUsedEmojiIndex = recentlyUsedCustomEmojis.findIndex(
          (e) => e.shortcode === emoji.shortcode,
        );
        if (recentlyUsedEmojiIndex !== -1) {
          // Move emoji to index 0
          recentlyUsedCustomEmojis.splice(recentlyUsedEmojiIndex, 1);
          recentlyUsedCustomEmojis.unshift(emoji);
        } else {
          recentlyUsedCustomEmojis.unshift(emoji);
          // Remove unavailable ones
          recentlyUsedCustomEmojis = recentlyUsedCustomEmojis.filter((e) =>
            customEmojisList.current?.find?.(
              (emoji) => emoji.shortcode === e.shortcode,
            ),
          );
          // Limit to 10
          recentlyUsedCustomEmojis = recentlyUsedCustomEmojis.slice(0, 10);
        }

        // Store back
        store.account.set('recentlyUsedCustomEmojis', recentlyUsedCustomEmojis);
      });
    },
    [onSelect],
  );

  const inputRef = useRef();
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      // Put cursor at the end
      if (inputRef.current.value) {
        inputRef.current.selectionStart = inputRef.current.value.length;
        inputRef.current.selectionEnd = inputRef.current.value.length;
      }
    }
  }, []);

  return (
    <div id="custom-emojis-sheet" class="sheet">
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" alt={t`Close`} />
        </button>
      )}
      <header>
        <div>
          <b>
            <Trans>Custom emojis</Trans>
          </b>{' '}
          {uiState === 'loading' ? (
            <Loader />
          ) : (
            <small class="insignificant"> • {instance}</small>
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const emoji = matches[0];
            if (emoji) {
              onSelectEmoji(`:${emoji.shortcode}:`);
            }
          }}
        >
          <input
            ref={inputRef}
            type="search"
            placeholder={t`Search emoji`}
            onInput={onFind}
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellCheck="false"
            dir="auto"
            defaultValue={defaultSearchTerm || ''}
          />
        </form>
      </header>
      <main ref={scrollableRef}>
        {matches !== null ? (
          <ul class="custom-emojis-matches custom-emojis-list">
            {matches.map((emoji) => (
              <li key={emoji.shortcode} class="custom-emojis-match">
                <CustomEmojiButton
                  emoji={emoji}
                  onClick={() => {
                    onSelectEmoji(`:${emoji.shortcode}:`);
                  }}
                  showCode
                />
              </li>
            ))}
          </ul>
        ) : (
          <div class="custom-emojis-list">
            {uiState === 'error' && (
              <div class="ui-state">
                <p>
                  <Trans>Error loading custom emojis</Trans>
                </p>
              </div>
            )}
            {uiState === 'default' &&
              Object.entries(customEmojisCatList).map(
                ([category, emojis]) =>
                  !!emojis?.length && (
                    <div class="section-container">
                      <div class="section-header">
                        {{
                          '--recent--': t`Recently used`,
                          '--others--': t`Others`,
                        }[category] || category}
                      </div>
                      <CustomEmojisList
                        emojis={emojis}
                        onSelect={onSelectEmoji}
                      />
                    </div>
                  ),
              )}
          </div>
        )}
      </main>
    </div>
  );
}

const CustomEmojisList = memo(({ emojis, onSelect }) => {
  const { i18n } = useLingui();
  const [max, setMax] = useState(CUSTOM_EMOJIS_COUNT);
  const showMore = emojis.length > max;
  return (
    <section>
      {emojis.slice(0, max).map((emoji) => (
        <CustomEmojiButton
          key={emoji.shortcode}
          emoji={emoji}
          onClick={() => {
            onSelect(`:${emoji.shortcode}:`);
          }}
        />
      ))}
      {showMore && (
        <button
          type="button"
          class="plain small"
          onClick={() => setMax(max + CUSTOM_EMOJIS_COUNT)}
        >
          <Trans>{i18n.number(emojis.length - max)} more…</Trans>
        </button>
      )}
    </section>
  );
});

const CustomEmojiButton = memo(({ emoji, onClick, showCode }) => {
  const addEdges = (e) => {
    // Add edge-left or edge-right class based on self position relative to scrollable parent
    // If near left edge, add edge-left, if near right edge, add edge-right
    const buffer = 88;
    const parent = e.currentTarget.closest('main');
    if (parent) {
      const rect = parent.getBoundingClientRect();
      const selfRect = e.currentTarget.getBoundingClientRect();
      const targetClassList = e.currentTarget.classList;
      if (selfRect.left < rect.left + buffer) {
        targetClassList.add('edge-left');
        targetClassList.remove('edge-right');
      } else if (selfRect.right > rect.right - buffer) {
        targetClassList.add('edge-right');
        targetClassList.remove('edge-left');
      } else {
        targetClassList.remove('edge-left', 'edge-right');
      }
    }
  };

  return (
    <button
      type="button"
      className="plain4"
      onClick={onClick}
      data-title={showCode ? undefined : emoji.shortcode}
      onPointerEnter={addEdges}
      onFocus={addEdges}
    >
      <picture>
        {!!emoji.staticUrl && (
          <source
            srcSet={emoji.staticUrl}
            media="(prefers-reduced-motion: reduce)"
          />
        )}
        <img
          className="shortcode-emoji"
          src={emoji.url || emoji.staticUrl}
          alt={emoji.shortcode}
          width="24"
          height="24"
          loading="lazy"
          decoding="async"
        />
      </picture>
      {showCode && (
        <>
          {' '}
          <code>{emoji.shortcode}</code>
        </>
      )}
    </button>
  );
});

const GIFS_PER_PAGE = 20;
function GIFPickerModal({ onClose = () => {}, onSelect = () => {} }) {
  const { i18n, t } = useLingui();
  const [uiState, setUIState] = useState('default');
  const [results, setResults] = useState([]);
  const formRef = useRef(null);
  const qRef = useRef(null);
  const currentOffset = useRef(0);
  const scrollableRef = useRef(null);

  function fetchGIFs({ offset }) {
    console.log('fetchGIFs', { offset });
    if (!qRef.current?.value) return;
    setUIState('loading');
    scrollableRef.current?.scrollTo?.({
      top: 0,
      left: 0,
      behavior: 'smooth',
    });
    (async () => {
      try {
        const query = {
          api_key: GIPHY_API_KEY,
          q: qRef.current.value,
          rating: 'g',
          limit: GIFS_PER_PAGE,
          bundle: 'messaging_non_clips',
          offset,
          lang: i18n.locale || 'en',
        };
        const response = await fetch(
          'https://api.giphy.com/v1/gifs/search?' + new URLSearchParams(query),
          {
            referrerPolicy: 'no-referrer',
          },
        ).then((r) => r.json());
        currentOffset.current = response.pagination?.offset || 0;
        setResults(response);
        setUIState('results');
      } catch (e) {
        setUIState('error');
        console.error(e);
      }
    })();
  }

  useEffect(() => {
    qRef.current?.focus();
  }, []);

  const debouncedOnInput = useDebouncedCallback(() => {
    fetchGIFs({ offset: 0 });
  }, 1000);

  return (
    <div id="gif-picker-sheet" class="sheet">
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" alt={t`Close`} />
        </button>
      )}
      <header>
        <form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            fetchGIFs({ offset: 0 });
          }}
        >
          <input
            ref={qRef}
            type="search"
            name="q"
            placeholder={t`Search GIFs`}
            required
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellCheck="false"
            dir="auto"
            onInput={debouncedOnInput}
          />
          <input
            type="image"
            class="powered-button"
            src={poweredByGiphyURL}
            width="86"
            height="30"
            alt={t`Powered by GIPHY`}
          />
        </form>
      </header>
      <main ref={scrollableRef} class={uiState === 'loading' ? 'loading' : ''}>
        {uiState === 'default' && (
          <div class="ui-state">
            <p class="insignificant">
              <Trans>Type to search GIFs</Trans>
            </p>
          </div>
        )}
        {uiState === 'loading' && !results?.data?.length && (
          <div class="ui-state">
            <Loader abrupt />
          </div>
        )}
        {results?.data?.length > 0 ? (
          <>
            <ul>
              {results.data.map((gif) => {
                const { id, images, title, alt_text } = gif;
                const {
                  fixed_height_small,
                  fixed_height_downsampled,
                  fixed_height,
                  original,
                } = images;
                const theImage = fixed_height_small?.url
                  ? fixed_height_small
                  : fixed_height_downsampled?.url
                    ? fixed_height_downsampled
                    : fixed_height;
                let { url, webp, width, height } = theImage;
                if (+height > 100) {
                  width = (width / height) * 100;
                  height = 100;
                }
                const urlObj = URL.parse(url);
                const strippedURL = urlObj.origin + urlObj.pathname;
                let strippedWebP;
                if (webp) {
                  const webpObj = URL.parse(webp);
                  strippedWebP = webpObj.origin + webpObj.pathname;
                }
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => {
                        const { mp4, url } = original;
                        const theURL = mp4 || url;
                        const urlObj = URL.parse(theURL);
                        const strippedURL = urlObj.origin + urlObj.pathname;
                        onClose();
                        onSelect({
                          url: strippedURL,
                          type: mp4 ? 'video/mp4' : 'image/gif',
                          alt_text: alt_text || title,
                        });
                      }}
                    >
                      <figure
                        style={{
                          '--figure-width': width + 'px',
                          // width: width + 'px'
                        }}
                      >
                        <picture>
                          {strippedWebP && (
                            <source srcset={strippedWebP} type="image/webp" />
                          )}
                          <img
                            src={strippedURL}
                            width={width}
                            height={height}
                            loading="lazy"
                            decoding="async"
                            alt={alt_text}
                            referrerpolicy="no-referrer"
                            onLoad={(e) => {
                              e.target.style.backgroundColor = 'transparent';
                            }}
                          />
                        </picture>
                        <figcaption>{alt_text || title}</figcaption>
                      </figure>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p class="pagination">
              {results.pagination?.offset > 0 && (
                <button
                  type="button"
                  class="light small"
                  disabled={uiState === 'loading'}
                  onClick={() => {
                    fetchGIFs({
                      offset: results.pagination?.offset - GIFS_PER_PAGE,
                    });
                  }}
                >
                  <Icon icon="chevron-left" />
                  <span>
                    <Trans>Previous</Trans>
                  </span>
                </button>
              )}
              <span />
              {results.pagination?.offset + results.pagination?.count <
                results.pagination?.total_count && (
                <button
                  type="button"
                  class="light small"
                  disabled={uiState === 'loading'}
                  onClick={() => {
                    fetchGIFs({
                      offset: results.pagination?.offset + GIFS_PER_PAGE,
                    });
                  }}
                >
                  <span>
                    <Trans>Next</Trans>
                  </span>{' '}
                  <Icon icon="chevron-right" />
                </button>
              )}
            </p>
          </>
        ) : (
          uiState === 'results' && (
            <div class="ui-state">
              <p>No results</p>
            </div>
          )
        )}
        {uiState === 'error' && (
          <div class="ui-state">
            <p>
              <Trans>Error loading GIFs</Trans>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default Compose;
