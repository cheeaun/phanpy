import './compose.css';

import '@github/text-expander-element';
import { MenuItem } from '@szhsin/react-menu';
import { deepEqual } from 'fast-equals';
import { forwardRef } from 'preact/compat';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useHotkeys } from 'react-hotkeys-hook';
import stringLength from 'string-length';
import { uid } from 'uid/single';
import { useDebouncedCallback, useThrottledCallback } from 'use-debounce';
import { useSnapshot } from 'valtio';

import poweredByGiphyURL from '../assets/powered-by-giphy.svg';

import Menu2 from '../components/menu2';
import supportedLanguages from '../data/status-supported-languages';
import urlRegex from '../data/url-regex';
import { api } from '../utils/api';
import db from '../utils/db';
import emojifyText from '../utils/emojify-text';
import localeMatch from '../utils/locale-match';
import openCompose from '../utils/open-compose';
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
  '5 minutes': 5 * 60,
  '30 minutes': 30 * 60,
  '1 hour': 60 * 60,
  '6 hours': 6 * 60 * 60,
  '12 hours': 12 * 60 * 60,
  '1 day': 24 * 60 * 60,
  '3 days': 3 * 24 * 60 * 60,
  '7 days': 7 * 24 * 60 * 60,
};
const expirySeconds = Object.values(expiryOptions);
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
        menu.style.left = innerWidth - width - windowMargin + 'px';
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
  `(^|[^=\\/\\w])(#[a-z0-9_]+([a-z0-9_.-]+[a-z0-9_]+)?)(?![\\/\\w])`,
  'ig',
);

// https://github.com/mastodon/mastodon/blob/23e32a4b3031d1da8b911e0145d61b4dd47c4f96/app/models/custom_emoji.rb#L31
const SHORTCODE_RE_FRAGMENT = '[a-zA-Z0-9_]{2,}';
const SCAN_RE = new RegExp(
  `([^A-Za-z0-9_:\\n]|^)(:${SHORTCODE_RE_FRAGMENT}:)(?=[^A-Za-z0-9_:]|$)`,
  'g',
);

const segmenter = new Intl.Segmenter();
function highlightText(text, { maxCharacters = Infinity }) {
  // Accept text string, return formatted HTML string
  // Escape all HTML special characters
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  // Exceeded characters limit
  const { composerCharacterCount } = states;
  if (composerCharacterCount > maxCharacters) {
    // Highlight exceeded characters
    let withinLimitHTML = '',
      exceedLimitHTML = '';
    const htmlSegments = segmenter.segment(html);
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
        exceedLimitHTML +
        '</mark>';
    }
    return withinLimitHTML + exceedLimitHTML;
  }

  return html
    .replace(urlRegexObj, '$2<mark class="compose-highlight-url">$3</mark>') // URLs
    .replace(MENTION_RE, '$1<mark class="compose-highlight-mention">$2</mark>') // Mentions
    .replace(HASHTAG_RE, '$1<mark class="compose-highlight-hashtag">$2</mark>') // Hashtags
    .replace(
      SCAN_RE,
      '$1<mark class="compose-highlight-emoji-shortcode">$2</mark>',
    ); // Emoji shortcodes
}

const rtf = new Intl.RelativeTimeFormat();

function Compose({
  onClose,
  replyToStatus,
  editStatus,
  draftStatus,
  standalone,
  hasOpener,
}) {
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
      maxMediaAttachments,
      charactersReservedPerUrl,
    } = {},
    mediaAttachments: {
      supportedMimeTypes = [],
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
          ? prefs['posting:default:visibility']
          : visibility,
      );
      setLanguage(language || prefs.postingDefaultLanguage || DEFAULT_LANG);
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
          setLanguage(language || presf.postingDefaultLanguage || DEFAULT_LANG);
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
        setVisibility(prefs['posting:default:visibility']);
      }
      if (prefs['posting:default:language']) {
        setLanguage(prefs['posting:default:language']);
      }
      if (prefs['posting:default:sensitive']) {
        setSensitive(prefs['posting:default:sensitive']);
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
      setLanguage(language || prefs.postingDefaultLanguage || DEFAULT_LANG);
      if (sensitive !== null) setSensitive(sensitive);
      if (composablePoll) setPoll(composablePoll);
      if (mediaAttachments) setMediaAttachments(mediaAttachments);
    }
  }, [draftStatus, editStatus, replyToStatus]);

  const formRef = useRef();

  const beforeUnloadCopy = 'You have unsaved changes. Discard this post?';
  const canClose = () => {
    const { value, dataset } = textareaRef.current;

    // check if loading
    if (uiState === 'loading') {
      console.log('canClose', { uiState });
      return false;
    }

    // check for status and media attachments
    const hasMediaAttachments = mediaAttachments.length > 0;
    if (!value && !hasMediaAttachments) {
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
      ignoreEventWhen: (e) => {
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
  }, [standalone, confirmClose, onClose]);

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
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file && supportedMimeTypes.includes(file.type)) {
            files.push(file);
          }
        }
      }
      if (files.length > 0 && mediaAttachments.length >= maxMediaAttachments) {
        alert(`You can only attach up to ${maxMediaAttachments} files.`);
        return;
      }
      console.log({ files });
      if (files.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        // Auto-cut-off files to avoid exceeding maxMediaAttachments
        const max = maxMediaAttachments - mediaAttachments.length;
        const allowedFiles = files.slice(0, max);
        if (allowedFiles.length <= 0) {
          alert(`You can only attach up to ${maxMediaAttachments} files.`);
          return;
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

  const [showEmoji2Picker, setShowEmoji2Picker] = useState(false);
  const [showGIFPicker, setShowGIFPicker] = useState(false);

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
        contentTranslationHideLanguages.includes(code)
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
  }, [language]);

  const replyToStatusMonthsAgo = useMemo(
    () =>
      !!replyToStatus?.createdAt &&
      Math.floor(
        (Date.now() - new Date(replyToStatus.createdAt)) /
          (1000 * 60 * 60 * 24 * 30),
      ),
    [replyToStatus],
  );

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
            <span>
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
                    },
                  });

                  if (!newWin) {
                    return;
                  }

                  onClose();
                }}
              >
                <Icon icon="popout" alt="Pop out" />
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
                <Icon icon="x" />
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
                    alert('Looks like you closed the parent window.');
                    return;
                  }

                  if (window.opener.__STATES__.showCompose) {
                    const yes = confirm(
                      'Looks like you already have a compose field open in the parent window. Popping in this window will discard the changes you made in the parent window. Continue?',
                    );
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
                        },
                      };
                      window.opener.__COMPOSE__ = passData; // Pass it here instead of `showCompose` due to some weird proxy issue again
                      window.opener.__STATES__.showCompose = true;
                    },
                  });
                }}
              >
                <Icon icon="popin" alt="Pop in" />
              </button>
            )
          )}
        </div>
        {!!replyToStatus && (
          <div class="status-preview">
            <Status status={replyToStatus} size="s" previewMode />
            <div class="status-preview-legend reply-to">
              Replying to @
              {replyToStatus.account.acct || replyToStatus.account.username}
              &rsquo;s post
              {replyToStatusMonthsAgo >= 3 && (
                <>
                  {' '}
                  (
                  <strong>
                    {rtf.format(-replyToStatusMonthsAgo, 'month')}
                  </strong>
                  )
                </>
              )}
            </div>
          </div>
        )}
        {!!editStatus && (
          <div class="status-preview">
            <Status status={editStatus} size="s" previewMode />
            <div class="status-preview-legend">Editing source post</div>
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
            let { status, visibility, sensitive, spoilerText } = entries;

            // Pre-cleanup
            sensitive = sensitive === 'on'; // checkboxes return "on" if checked

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
                alert('Poll must have at least 2 options');
                return;
              }
              if (poll.options.some((option) => option === '')) {
                alert('Some poll choices are empty');
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
                  'Some media have no descriptions. Continue?',
                );
                if (!yes) return;
              }
            }

            // Post-cleanup
            spoilerText = (sensitive && spoilerText) || undefined;
            status = status === '' ? undefined : status;

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
                    setUIState('error');
                    // Alert all the reasons
                    results.forEach((result) => {
                      if (result.status === 'rejected') {
                        console.error(result);
                        alert(result.reason || `Attachment #${i} failed`);
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
                      idempotencyKey: UID.current,
                    });
                  } catch (_) {
                    // If idempotency key fails, try again without it
                    newStatus = await masto.v1.statuses.create(params);
                  }
                }
                setUIState('default');

                // Close
                onClose({
                  // type: post, reply, edit
                  type: editStatus ? 'edit' : replyToStatus ? 'reply' : 'post',
                  newStatus,
                  instance,
                });
              } catch (e) {
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
              placeholder="Content warning"
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
              title="Content warning or sensitive media"
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
              title={`Visibility: ${visibility}`}
            >
              <Icon icon={visibilityIconsMap[visibility]} alt={visibility} />
              <select
                name="visibility"
                value={visibility}
                onChange={(e) => {
                  setVisibility(e.target.value);
                }}
                disabled={uiState === 'loading' || !!editStatus}
              >
                <option value="public">
                  Public <Icon icon="earth" />
                </option>
                <option value="unlisted">Unlisted</option>
                <option value="private">Followers only</option>
                <option value="direct">Private mention</option>
              </select>
            </label>{' '}
          </div>
          <Textarea
            ref={textareaRef}
            placeholder={
              replyToStatus
                ? 'Post your reply'
                : editStatus
                ? 'Edit your post'
                : 'What are you doing?'
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
                        newAttachments[i].description = value;
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
                <span>Mark media as sensitive</span>{' '}
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
          <div
            class="toolbar wrap"
            style={{
              justifyContent: 'flex-end',
            }}
          >
            <span>
              <label class="toolbar-button">
                <input
                  type="file"
                  accept={supportedMimeTypes.join(',')}
                  multiple={mediaAttachments.length < maxMediaAttachments - 1}
                  disabled={
                    uiState === 'loading' ||
                    mediaAttachments.length >= maxMediaAttachments ||
                    !!poll
                  }
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
                    if (
                      mediaAttachments.length + mediaFiles.length >
                      maxMediaAttachments
                    ) {
                      alert(
                        `You can only attach up to ${maxMediaAttachments} files.`,
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
                <Icon icon="attachment" />
              </label>{' '}
              <button
                type="button"
                class="toolbar-button"
                disabled={
                  uiState === 'loading' || !!poll || !!mediaAttachments.length
                }
                onClick={() => {
                  setPoll({
                    options: ['', ''],
                    expiresIn: 24 * 60 * 60, // 1 day
                    multiple: false,
                  });
                }}
              >
                <Icon icon="poll" alt="Add poll" />
              </button>{' '}
              <button
                type="button"
                class="toolbar-button"
                disabled={uiState === 'loading'}
                onClick={() => {
                  setShowEmoji2Picker(true);
                }}
              >
                <Icon icon="emoji2" />
              </button>
              {!!states.settings.composerGIFPicker && (
                <button
                  type="button"
                  class="toolbar-button gif-picker-button"
                  disabled={uiState === 'loading'}
                  onClick={() => {
                    setShowGIFPicker(true);
                  }}
                >
                  <span>GIF</span>
                </button>
              )}
            </span>
            <div class="spacer" />
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
                language !== prevLanguage.current ? 'highlight' : ''
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
              >
                {topSupportedLanguages.map(([code, common, native]) => (
                  <option value={code} key={code}>
                    {common} ({native})
                  </option>
                ))}
                <hr />
                {restSupportedLanguages.map(([code, common, native]) => (
                  <option value={code} key={code}>
                    {common} ({native})
                  </option>
                ))}
              </select>
            </label>{' '}
            <button
              type="submit"
              class="large"
              disabled={uiState === 'loading'}
            >
              {replyToStatus ? 'Reply' : editStatus ? 'Update' : 'Post'}
            </button>
          </div>
        </form>
      </div>
      {showEmoji2Picker && (
        <Modal
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowEmoji2Picker(false);
            }
          }}
        >
          <CustomEmojisModal
            masto={masto}
            instance={instance}
            onClose={() => {
              setShowEmoji2Picker(false);
            }}
            onSelect={(emoji) => {
              const emojiWithSpace = ` ${emoji} `;
              const textarea = textareaRef.current;
              if (!textarea) return;
              const { selectionStart, selectionEnd } = textarea;
              const text = textarea.value;
              const newText =
                text.slice(0, selectionStart) +
                emojiWithSpace +
                text.slice(selectionEnd);
              textarea.value = newText;
              textarea.selectionStart = textarea.selectionEnd =
                selectionEnd + emojiWithSpace.length;
              textarea.focus();
              textarea.dispatchEvent(new Event('input'));
            }}
          />
        </Modal>
      )}
      {showGIFPicker && (
        <Modal
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowGIFPicker(false);
            }
          }}
        >
          <GIFPickerModal
            onClose={() => setShowGIFPicker(false)}
            onSelect={({ url, type, alt_text }) => {
              console.log('GIF URL', url);
              if (mediaAttachments.length >= maxMediaAttachments) {
                alert(
                  `You can only attach up to ${maxMediaAttachments} files.`,
                );
                return;
              }
              // Download the GIF and insert it as media attachment
              (async () => {
                let theToast;
                try {
                  theToast = showToast({
                    text: 'Downloading GIF…',
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
                  showToast('Failed to download GIF');
                }
              })();
            }}
          />
        </Modal>
      )}
    </div>
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

const Textarea = forwardRef((props, ref) => {
  const { masto } = api();
  const [text, setText] = useState(ref.current?.value || '');
  const { maxCharacters, performSearch = () => {}, ...textareaProps } = props;
  // const snapStates = useSnapshot(states);
  // const charCount = snapStates.composerCharacterCount;

  const customEmojis = useRef();
  useEffect(() => {
    (async () => {
      try {
        const emojis = await masto.v1.customEmojis.list();
        console.log({ emojis });
        customEmojis.current = emojis;
      } catch (e) {
        // silent fail
        console.error(e);
      }
    })();
  }, []);

  const textExpanderRef = useRef();
  const textExpanderTextRef = useRef('');
  useEffect(() => {
    let handleChange, handleValue, handleCommited;
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
          const emojis = filterShortcodes(customEmojis.current, text);
          let html = '';
          emojis.forEach((emoji) => {
            const { shortcode, url } = emoji;
            html += `
                <li role="option" data-value="${encodeHTML(shortcode)}">
                <img src="${encodeHTML(
                  url,
                )}" width="16" height="16" alt="" loading="lazy" /> 
                :${encodeHTML(shortcode)}:
              </li>`;
          });
          // console.log({ emojis, html });
          menu.innerHTML = html;
          provide(
            Promise.resolve({
              matched: emojis.length > 0,
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
                        <br>@${encodeHTML(acct)}
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
                menu.innerHTML = html;
              });
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
        if (key === ':') {
          e.detail.value = `:${item.dataset.value}:`;
        } else {
          e.detail.value = `${key}${item.dataset.value}`;
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
          if (key === 'Enter' && !(e.ctrlKey || e.metaKey)) {
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
          const text = target.value;
          setText(text);
          autoResizeTextarea(target);
          props.onInput?.(e);
          throttleHighlightText(text);
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

function MediaAttachment({
  attachment,
  disabled,
  lang,
  onDescriptionChange = () => {},
  onRemove = () => {},
}) {
  const [uiState, setUIState] = useState('default');
  const supportsEdit = supports('@mastodon/edit-media-attributes');
  const { type, id, file } = attachment;
  const url = useMemo(
    () => (file ? URL.createObjectURL(file) : attachment.url),
    [file, attachment.url],
  );
  console.log({ attachment });
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
          <span class="tag">Uploaded</span>
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
              image: 'Image description',
              video: 'Video description',
              audio: 'Audio description',
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
            <img src={url} alt="" />
          ) : suffixType === 'video' || suffixType === 'gifv' ? (
            <video src={url} playsinline muted />
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
            <Icon icon="x" />
          </button>
        </div>
      </div>
      {showModal && (
        <Modal
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowModal(false);
            }
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
              <Icon icon="x" />
            </button>
            <header>
              <h2>
                {
                  {
                    image: 'Edit image description',
                    video: 'Edit video description',
                    audio: 'Edit audio description',
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
                          <button type="button" title="More" class="plain">
                            <Icon icon="more" size="l" alt="More" />
                          </button>
                        }
                      >
                        <MenuItem
                          disabled={uiState === 'loading'}
                          onClick={() => {
                            setUIState('loading');
                            toastRef.current = showToast({
                              text: 'Generating description. Please wait...',
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
                                  `Failed to generate description${
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
                          <span>Generate description…</span>
                        </MenuItem>
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
                    Done
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
              placeholder={`Choice ${i + 1}`}
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
              <Icon icon="x" size="s" />
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
          Multiple choices
        </label>
        <label class="expires-in">
          Duration{' '}
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
              .filter(([label, value]) => {
                return value >= minExpiration && value <= maxExpiration;
              })
              .map(([label, value]) => (
                <option value={value} key={value}>
                  {label}
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
          Remove poll
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

function CustomEmojisModal({
  masto,
  instance,
  onClose = () => {},
  onSelect = () => {},
}) {
  const [uiState, setUIState] = useState('default');
  const customEmojisList = useRef([]);
  const [customEmojis, setCustomEmojis] = useState({});
  const recentlyUsedCustomEmojis = useMemo(
    () => store.account.get('recentlyUsedCustomEmojis') || [],
  );
  useEffect(() => {
    setUIState('loading');
    (async () => {
      try {
        const emojis = await masto.v1.customEmojis.list();
        // Group emojis by category
        const emojisCat = {
          '--recent--': recentlyUsedCustomEmojis.filter((emoji) =>
            emojis.find((e) => e.shortcode === emoji.shortcode),
          ),
        };
        const othersCat = [];
        emojis.forEach((emoji) => {
          if (!emoji.visibleInPicker) return;
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
        setCustomEmojis(emojisCat);
        setUIState('default');
      } catch (e) {
        setUIState('error');
        console.error(e);
      }
    })();
  }, []);

  return (
    <div id="custom-emojis-sheet" class="sheet">
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" />
        </button>
      )}
      <header>
        <b>Custom emojis</b>{' '}
        {uiState === 'loading' ? (
          <Loader />
        ) : (
          <small class="insignificant"> • {instance}</small>
        )}
      </header>
      <main>
        <div class="custom-emojis-list">
          {uiState === 'error' && (
            <div class="ui-state">
              <p>Error loading custom emojis</p>
            </div>
          )}
          {uiState === 'default' &&
            Object.entries(customEmojis).map(
              ([category, emojis]) =>
                !!emojis?.length && (
                  <>
                    <div class="section-header">
                      {{
                        '--recent--': 'Recently used',
                        '--others--': 'Others',
                      }[category] || category}
                    </div>
                    <section>
                      {emojis.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          class="plain4"
                          onClick={() => {
                            onClose();
                            requestAnimationFrame(() => {
                              onSelect(`:${emoji.shortcode}:`);
                            });
                            let recentlyUsedCustomEmojis =
                              store.account.get('recentlyUsedCustomEmojis') ||
                              [];
                            const recentlyUsedEmojiIndex =
                              recentlyUsedCustomEmojis.findIndex(
                                (e) => e.shortcode === emoji.shortcode,
                              );
                            if (recentlyUsedEmojiIndex !== -1) {
                              // Move emoji to index 0
                              recentlyUsedCustomEmojis.splice(
                                recentlyUsedEmojiIndex,
                                1,
                              );
                              recentlyUsedCustomEmojis.unshift(emoji);
                            } else {
                              recentlyUsedCustomEmojis.unshift(emoji);
                              // Remove unavailable ones
                              recentlyUsedCustomEmojis =
                                recentlyUsedCustomEmojis.filter((e) =>
                                  customEmojisList.current?.find?.(
                                    (emoji) => emoji.shortcode === e.shortcode,
                                  ),
                                );
                              // Limit to 10
                              recentlyUsedCustomEmojis =
                                recentlyUsedCustomEmojis.slice(0, 10);
                            }

                            // Store back
                            store.account.set(
                              'recentlyUsedCustomEmojis',
                              recentlyUsedCustomEmojis,
                            );
                          }}
                          title={`:${emoji.shortcode}:`}
                        >
                          <picture>
                            {!!emoji.staticUrl && (
                              <source
                                srcset={emoji.staticUrl}
                                media="(prefers-reduced-motion: reduce)"
                              />
                            )}
                            <img
                              class="shortcode-emoji"
                              src={emoji.url || emoji.staticUrl}
                              alt={emoji.shortcode}
                              width="16"
                              height="16"
                              loading="lazy"
                              decoding="async"
                            />
                          </picture>
                        </button>
                      ))}
                    </section>
                  </>
                ),
            )}
        </div>
      </main>
    </div>
  );
}

const GIFS_PER_PAGE = 20;
function GIFPickerModal({ onClose = () => {}, onSelect = () => {} }) {
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

  return (
    <div id="gif-picker-sheet" class="sheet">
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" />
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
            placeholder="Search GIFs"
            required
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellCheck="false"
            dir="auto"
          />
          <input
            type="image"
            class="powered-button"
            src={poweredByGiphyURL}
            width="86"
            height="30"
          />
        </form>
      </header>
      <main ref={scrollableRef} class={uiState === 'loading' ? 'loading' : ''}>
        {uiState === 'default' && (
          <div class="ui-state">
            <p class="insignificant">Type to search GIFs</p>
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
                const urlObj = new URL(url);
                const strippedURL = urlObj.origin + urlObj.pathname;
                let strippedWebP;
                if (webp) {
                  const webpObj = new URL(webp);
                  strippedWebP = webpObj.origin + webpObj.pathname;
                }
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => {
                        const { mp4, url } = original;
                        const theURL = mp4 || url;
                        const urlObj = new URL(theURL);
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
                  <span>Previous</span>
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
                  <span>Next</span> <Icon icon="chevron-right" />
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
            <p>Error loading GIFs</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default Compose;
