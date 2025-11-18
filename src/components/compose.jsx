import './compose.css';

import { msg, plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { MenuDivider, MenuItem } from '@szhsin/react-menu';
import { deepEqual } from 'fast-equals';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useHotkeys } from 'react-hotkeys-hook';
import stringLength from 'string-length';
import { uid } from 'uid/single';
import { useSnapshot } from 'valtio';

import supportedLanguages from '../data/status-supported-languages';
import { api, getPreferences } from '../utils/api';
import db from '../utils/db';
import { getDtfLocale } from '../utils/dtf-locale';
import localeMatch from '../utils/locale-match';
import localeCode2Text from '../utils/localeCode2Text';
import mem from '../utils/mem';
import openCompose from '../utils/open-compose';
import {
  getPostQuoteApprovalPolicy,
  supportsNativeQuote,
} from '../utils/quote-utils';
import RTF from '../utils/relative-time-format';
import showToast from '../utils/show-toast';
import states, { saveStatus } from '../utils/states';
import store from '../utils/store';
import {
  getAPIVersions,
  getCurrentAccount,
  getCurrentAccountNS,
  getCurrentInstanceConfiguration,
} from '../utils/store-utils';
import supports from '../utils/supports';
import unfurlMastodonLink from '../utils/unfurl-link';
import urlRegexObj from '../utils/url-regex';
import useCloseWatcher from '../utils/useCloseWatcher';
import useInterval from '../utils/useInterval';
import useThrottledResizeObserver from '../utils/useThrottledResizeObserver';
import visibilityIconsMap from '../utils/visibility-icons-map';
import visibilityText from '../utils/visibility-text';

import AccountBlock from './account-block';
// import Avatar from './avatar';
import CameraCaptureInput, {
  supportsCameraCapture,
} from './camera-capture-input';
import CharCountMeter from './char-count-meter';
import ComposePoll, { expiryOptions } from './compose-poll';
import Textarea from './compose-textarea';
import CustomEmojisModal from './custom-emojis-modal';
import FilePickerInput from './file-picker-input';
import GIFPickerModal from './gif-picker-modal';
import Icon from './icon';
import Loader from './loader';
import MediaAttachment from './media-attachment';
import MentionModal from './mention-modal';
import Menu2 from './menu2';
import Modal from './modal';
import QuoteSuggestion from './quote-suggestion';
import ScheduledAtField, {
  getLocalTimezoneName,
  MIN_SCHEDULED_AT,
} from './ScheduledAtField';
import Status from './status';
import TextExpander from './text-expander';

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

const expirySeconds = Object.keys(expiryOptions);
const oneDay = 24 * 60 * 60;

const expiresInFromExpiresAt = (expiresAt) => {
  if (!expiresAt) return oneDay;
  const delta = (Date.parse(expiresAt) - Date.now()) / 1000;
  return expirySeconds.find((s) => s >= delta) || oneDay;
};

const DEFAULT_LANG = localeMatch(
  [getDtfLocale(), ...navigator.languages],
  supportedLanguages.map((l) => l[0]),
  'en',
);

// https://github.com/mastodon/mastodon/blob/c4a429ed47e85a6bbf0d470a41cc2f64cf120c19/app/javascript/mastodon/features/compose/util/counter.js
const usernameRegex = /(^|[^\/\w])[@＠](([a-z0-9_]+)@[a-z0-9\.\-]+[a-z0-9]+)/gi;
const urlPlaceholder = '$2xxxxxxxxxxxxxxxxxxxxxxx';
function countableText(inputText) {
  return inputText
    .replace(urlRegexObj, urlPlaceholder)
    .replace(usernameRegex, '$1@$3');
}

// const rtf = new Intl.RelativeTimeFormat();
const LF = mem((locale) => new Intl.ListFormat(locale || undefined));

const ADD_LABELS = {
  camera: msg`Take photo or video`,
  media: msg`Add media`,
  customEmoji: msg`Add custom emoji`,
  gif: msg`Add GIF`,
  poll: msg`Add poll`,
  sensitive: msg`Add content warning`,
  scheduledPost: msg`Schedule post`,
};

const DEFAULT_SCHEDULED_AT = Math.max(10 * 60 * 1000, MIN_SCHEDULED_AT); // 10 mins

function Compose({
  onClose,
  replyToStatus,
  replyMode = 'all',
  editStatus,
  draftStatus,
  quoteStatus,
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

  const currentAccount = useMemo(getCurrentAccount, []);
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
      descriptionLimit,
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
  const [quoteApprovalPolicy, setQuoteApprovalPolicy] = useState('public');
  const [sensitive, setSensitive] = useState(false);
  const [sensitiveMedia, setSensitiveMedia] = useState(false);
  const [language, setLanguage] = useState(
    store.session.get('currentLanguage') || DEFAULT_LANG,
  );
  const prevLanguage = useRef(language);
  const [mediaAttachments, setMediaAttachments] = useState([]);
  const [poll, setPoll] = useState(null);
  const [scheduledAt, setScheduledAt] = useState(null);
  const [quoteSuggestion, setQuoteSuggestion] = useState(null);
  const [localQuoteStatus, setLocalQuoteStatus] = useState(quoteStatus);
  const [quoteCleared, setQuoteCleared] = useState(false);

  const prefs = getPreferences();

  const currentQuoteStatus = quoteCleared
    ? null
    : localQuoteStatus || quoteStatus;

  // Quote eligibility logic duplicated from status.jsx
  const checkQuoteEligibility = (status) => {
    if (!supportsNativeQuote()) return false;

    const { visibility, quoteApproval, account } = status;
    const isSelf = currentAccountInfo && currentAccountInfo.id === account.id;
    const isPublic = ['public', 'unlisted'].includes(visibility);
    const isMineAndPrivate = isSelf && visibility === 'private';

    const isQuoteAutomaticallyAccepted =
      quoteApproval?.currentUser === 'automatic' &&
      (isPublic || isMineAndPrivate);
    const isQuoteManuallyAccepted =
      quoteApproval?.currentUser === 'manual' && (isPublic || isMineAndPrivate);

    if (!isPublic && !isSelf) {
      return false;
    } else if (isQuoteAutomaticallyAccepted) {
      return true;
    } else if (isQuoteManuallyAccepted) {
      return true;
    } else {
      return false;
    }
  };

  const handlePastedLink = async (url) => {
    // Handle QP links
    if (supportsNativeQuote()) {
      // Quotes cannot coexist with media attachments or polls
      if (mediaAttachments.length > 0 || poll) {
        return;
      }

      // Cannot add/remove/replace current quote when editing
      if (editStatus) {
        return;
      }

      // Don't show quote suggestion when visibility is 'direct'
      if (visibility === 'direct') {
        return;
      }

      try {
        const unfurledData = await unfurlMastodonLink(instance, url);
        if (unfurledData?.id) {
          const status =
            states.statuses[`${unfurledData.instance}/${unfurledData.id}`];
          if (status && checkQuoteEligibility(status)) {
            // Don't show suggestion if it's the same as current quote
            if (currentQuoteStatus?.id === status.id) {
              return;
            }

            setQuoteSuggestion({
              status,
              instance: unfurledData.instance,
              url: unfurledData.originalURL,
            });
          }
        }
      } catch (error) {
        console.error(error);
      }
    }
  };

  const oninputTextarea = () => {
    if (!textareaRef.current) return;
    textareaRef.current.dispatchEvent(new Event('input'));
  };
  const focusTextarea = (cursorPosition) => {
    setTimeout(() => {
      if (!textareaRef.current) return;
      // If cursor position is provided, set it
      if (cursorPosition !== undefined) {
        textareaRef.current.setSelectionRange(cursorPosition, cursorPosition);
      }
      console.debug('FOCUS textarea');
      textareaRef.current?.focus();
    }, 300);
  };
  const insertTextAtCursor = ({ targetElement, text }) => {
    if (!targetElement) return;

    const { selectionStart, selectionEnd, value } = targetElement;
    let textBeforeInsert = value.slice(0, selectionStart);

    // Remove zero-width space from end of text
    textBeforeInsert = textBeforeInsert.replace(/\u200B$/, '');

    const spaceBeforeInsert = textBeforeInsert
      ? /[\s\t\n\r]$/.test(textBeforeInsert)
        ? ''
        : ' '
      : '';

    const textAfterInsert = value.slice(selectionEnd);
    const spaceAfterInsert = /^[\s\t\n\r]/.test(textAfterInsert) ? '' : ' ';

    const newText =
      textBeforeInsert +
      spaceBeforeInsert +
      text +
      spaceAfterInsert +
      textAfterInsert;

    targetElement.value = newText;
    targetElement.selectionStart = targetElement.selectionEnd =
      selectionEnd + text.length + spaceAfterInsert.length;
    targetElement.focus();
    targetElement.dispatchEvent(new Event('input'));
  };

  const lastFocusedFieldRef = useRef(null);
  const lastFocusedEmojiFieldRef = useRef(null);
  const focusLastFocusedField = () => {
    setTimeout(() => {
      if (!lastFocusedFieldRef.current) return;
      lastFocusedFieldRef.current.focus();
    }, 0);
  };
  const composeContainerRef = useRef(null);
  useEffect(() => {
    const handleFocus = (e) => {
      // Toggle focused if in or out if any fields are focused
      composeContainerRef.current.classList.toggle(
        'focused',
        e.type === 'focusin',
      );

      const target = e.target;
      if (target.hasAttribute('data-allow-custom-emoji')) {
        lastFocusedEmojiFieldRef.current = target;
      }
      const isFormElement = ['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA'].includes(
        target.tagName,
      );
      if (isFormElement) {
        lastFocusedFieldRef.current = target;
      }
    };

    const composeContainer = composeContainerRef.current;
    if (composeContainer) {
      composeContainer.addEventListener('focusin', handleFocus);
      composeContainer.addEventListener('focusout', handleFocus);
    }

    return () => {
      if (composeContainer) {
        composeContainer.removeEventListener('focusin', handleFocus);
        composeContainer.removeEventListener('focusout', handleFocus);
      }
    };
  }, []);

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
        const authorMention = `@${replyToStatus.account.acct}`;
        const otherMentions = allMentions
          .filter((m) => m !== replyToStatus.account.acct)
          .map((m) => `@${m}`);

        if (replyMode === 'author-only') {
          // Mode 1: Only mention the author
          textareaRef.current.value = `${authorMention} `;
          oninputTextarea();
          focusTextarea();
        } else if (replyMode === 'author-first') {
          // Mode 2: Mention author first, then others at the end after 2 newlines
          if (otherMentions.length > 0) {
            textareaRef.current.value = `${authorMention} \n\n${otherMentions.join(' ')}`;
            oninputTextarea();
            // Set cursor position after the author mention
            const cursorPosition = authorMention.length + 1; // +1 for the space
            focusTextarea(cursorPosition);
          } else {
            // If no other mentions, just mention the author
            textareaRef.current.value = `${authorMention} `;
            oninputTextarea();
            focusTextarea();
          }
        } else {
          // Mode 3 (default 'all'): All mentions at the beginning
          textareaRef.current.value = `${allMentions
            .map((m) => `@${m}`)
            .join(' ')} `;
          oninputTextarea();
          focusTextarea();
        }
      }
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
      setSensitive(!!spoilerText);
    } else if (editStatus) {
      const {
        visibility,
        language,
        sensitive,
        poll,
        mediaAttachments,
        quoteApproval,
      } = editStatus;
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
          if (supportsNativeQuote()) {
            const postQuoteApprovalPolicy =
              getPostQuoteApprovalPolicy(quoteApproval);
            setQuoteApprovalPolicy(postQuoteApprovalPolicy);
          }
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
      if (prefs['posting:default:quote_policy']) {
        let policy = prefs['posting:default:quote_policy'].toLowerCase();
        if (prefs['posting:default:visibility']) {
          const visibility = prefs['posting:default:visibility'].toLowerCase();
          if (visibility === 'private' || visibility === 'direct') {
            policy = 'nobody';
          }
        }
        setQuoteApprovalPolicy(policy);
      }
    }
    if (draftStatus) {
      const {
        status,
        spoilerText,
        visibility,
        language,
        sensitive,
        sensitiveMedia,
        poll,
        mediaAttachments,
        scheduledAt,
        quoteApprovalPolicy,
      } = draftStatus;
      const composablePoll = !!poll?.options && {
        ...poll,
        options: poll.options.map((o) => o?.title || o),
        expiresIn: poll?.expiresIn || expiresInFromExpiresAt(poll.expiresAt),
      };
      textareaRef.current.value = status;
      oninputTextarea();
      // status starts with newline or space, focus on first position
      const cursorPos = /^\n|\s/.test(status) ? 0 : undefined;
      focusTextarea(cursorPos);
      if (spoilerText) spoilerTextRef.current.value = spoilerText;
      if (visibility) setVisibility(visibility);
      setLanguage(
        language ||
          prefs['posting:default:language']?.toLowerCase() ||
          DEFAULT_LANG,
      );
      if (sensitiveMedia !== null) setSensitiveMedia(sensitiveMedia);
      if (sensitive !== null) setSensitive(sensitive);
      if (composablePoll) setPoll(composablePoll);
      if (mediaAttachments) setMediaAttachments(mediaAttachments);
      if (scheduledAt) setScheduledAt(scheduledAt);
      if (quoteApprovalPolicy) setQuoteApprovalPolicy(quoteApprovalPolicy);
    }
  }, [draftStatus, editStatus, replyToStatus, replyMode]);

  // focus textarea when state.composerState.minimized turns false
  const snapStates = useSnapshot(states);
  useEffect(() => {
    if (!snapStates.composerState.minimized) {
      focusTextarea();
    }
  }, [snapStates.composerState.minimized]);

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
      useKey: true,
      ignoreEventWhen: (e) => e.metaKey || e.ctrlKey || e.altKey || e.shiftKey,
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
      ignoreEventWhen: (e) => {
        const modals = document.querySelectorAll('#modal-container > *');
        const hasModal = !!modals;
        const hasOnlyComposer =
          modals.length === 1 && modals[0].querySelector('#compose-container');
        return (
          (hasModal && !hasOnlyComposer) ||
          e.metaKey ||
          e.ctrlKey ||
          e.altKey ||
          e.shiftKey
        );
      },
      useKey: true,
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
        sensitiveMedia,
        poll,
        mediaAttachments,
        scheduledAt,
        quoteApprovalPolicy,
      },
      quote: currentQuoteStatus?.id
        ? {
            // Smaller payload, same reason as replyTo
            id: currentQuoteStatus.id,
          }
        : null,
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
      // Ignore drops when a sheet is open
      if (document.querySelector('.sheet')) return;

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
        (Date.now() - Date.parse(replyToStatus.createdAt)) /
          (1000 * 60 * 60 * 24 * 30),
      ),
    [replyToStatus],
  );

  const onMinimize = () => {
    saveUnsavedDraft();
    states.composerState.minimized = true;
  };

  const mediaButtonDisabled =
    uiState === 'loading' ||
    (maxMediaAttachments !== undefined &&
      mediaAttachments.length >= maxMediaAttachments) ||
    !!poll; /* ||
    !!currentQuoteStatus?.id; */

  const cwButtonDisabled = uiState === 'loading' || !!sensitive;
  const onCWButtonClick = () => {
    setSensitive(true);
    setTimeout(() => {
      spoilerTextRef.current?.focus();
    }, 0);
  };

  // If maxOptions is not defined or defined and is greater than 1, show poll button
  const showPollButton = maxOptions == null || maxOptions > 1;
  const pollButtonDisabled =
    uiState === 'loading' || !!poll || !!mediaAttachments.length; /* ||
    !!currentQuoteStatus?.id; */
  const onPollButtonClick = () => {
    setPoll({
      options: ['', ''],
      expiresIn: 24 * 60 * 60, // 1 day
      multiple: false,
    });
    // Focus first choice field
    setTimeout(() => {
      composeContainerRef.current
        ?.querySelector('.poll-choice input[type="text"]')
        ?.focus();
    }, 0);
  };

  const highlightLanguageField =
    language !== prevLanguage.current ||
    (autoDetectedLanguages?.length &&
      !autoDetectedLanguages.includes(language));
  const highlightVisibilityField = visibility !== 'public';

  const highlightQuoteApprovalPolicyField = quoteApprovalPolicy !== 'public';
  const disableQuotePolicy =
    visibility === 'private' || visibility === 'direct';

  const addSubToolbarRef = useRef();
  const [showAddButton, setShowAddButton] = useState(true);
  const BUTTON_WIDTH = 42; // roughly one button width
  useThrottledResizeObserver({
    ref: addSubToolbarRef,
    box: 'border-box',
    onResize: ({ width }) => {
      // If scrollable, it's truncated
      const { scrollWidth } = addSubToolbarRef.current;
      const truncated = scrollWidth > width;
      const overTruncated = width < BUTTON_WIDTH * 4;
      setShowAddButton(overTruncated || truncated);
      addSubToolbarRef.current.hidden = overTruncated;
    },
  });

  const showScheduledAt = !editStatus;
  const scheduledAtButtonDisabled = uiState === 'loading' || !!scheduledAt;
  const onScheduledAtClick = () => {
    const date = new Date(Date.now() + DEFAULT_SCHEDULED_AT);
    setScheduledAt(date);
  };

  return (
    <div id="compose-container-outer" ref={composeContainerRef}>
      <div
        id="compose-container"
        tabIndex={-1}
        class={standalone ? 'standalone' : ''}
      >
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
                    quoteStatus: currentQuoteStatus,
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
                class="plain4 close-button"
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
                        replyMode,
                        draftStatus: {
                          uid: UID.current,
                          status: textareaRef.current.value,
                          spoilerText: spoilerTextRef.current.value,
                          visibility,
                          language,
                          sensitive,
                          sensitiveMedia,
                          poll,
                          mediaAttachments,
                          scheduledAt,
                        },
                        quoteStatus: currentQuoteStatus,
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
          <details class="status-preview" open>
            <Status status={replyToStatus} size="s" previewMode />
            <summary class="status-preview-legend reply-to">
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
            </summary>
          </details>
        )}
        {!!editStatus && (
          <details class="status-preview">
            <Status status={editStatus} size="s" previewMode />
            <summary class="status-preview-legend">
              <Trans>Editing source post</Trans>
            </summary>
          </details>
        )}
        <form
          ref={formRef}
          class={`form-visibility-${visibility}`}
          style={{
            pointerEvents: uiState === 'loading' ? 'none' : 'auto',
            opacity: uiState === 'loading' ? 0.5 : 1,
          }}
          onClick={() => {
            setTimeout(() => {
              if (!document.activeElement) {
                lastFocusedFieldRef.current?.focus?.();
              }
            }, 10);
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
            let {
              status,
              visibility,
              sensitive,
              sensitiveMedia,
              spoilerText,
              scheduledAt,
              quoteApprovalPolicy,
            } = entries;

            // Pre-cleanup
            // checkboxes return "on" if checked
            sensitive = sensitive === 'on';
            sensitiveMedia = sensitiveMedia === 'on';

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
                  sensitive: sensitive || sensitiveMedia,
                  poll,
                  // mediaIds: mediaAttachments.map((attachment) => attachment.id),
                  media_ids: mediaAttachments.map(
                    (attachment) => attachment.id,
                  ),
                };
                if (editStatus) {
                  if (supportsNativeQuote()) {
                    params.quote_approval_policy = quoteApprovalPolicy;
                  }
                  if (
                    supports('@mastodon') ||
                    supports('@gotosocial/edit-media-attributes')
                  ) {
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
                  }
                } else {
                  if (supportsNativeQuote() && currentQuoteStatus?.id) {
                    params.quoted_status_id = currentQuoteStatus.id;
                    params.quote_approval_policy = quoteApprovalPolicy;
                  }
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
          <div>
            <div class={`compose-cw-container ${sensitive ? '' : 'collapsed'}`}>
              <input
                type="hidden"
                name="sensitive"
                value={sensitive ? 'on' : 'off'}
              />
              {/* mimic the old checkbox */}
              <TextExpander
                keys=":"
                class="spoiler-text-field-container"
                onTrigger={(action) => {
                  if (action?.name === 'custom-emojis') {
                    setShowEmoji2Picker({
                      targetElement: spoilerTextRef,
                      defaultSearchTerm: action?.defaultSearchTerm || null,
                    });
                  }
                }}
              >
                <input
                  ref={spoilerTextRef}
                  type="text"
                  name="spoilerText"
                  placeholder={t`Content warning`}
                  data-allow-custom-emoji="true"
                  disabled={uiState === 'loading'}
                  class="spoiler-text-field"
                  lang={language}
                  spellCheck="true"
                  autocomplete="off"
                  dir="auto"
                  onInput={() => {
                    updateCharCount();
                  }}
                />
              </TextExpander>
              <button
                type="button"
                class="close-button plain4 small"
                onClick={() => {
                  setSensitive(false);
                  textareaRef.current.focus();
                }}
              >
                <Icon icon="x" alt={t`Cancel`} />
              </button>
            </div>
            <Textarea
              ref={textareaRef}
              data-allow-custom-emoji="true"
              placeholder={
                replyToStatus
                  ? t`Post your reply`
                  : editStatus
                    ? t`Edit your post`
                    : !!poll
                      ? t`Ask a question`
                      : t`What are you doing?`
              }
              required={mediaAttachments?.length === 0}
              disabled={uiState === 'loading'}
              lang={language}
              onInput={() => {
                updateCharCount();
              }}
              maxCharacters={maxCharacters}
              onTrigger={(action) => {
                if (action?.name === 'custom-emojis') {
                  setShowEmoji2Picker({
                    targetElement: lastFocusedEmojiFieldRef,
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
                } else if (action?.name === 'pasted-link' && action?.url) {
                  handlePastedLink(action.url);
                }
              }}
            />
          </div>
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
                    supportedMimeTypes={supportedMimeTypes}
                    descriptionLimit={descriptionLimit}
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
                  name="sensitiveMedia"
                  type="checkbox"
                  checked={sensitiveMedia}
                  disabled={uiState === 'loading'}
                  onChange={(e) => {
                    const sensitiveMedia = e.target.checked;
                    setSensitiveMedia(sensitiveMedia);
                  }}
                />{' '}
                <span>
                  <Trans>Mark media as sensitive</Trans>
                </span>{' '}
                <Icon icon={`eye-${sensitiveMedia ? 'close' : 'open'}`} />
              </label>
            </div>
          )}
          {!!poll && (
            <ComposePoll
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
                  focusLastFocusedField();
                }
              }}
            />
          )}
          {!!currentQuoteStatus?.id && (
            <div class="quote-status">
              <Status
                status={currentQuoteStatus}
                instance={instance}
                size="s"
                readOnly
              />
            </div>
          )}
          {scheduledAt && (
            <div class="toolbar scheduled-at">
              <span>
                <label>
                  <Trans>
                    Posting on{' '}
                    <ScheduledAtField
                      scheduledAt={scheduledAt}
                      setScheduledAt={setScheduledAt}
                    />
                  </Trans>
                </label>{' '}
                <small class="tag insignificant">
                  {getLocalTimezoneName()}
                </small>
              </span>
              <button
                type="button"
                class="plain4 close-button small"
                onClick={() => {
                  setScheduledAt(null);
                  focusLastFocusedField();
                }}
              >
                <Icon icon="x" alt={t`Cancel`} />
              </button>
            </div>
          )}
          <QuoteSuggestion
            quoteSuggestion={quoteSuggestion}
            hasCurrentQuoteStatus={!!currentQuoteStatus?.id}
            onAccept={() => {
              const { status } = quoteSuggestion;

              // Remove the pasted link from textarea
              const currentValue = textareaRef.current?.value || '';
              // Find pasted link nearest to last cursor position
              const lastCursorPos = textareaRef.current?.selectionStart || 0;
              const pastedLinkPos = currentValue.lastIndexOf(
                quoteSuggestion.url,
                lastCursorPos,
              );
              const newValue =
                currentValue.slice(0, pastedLinkPos) +
                currentValue.slice(pastedLinkPos + quoteSuggestion.url.length);
              if (textareaRef.current) {
                textareaRef.current.value = newValue;
                textareaRef.current.dispatchEvent(new Event('input'));
              }

              const hasCurrentQuote = !!currentQuoteStatus?.id;
              if (hasCurrentQuote) {
                // If there's already a quote, replacement doesn't need transition
                setQuoteSuggestion(null);
                setLocalQuoteStatus(status);
              } else {
                // Transition the unfurled quote to the quote preview
                if (document.startViewTransition) {
                  document.startViewTransition(() => {
                    setQuoteSuggestion(null);
                    setLocalQuoteStatus(status);
                  });
                } else {
                  setQuoteSuggestion(null);
                  setLocalQuoteStatus(status);
                }
              }
              focusTextarea();
            }}
            onCancel={() => setQuoteSuggestion(null)}
          />
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
                    <MenuItem
                      disabled={mediaButtonDisabled}
                      className="compose-menu-add-media"
                    >
                      <label class="compose-menu-add-media-field">
                        <CameraCaptureInput
                          hidden
                          supportedMimeTypes={supportedImagesVideosTypes}
                          disabled={mediaButtonDisabled}
                          setMediaAttachments={setMediaAttachments}
                        />
                      </label>
                      <Icon icon="camera" /> <span>{_(ADD_LABELS.camera)}</span>
                    </MenuItem>
                  )}
                  <MenuItem
                    disabled={mediaButtonDisabled}
                    className="compose-menu-add-media"
                  >
                    <label class="compose-menu-add-media-field">
                      <FilePickerInput
                        hidden
                        supportedMimeTypes={supportedMimeTypes}
                        maxMediaAttachments={maxMediaAttachments}
                        mediaAttachments={mediaAttachments}
                        disabled={mediaButtonDisabled}
                        setMediaAttachments={setMediaAttachments}
                      />
                    </label>
                    <Icon icon="media" /> <span>{_(ADD_LABELS.media)}</span>
                  </MenuItem>
                  <MenuItem
                    disabled={cwButtonDisabled}
                    onClick={onCWButtonClick}
                  >
                    <Icon icon={`eye-${sensitive ? 'close' : 'open'}`} />{' '}
                    <span>{_(ADD_LABELS.sensitive)}</span>
                  </MenuItem>
                  {showPollButton && (
                    <MenuItem
                      disabled={pollButtonDisabled}
                      onClick={onPollButtonClick}
                    >
                      <Icon icon="poll" /> <span>{_(ADD_LABELS.poll)}</span>
                    </MenuItem>
                  )}
                  <MenuDivider />
                  <MenuItem
                    onClick={() => {
                      setShowEmoji2Picker({
                        targetElement: lastFocusedEmojiFieldRef,
                      });
                    }}
                  >
                    <Icon icon="emoji2" />{' '}
                    <span>{_(ADD_LABELS.customEmoji)}</span>
                  </MenuItem>
                  {!!states.settings.composerGIFPicker && (
                    <MenuItem
                      disabled={mediaButtonDisabled}
                      onClick={() => {
                        setShowGIFPicker(true);
                      }}
                    >
                      <span class="icon icon-gif" role="img" />
                      <span>{_(ADD_LABELS.gif)}</span>
                    </MenuItem>
                  )}
                  {showScheduledAt && (
                    <>
                      <MenuDivider />
                      <MenuItem
                        disabled={scheduledAtButtonDisabled}
                        onClick={onScheduledAtClick}
                      >
                        <Icon icon="schedule" />{' '}
                        <span>{_(ADD_LABELS.scheduledPost)}</span>
                      </MenuItem>
                    </>
                  )}
                </Menu2>
              )}
              <span
                class="add-sub-toolbar-button-group"
                ref={addSubToolbarRef}
                hidden
              >
                {supportsCameraCapture && (
                  <label class="toolbar-button">
                    <CameraCaptureInput
                      supportedMimeTypes={supportedImagesVideosTypes}
                      mediaAttachments={mediaAttachments}
                      disabled={mediaButtonDisabled}
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
                    disabled={mediaButtonDisabled}
                    setMediaAttachments={setMediaAttachments}
                  />
                  <Icon icon="media" alt={_(ADD_LABELS.media)} />
                </label>
                <button
                  type="button"
                  class="toolbar-button"
                  disabled={cwButtonDisabled}
                  onClick={onCWButtonClick}
                >
                  <Icon
                    icon={`eye-${sensitive ? 'close' : 'open'}`}
                    alt={_(ADD_LABELS.sensitive)}
                  />
                </button>
                {showPollButton && (
                  <button
                    type="button"
                    class="toolbar-button"
                    disabled={pollButtonDisabled}
                    onClick={onPollButtonClick}
                  >
                    <Icon icon="poll" alt={_(ADD_LABELS.poll)} />
                  </button>
                )}
                <div class="toolbar-divider" />
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
                    setShowEmoji2Picker({
                      targetElement: lastFocusedEmojiFieldRef,
                    });
                  }}
                >
                  <Icon icon="emoji2" alt={_(ADD_LABELS.customEmoji)} />
                </button>
                {!!states.settings.composerGIFPicker && (
                  <button
                    type="button"
                    class="toolbar-button gif-picker-button"
                    disabled={mediaButtonDisabled}
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
                {showScheduledAt && (
                  <>
                    <div class="toolbar-divider" />
                    <button
                      type="button"
                      class={`toolbar-button ${scheduledAt ? 'highlight' : ''}`}
                      disabled={scheduledAtButtonDisabled}
                      onClick={onScheduledAtClick}
                    >
                      <Icon icon="schedule" alt={_(ADD_LABELS.scheduledPost)} />
                    </button>
                  </>
                )}
              </span>
            </span>
            {uiState === 'loading' ? (
              <Loader abrupt />
            ) : (
              <CharCountMeter
                maxCharacters={maxCharacters}
                hidden={uiState === 'loading'}
              />
            )}
            {supportsNativeQuote() && (
              <label
                class={`toolbar-button ${highlightQuoteApprovalPolicyField ? 'highlight' : ''}`}
              >
                <Icon icon="quote2" alt="Quote settings" />
                {quoteApprovalPolicy === 'followers' && (
                  <Icon icon="group" class="insignificant" />
                )}
                {quoteApprovalPolicy === 'nobody' && (
                  <Icon icon="block" class="insignificant" />
                )}
                <select
                  name="quoteApprovalPolicy"
                  value={quoteApprovalPolicy}
                  onChange={(e) => {
                    setQuoteApprovalPolicy(e.target.value);
                  }}
                  disabled={uiState === 'loading'}
                  dir="auto"
                >
                  <option value="public" disabled={disableQuotePolicy}>
                    <Trans>Anyone can quote</Trans>
                  </option>
                  <option value="followers" disabled={disableQuotePolicy}>
                    <Trans>Your followers can quote</Trans>
                  </option>
                  <option value="nobody">
                    <Trans>Only you can quote</Trans>
                  </option>
                </select>
              </label>
            )}
            <label
              class={`toolbar-button ${highlightVisibilityField ? 'highlight' : ''}`}
              title={_(visibilityText[visibility])}
            >
              {visibility === 'public' || visibility === 'direct' ? (
                <Icon
                  icon={visibilityIconsMap[visibility]}
                  alt={_(visibilityText[visibility])}
                />
              ) : (
                <span class="icon-text">{_(visibilityText[visibility])}</span>
              )}
              <select
                name="visibility"
                value={visibility}
                onChange={(e) => {
                  setVisibility(e.target.value);
                  if (
                    e.target.value === 'private' ||
                    e.target.value === 'direct'
                  ) {
                    setQuoteApprovalPolicy('nobody');
                  }

                  if (e.target.value === 'direct' && currentQuoteStatus?.id) {
                    const quoteURL = currentQuoteStatus.url;
                    if (quoteURL) {
                      const currentText = textareaRef.current.value;
                      if (!currentText.includes(quoteURL)) {
                        textareaRef.current.value =
                          currentText + (currentText ? '\n' : '') + quoteURL;
                        oninputTextarea();
                      }
                    }
                    setQuoteCleared(true);
                    showToast(t`Quotes can't be embedded in private mentions.`);
                  } else if (e.target.value !== 'direct' && quoteCleared) {
                    const quoteURL = (localQuoteStatus || quoteStatus)?.url;
                    if (quoteURL && textareaRef.current) {
                      const currentValue = textareaRef.current.value;
                      const linkPos = currentValue.indexOf(quoteURL);
                      if (linkPos !== -1) {
                        let newValue =
                          currentValue.slice(0, linkPos) +
                          currentValue.slice(linkPos + quoteURL.length);
                        newValue = newValue.replace(/\n+$/, '');
                        textareaRef.current.value = newValue;
                        oninputTextarea();
                      }
                    }
                    setQuoteCleared(false);
                  }
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
                  <Trans>Quiet public</Trans>
                </option>
                <option value="private">
                  <Trans>Followers</Trans>
                </option>
                <option value="direct">
                  <Trans>Private mention</Trans>
                </option>
              </select>
            </label>{' '}
            <label
              class={`toolbar-button ${
                highlightLanguageField ? 'highlight' : ''
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
            focusLastFocusedField();
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
              if (textarea) {
                insertTextAtCursor({
                  targetElement: textarea,
                  text: '@' + socialAddress,
                });
              }
            }}
          />
        </Modal>
      )}
      {showEmoji2Picker && (
        <Modal
          onClose={() => {
            setShowEmoji2Picker(false);
            focusLastFocusedField();
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
              const targetElement =
                showEmoji2Picker?.targetElement?.current || textareaRef.current;
              if (targetElement) {
                insertTextAtCursor({ targetElement, text: emojiShortcode });
              }
            }}
          />
        </Modal>
      )}
      {showGIFPicker && (
        <Modal
          onClose={() => {
            setShowGIFPicker(false);
            focusLastFocusedField();
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

function removeNullUndefined(obj) {
  for (let key in obj) {
    if (obj[key] === null || obj[key] === undefined) {
      delete obj[key];
    }
  }
  return obj;
}

export default Compose;
