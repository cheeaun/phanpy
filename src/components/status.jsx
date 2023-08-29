import './status.css';

import '@justinribeiro/lite-youtube';
import {
  ControlledMenu,
  Menu,
  MenuDivider,
  MenuHeader,
  MenuItem,
} from '@szhsin/react-menu';
import { decodeBlurHash } from 'fast-blurhash';
import mem from 'mem';
import pThrottle from 'p-throttle';
import { memo } from 'preact/compat';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import { InView } from 'react-intersection-observer';
import { useLongPress } from 'use-long-press';
import useResizeObserver from 'use-resize-observer';
import { useSnapshot } from 'valtio';
import { snapshot } from 'valtio/vanilla';

import AccountBlock from '../components/account-block';
import EmojiText from '../components/emoji-text';
import Loader from '../components/loader';
import MenuConfirm from '../components/menu-confirm';
import Modal from '../components/modal';
import NameText from '../components/name-text';
import Poll from '../components/poll';
import { api } from '../utils/api';
import enhanceContent from '../utils/enhance-content';
import getTranslateTargetLanguage from '../utils/get-translate-target-language';
import getHTMLText from '../utils/getHTMLText';
import handleContentLinks from '../utils/handle-content-links';
import htmlContentLength from '../utils/html-content-length';
import isMastodonLinkMaybe from '../utils/isMastodonLinkMaybe';
import localeMatch from '../utils/locale-match';
import niceDateTime from '../utils/nice-date-time';
import safeBoundingBoxPadding from '../utils/safe-bounding-box-padding';
import shortenNumber from '../utils/shorten-number';
import showToast from '../utils/show-toast';
import states, { getStatus, saveStatus, statusKey } from '../utils/states';
import statusPeek from '../utils/status-peek';
import store from '../utils/store';
import visibilityIconsMap from '../utils/visibility-icons-map';

import Avatar from './avatar';
import Icon from './icon';
import Link from './link';
import Media from './media';
import MenuLink from './menu-link';
import RelativeTime from './relative-time';
import TranslationBlock from './translation-block';

const INLINE_TRANSLATE_LIMIT = 140;
const throttle = pThrottle({
  limit: 1,
  interval: 1000,
});

function fetchAccount(id, masto) {
  try {
    return masto.v1.accounts.fetch(id);
  } catch (e) {
    return Promise.reject(e);
  }
}
const memFetchAccount = mem(fetchAccount);

const visibilityText = {
  public: 'Public',
  unlisted: 'Unlisted',
  private: 'Followers only',
  direct: 'Private mention',
};

function Status({
  statusID,
  status,
  instance: propInstance,
  withinContext,
  size = 'm',
  skeleton,
  readOnly,
  contentTextWeight,
  enableTranslate,
  forceTranslate: _forceTranslate,
  previewMode,
  allowFilters,
  onMediaClick,
  quoted,
  onStatusLinkClick = () => {},
}) {
  if (skeleton) {
    return (
      <div class="status skeleton">
        <Avatar size="xxl" />
        <div class="container">
          <div class="meta">███ ████████</div>
          <div class="content-container">
            <div class="content">
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

  console.debug('RENDER Status', id, status?.account.displayName, quoted);

  const debugHover = (e) => {
    if (e.shiftKey) {
      console.log({
        ...status,
      });
    }
  };

  if (allowFilters && size !== 'l' && _filtered) {
    return (
      <FilteredStatus
        status={status}
        filterInfo={_filtered}
        instance={instance}
        containerProps={{
          onMouseEnter: debugHover,
        }}
      />
    );
  }

  const createdAtDate = new Date(createdAt);
  const editedAtDate = new Date(editedAt);

  const currentAccount = useMemo(() => {
    return store.session.get('currentAccount');
  }, []);
  const isSelf = useMemo(() => {
    return currentAccount && currentAccount === accountId;
  }, [accountId, currentAccount]);

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

  const showSpoiler = previewMode || !!snapStates.spoilers[id] || false;

  if (reblog) {
    // If has statusID, means useItemID (cached in states)

    if (group) {
      return (
        <div class="status-group" onMouseEnter={debugHover}>
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
          />
        </div>
      );
    }

    return (
      <div class="status-reblog" onMouseEnter={debugHover}>
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
        />
      </div>
    );
  }

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
  const [showReactions, setShowReactions] = useState(false);

  const spoilerContentRef = useRef(null);
  useResizeObserver({
    ref: spoilerContentRef,
    onResize: () => {
      if (spoilerContentRef.current) {
        const { scrollHeight, clientHeight } = spoilerContentRef.current;
        if (scrollHeight < window.innerHeight * 0.4) {
          spoilerContentRef.current.classList.remove('truncated');
        } else {
          spoilerContentRef.current.classList.toggle(
            'truncated',
            scrollHeight > clientHeight,
          );
        }
      }
    },
  });
  const contentRef = useRef(null);
  useResizeObserver({
    ref: contentRef,
    onResize: () => {
      if (contentRef.current) {
        const { scrollHeight, clientHeight } = contentRef.current;
        if (scrollHeight < window.innerHeight * 0.4) {
          contentRef.current.classList.remove('truncated');
        } else {
          contentRef.current.classList.toggle(
            'truncated',
            scrollHeight > clientHeight,
          );
        }
      }
    },
  });
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

  const replyStatus = () => {
    if (!sameInstance || !authenticated) {
      return alert(unauthInteractionErrorMessage);
    }
    states.showCompose = {
      replyToStatus: status,
    };
  };

  // Check if media has no descriptions
  const mediaNoDesc = useMemo(() => {
    return mediaAttachments.some(
      (attachment) => !attachment.description?.trim?.(),
    );
  }, [mediaAttachments]);
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
        const newStatus = await masto.v1.statuses.unreblog(id);
        saveStatus(newStatus, instance);
        return true;
      } else {
        const newStatus = await masto.v1.statuses.reblog(id);
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
        const newStatus = await masto.v1.statuses.unreblog(id);
        saveStatus(newStatus, instance);
        return true;
      } else {
        const newStatus = await masto.v1.statuses.reblog(id);
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

  const favouriteStatus = async () => {
    if (!sameInstance || !authenticated) {
      return alert(unauthInteractionErrorMessage);
    }
    try {
      // Optimistic
      states.statuses[sKey] = {
        ...status,
        favourited: !favourited,
        favouritesCount: favouritesCount + (favourited ? -1 : 1),
      };
      if (favourited) {
        const newStatus = await masto.v1.statuses.unfavourite(id);
        saveStatus(newStatus, instance);
      } else {
        const newStatus = await masto.v1.statuses.favourite(id);
        saveStatus(newStatus, instance);
      }
    } catch (e) {
      console.error(e);
      // Revert optimistism
      states.statuses[sKey] = status;
    }
  };

  const bookmarkStatus = async () => {
    if (!sameInstance || !authenticated) {
      return alert(unauthInteractionErrorMessage);
    }
    try {
      // Optimistic
      states.statuses[sKey] = {
        ...status,
        bookmarked: !bookmarked,
      };
      if (bookmarked) {
        const newStatus = await masto.v1.statuses.unbookmark(id);
        saveStatus(newStatus, instance);
      } else {
        const newStatus = await masto.v1.statuses.bookmark(id);
        saveStatus(newStatus, instance);
      }
    } catch (e) {
      console.error(e);
      // Revert optimistism
      states.statuses[sKey] = status;
    }
  };

  const differentLanguage =
    language &&
    language !== targetLanguage &&
    !localeMatch([language], [targetLanguage]) &&
    !contentTranslationHideLanguages.find(
      (l) => language === l || localeMatch([language], [l]),
    );

  const menuInstanceRef = useRef();
  const StatusMenuItems = (
    <>
      {!isSizeLarge && (
        <>
          <MenuHeader>
            <span class="ib">
              <Icon icon={visibilityIconsMap[visibility]} size="s" />{' '}
              <span>{visibilityText[visibility]}</span>
            </span>{' '}
            <span class="ib">
              {repliesCount > 0 && (
                <span>
                  <Icon icon="reply" alt="Replies" size="s" />{' '}
                  <span>{shortenNumber(repliesCount)}</span>
                </span>
              )}{' '}
              {reblogsCount > 0 && (
                <span>
                  <Icon icon="rocket" alt="Boosts" size="s" />{' '}
                  <span>{shortenNumber(reblogsCount)}</span>
                </span>
              )}{' '}
              {favouritesCount > 0 && (
                <span>
                  <Icon icon="heart" alt="Favourites" size="s" />{' '}
                  <span>{shortenNumber(favouritesCount)}</span>
                </span>
              )}
            </span>
            <br />
            {createdDateText}
          </MenuHeader>
          <MenuLink
            to={instance ? `/${instance}/s/${id}` : `/s/${id}`}
            onClick={onStatusLinkClick}
          >
            <Icon icon="arrow-right" />
            <span>View post by @{username || acct}</span>
          </MenuLink>
        </>
      )}
      {!!editedAt && (
        <MenuItem
          onClick={() => {
            setShowEdited(id);
          }}
        >
          <Icon icon="history" />
          <span>
            Show Edit History
            <br />
            <small class="more-insignificant">Edited: {editedDateText}</small>
          </span>
        </MenuItem>
      )}
      {(!isSizeLarge || !!editedAt) && <MenuDivider />}
      {isSizeLarge && (
        <MenuItem onClick={() => setShowReactions(true)}>
          <Icon icon="react" />
          <span>
            Boosted/Favourited by<span class="more-insignificant">…</span>
          </span>
        </MenuItem>
      )}
      {!isSizeLarge && sameInstance && (
        <>
          <div class="menu-horizontal">
            <MenuConfirm
              subMenu
              confirmLabel={
                <>
                  <Icon icon="rocket" />
                  <span>{reblogged ? 'Unboost?' : 'Boost to everyone?'}</span>
                </>
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
              disabled={!canBoost}
              onClick={async () => {
                try {
                  const done = await confirmBoostStatus();
                  if (!isSizeLarge && done) {
                    showToast(reblogged ? 'Unboosted' : 'Boosted');
                  }
                } catch (e) {}
              }}
            >
              <Icon
                icon="rocket"
                style={{
                  color: reblogged && 'var(--reblog-color)',
                }}
              />
              <span>{reblogged ? 'Unboost' : 'Boost…'}</span>
            </MenuConfirm>
            <MenuItem
              onClick={() => {
                try {
                  favouriteStatus();
                  if (!isSizeLarge)
                    showToast(favourited ? 'Unfavourited' : 'Favourited');
                } catch (e) {}
              }}
            >
              <Icon
                icon="heart"
                style={{
                  color: favourited && 'var(--favourite-color)',
                }}
              />
              <span>{favourited ? 'Unfavourite' : 'Favourite'}</span>
            </MenuItem>
          </div>
          <div class="menu-horizontal">
            <MenuItem onClick={replyStatus}>
              <Icon icon="reply" />
              <span>Reply</span>
            </MenuItem>
            <MenuItem
              onClick={() => {
                try {
                  bookmarkStatus();
                  if (!isSizeLarge)
                    showToast(bookmarked ? 'Unbookmarked' : 'Bookmarked');
                } catch (e) {}
              }}
            >
              <Icon
                icon="bookmark"
                style={{
                  color: bookmarked && 'var(--link-color)',
                }}
              />
              <span>{bookmarked ? 'Unbookmark' : 'Bookmark'}</span>
            </MenuItem>
          </div>
        </>
      )}
      {enableTranslate ? (
        <MenuItem
          disabled={forceTranslate}
          onClick={() => {
            setForceTranslate(true);
          }}
        >
          <Icon icon="translate" />
          <span>Translate</span>
        </MenuItem>
      ) : (
        (!language || differentLanguage) && (
          <MenuLink
            to={`${instance ? `/${instance}` : ''}/s/${id}?translate=1`}
          >
            <Icon icon="translate" />
            <span>Translate</span>
          </MenuLink>
        )
      )}
      {((!isSizeLarge && sameInstance) || enableTranslate) && <MenuDivider />}
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
        {navigator?.share &&
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
      {(isSelf || mentionSelf) && <MenuDivider />}
      {(isSelf || mentionSelf) && (
        <MenuItem
          onClick={async () => {
            try {
              const newStatus = await masto.v1.statuses[
                muted ? 'unmute' : 'mute'
              ](id);
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
      {isSelf && (
        <div class="menu-horizontal">
          <MenuItem
            onClick={() => {
              states.showCompose = {
                editStatus: status,
              };
            }}
          >
            <Icon icon="pencil" />
            <span>Edit</span>
          </MenuItem>
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
                    await masto.v1.statuses.remove(id);
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
    </>
  );

  const contextMenuRef = useRef();
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [contextMenuAnchorPoint, setContextMenuAnchorPoint] = useState({
    x: 0,
    y: 0,
  });
  const bindLongPressContext = useLongPress(
    (e) => {
      const { clientX, clientY } = e.touches?.[0] || e;
      // link detection copied from onContextMenu because here it works
      const link = e.target.closest('a');
      if (link && /^https?:\/\//.test(link.getAttribute('href'))) return;
      e.preventDefault();
      setContextMenuAnchorPoint({
        x: clientX,
        y: clientY,
      });
      setIsContextMenuOpen(true);
    },
    {
      threshold: 600,
      captureEvent: true,
      detect: 'touch',
      cancelOnMovement: 4, // true allows movement of up to 25 pixels
    },
  );

  const showContextMenu = size !== 'l' && !previewMode && !_deleted && !quoted;

  return (
    <article
      ref={statusRef}
      tabindex="-1"
      class={`status ${
        !withinContext && inReplyToAccount ? 'status-reply-to' : ''
      } visibility-${visibility} ${_pinned ? 'status-pinned' : ''} ${
        {
          s: 'small',
          m: 'medium',
          l: 'large',
        }[size]
      } ${_deleted ? 'status-deleted' : ''} ${quoted ? 'status-card' : ''}`}
      onMouseEnter={debugHover}
      onContextMenu={(e) => {
        // FIXME: this code isn't getting called on Chrome at all?
        if (!showContextMenu) return;
        if (e.metaKey) return;
        // console.log('context menu', e);
        const link = e.target.closest('a');
        if (link && /^https?:\/\//.test(link.getAttribute('href'))) return;
        e.preventDefault();
        setContextMenuAnchorPoint({
          x: e.clientX,
          y: e.clientY,
        });
        setIsContextMenuOpen(true);
      }}
      {...(showContextMenu ? bindLongPressContext() : {})}
    >
      {showContextMenu && (
        <ControlledMenu
          ref={contextMenuRef}
          state={isContextMenuOpen ? 'open' : undefined}
          anchorPoint={contextMenuAnchorPoint}
          direction="right"
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
          {/* <span> */}
          <NameText
            account={status.account}
            instance={instance}
            showAvatar={size === 's'}
            showAcct={isSizeLarge}
          />
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
            ) : url && !previewMode && !quoted ? (
              <Menu
                instanceRef={menuInstanceRef}
                portal={{
                  target: document.body,
                }}
                containerProps={{
                  style: {
                    // Higher than the backdrop
                    zIndex: 1001,
                  },
                  onClick: (e) => {
                    if (e.target === e.currentTarget)
                      menuInstanceRef.current?.closeMenu?.();
                  },
                }}
                align="end"
                gap={4}
                overflow="auto"
                viewScroll="close"
                boundingBoxPadding="8 8 8 8"
                unmountOnClose
                menuButton={({ open }) => (
                  <Link
                    to={instance ? `/${instance}/s/${id}` : `/s/${id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onStatusLinkClick?.();
                    }}
                    class={`time ${open ? 'is-open' : ''}`}
                  >
                    <Icon
                      icon={visibilityIconsMap[visibility]}
                      alt={visibilityText[visibility]}
                      size="s"
                    />{' '}
                    <RelativeTime datetime={createdAtDate} format="micro" />
                  </Link>
                )}
              >
                {StatusMenuItems}
              </Menu>
            ) : (
              <span class="time">
                <Icon
                  icon={visibilityIconsMap[visibility]}
                  alt={visibilityText[visibility]}
                  size="s"
                />{' '}
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
            {inReplyToAccountId === status.account?.id ||
            !!snapStates.statusThreadNumber[sKey] ? (
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
          } ${showSpoiler ? 'show-spoiler' : ''}`}
          data-content-text-weight={contentTextWeight ? textWeight() : null}
          style={
            (isSizeLarge || contentTextWeight) && {
              '--content-text-weight': textWeight(),
            }
          }
        >
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
              <button
                class={`light spoiler ${showSpoiler ? 'spoiling' : ''}`}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (showSpoiler) {
                    delete states.spoilers[id];
                  } else {
                    states.spoilers[id] = true;
                  }
                }}
              >
                <Icon icon={showSpoiler ? 'eye-open' : 'eye-close'} />{' '}
                {showSpoiler ? 'Show less' : 'Show more'}
              </button>
            </>
          )}
          <div class="content" ref={contentRef} data-read-more={readMoreText}>
            <div
              lang={language}
              dir="auto"
              class="inner-content"
              onClick={handleContentLinks({ mentions, instance, previewMode })}
              dangerouslySetInnerHTML={{
                __html: enhanceContent(content, {
                  emojis,
                  postEnhanceDOM: (dom) => {
                    // Remove target="_blank" from links
                    dom
                      .querySelectorAll('a.u-url[target="_blank"]')
                      .forEach((a) => {
                        if (!/http/i.test(a.innerText.trim())) {
                          a.removeAttribute('target');
                        }
                      });
                    if (previewMode) return;
                    // Unfurl Mastodon links
                    Array.from(
                      dom.querySelectorAll(
                        'a[href]:not(.u-url):not(.mention):not(.hashtag)',
                      ),
                    )
                      .filter((a) => {
                        const url = a.href;
                        const isPostItself =
                          url === status.url || url === status.uri;
                        return !isPostItself && isMastodonLinkMaybe(url);
                      })
                      .forEach((a, i) => {
                        unfurlMastodonLink(currentInstance, a.href).then(
                          (result) => {
                            if (!result) return;
                            a.removeAttribute('target');
                            if (!sKey) return;
                            if (!Array.isArray(states.statusQuotes[sKey])) {
                              states.statusQuotes[sKey] = [];
                            }
                            if (!states.statusQuotes[sKey][i]) {
                              states.statusQuotes[sKey].splice(i, 0, result);
                            }
                          },
                        );
                      });
                  },
                }),
              }}
            />
            <QuoteStatuses id={id} instance={instance} level={quoted} />
          </div>
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
                  .fetch(poll.id)
                  .then((pollResponse) => {
                    states.statuses[sKey].poll = pollResponse;
                  })
                  .catch((e) => {}); // Silently fail
              }}
              votePoll={(choices) => {
                return masto.v1.polls
                  .vote(poll.id, {
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
            differentLanguage) ||
            forceTranslate) && (
            <TranslationBlock
              forceTranslate={forceTranslate || inlineTranslate}
              mini={!isSizeLarge && !withinContext}
              sourceLanguage={language}
              text={
                (spoilerText ? `${spoilerText}\n\n` : '') +
                getHTMLText(content) +
                (poll?.options?.length
                  ? `\n\nPoll:\n${poll.options
                      .map(
                        (option) =>
                          `- ${option.title}${
                            option.votesCount >= 0
                              ? ` (${option.votesCount})`
                              : ''
                          }`,
                      )
                      .join('\n')}`
                  : '')
              }
            />
          )}
          {!spoilerText && sensitive && !!mediaAttachments.length && (
            <button
              class={`plain spoiler ${showSpoiler ? 'spoiling' : ''}`}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (showSpoiler) {
                  delete states.spoilers[id];
                } else {
                  states.spoilers[id] = true;
                }
              }}
            >
              <Icon icon={showSpoiler ? 'eye-open' : 'eye-close'} /> Sensitive
              content
            </button>
          )}
          {!!mediaAttachments.length && (
            <div
              class={`media-container media-eq${mediaAttachments.length} ${
                mediaAttachments.length > 2 ? 'media-gt2' : ''
              } ${mediaAttachments.length > 4 ? 'media-gt4' : ''}`}
            >
              {mediaAttachments
                .slice(0, isSizeLarge ? undefined : 4)
                .map((media, i) => (
                  <Media
                    key={media.id}
                    media={media}
                    autoAnimate={isSizeLarge}
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
          )}
          {!!card &&
            card?.url !== status.url &&
            card?.url !== status.uri &&
            /^https/i.test(card?.url) &&
            !sensitive &&
            !spoilerText &&
            !poll &&
            !mediaAttachments.length &&
            !snapStates.statusQuotes[sKey] && (
              <Card card={card} instance={currentInstance} />
            )}
        </div>
        {isSizeLarge && (
          <>
            <div class="extra-meta">
              {_deleted ? (
                <span class="status-deleted-tag">Deleted</span>
              ) : (
                <>
                  <Icon
                    icon={visibilityIconsMap[visibility]}
                    alt={visibilityText[visibility]}
                  />{' '}
                  <a href={url} target="_blank">
                    <time
                      class="created"
                      datetime={createdAtDate.toISOString()}
                    >
                      {createdDateText}
                    </time>
                  </a>
                  {editedAt && (
                    <>
                      {' '}
                      &bull; <Icon icon="pencil" alt="Edited" />{' '}
                      <time
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
                    <span>{reblogged ? 'Unboost?' : 'Boost to everyone?'}</span>
                  </>
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
                  title={['Favourite', 'Unfavourite']}
                  alt={['Favourite', 'Favourited']}
                  class="favourite-button"
                  icon="heart"
                  count={favouritesCount}
                  onClick={favouriteStatus}
                />
              </div>
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
              <Menu
                portal={{
                  target:
                    document.querySelector('.status-deck') || document.body,
                }}
                align="end"
                gap={4}
                overflow="auto"
                viewScroll="close"
                boundingBoxPadding="8 8 8 8"
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
              </Menu>
            </div>
          </>
        )}
      </div>
      {!!showEdited && (
        <Modal
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowEdited(false);
              statusRef.current?.focus();
            }
          }}
        >
          <EditedAtModal
            statusID={showEdited}
            instance={instance}
            fetchStatusHistory={() => {
              return masto.v1.statuses.listHistory(showEdited);
            }}
            onClose={() => {
              setShowEdited(false);
              statusRef.current?.focus();
            }}
          />
        </Modal>
      )}
      {showReactions && (
        <Modal
          class="light"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowReactions(false);
            }
          }}
        >
          <ReactionsModal
            statusID={id}
            instance={instance}
            onClose={() => setShowReactions(false)}
          />
        </Modal>
      )}
    </article>
  );
}

function Card({ card, instance }) {
  const snapStates = useSnapshot(states);
  const {
    blurhash,
    title,
    description,
    html,
    providerName,
    authorName,
    width,
    height,
    image,
    url,
    type,
    embedUrl,
    language,
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
    if (hasText && image && isMastodonLinkMaybe(url)) {
      unfurlMastodonLink(instance, url).then((result) => {
        if (!result) return;
        const { id, url } = result;
        setCardStatusURL('#' + url);

        // NOTE: This is for quote post
        // (async () => {
        //   const { masto } = api({ instance });
        //   const status = await masto.v1.statuses.fetch(id);
        //   saveStatus(status, instance);
        //   setCardStatusID(id);
        // })();
      });
    }
  }, [hasText, image]);

  // if (cardStatusID) {
  //   return (
  //     <Status statusID={cardStatusID} instance={instance} size="s" readOnly />
  //   );
  // }

  if (snapStates.unfurledLinks[url]) return null;

  if (hasText && (image || (type === 'photo' && blurhash))) {
    const domain = new URL(url).hostname.replace(/^www\./, '');
    let blurhashImage;
    if (!image) {
      const w = 44;
      const h = 44;
      const blurhashPixels = decodeBlurHash(blurhash, w, h);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
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
      >
        <div class="card-image">
          <img
            src={image || blurhashImage}
            width={width}
            height={height}
            loading="lazy"
            alt=""
            onError={(e) => {
              try {
                e.target.style.display = 'none';
              } catch (e) {}
            }}
          />
        </div>
        <div class="meta-container">
          <p class="meta domain">{domain}</p>
          <p class="title">{title}</p>
          <p class="meta">{description || providerName || authorName}</p>
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
  } else if (type === 'video') {
    if (/youtube/i.test(providerName)) {
      // Get ID from e.g. https://www.youtube.com/watch?v=[VIDEO_ID]
      const videoID = url.match(/watch\?v=([^&]+)/)?.[1];
      if (videoID) {
        return <lite-youtube videoid={videoID} nocookie></lite-youtube>;
      }
    }
    return (
      <div
        class="card video"
        style={{
          aspectRatio: `${width}/${height}`,
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  } else if (hasText && !image) {
    const domain = new URL(url).hostname.replace(/^www\./, '');
    return (
      <a
        href={cardStatusURL || url}
        target={cardStatusURL ? null : '_blank'}
        rel="nofollow noopener noreferrer"
        class={`card link no-image`}
        lang={language}
      >
        <div class="meta-container">
          <p class="meta domain">
            <Icon icon="link" size="s" /> <span>{domain}</span>
          </p>
          <p class="title">{title}</p>
          <p class="meta">{description || providerName || authorName}</p>
        </div>
      </a>
    );
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

const REACTIONS_LIMIT = 80;
function ReactionsModal({ statusID, instance, onClose }) {
  const { masto } = api({ instance });
  const [uiState, setUIState] = useState('default');
  const [accounts, setAccounts] = useState([]);
  const [showMore, setShowMore] = useState(false);

  const reblogIterator = useRef();
  const favouriteIterator = useRef();

  async function fetchAccounts(firstLoad) {
    setShowMore(false);
    setUIState('loading');
    (async () => {
      try {
        if (firstLoad) {
          reblogIterator.current = masto.v1.statuses.listRebloggedBy(statusID, {
            limit: REACTIONS_LIMIT,
          });
          favouriteIterator.current = masto.v1.statuses.listFavouritedBy(
            statusID,
            {
              limit: REACTIONS_LIMIT,
            },
          );
        }
        const [{ value: reblogResults }, { value: favouriteResults }] =
          await Promise.allSettled([
            reblogIterator.current.next(),
            favouriteIterator.current.next(),
          ]);
        if (reblogResults.value?.length || favouriteResults.value?.length) {
          if (reblogResults.value?.length) {
            for (const account of reblogResults.value) {
              const theAccount = accounts.find((a) => a.id === account.id);
              if (!theAccount) {
                accounts.push({
                  ...account,
                  _types: ['reblog'],
                });
              } else {
                theAccount._types.push('reblog');
              }
            }
          }
          if (favouriteResults.value?.length) {
            for (const account of favouriteResults.value) {
              const theAccount = accounts.find((a) => a.id === account.id);
              if (!theAccount) {
                accounts.push({
                  ...account,
                  _types: ['favourite'],
                });
              } else {
                theAccount._types.push('favourite');
              }
            }
          }
          setAccounts(accounts);
          setShowMore(!reblogResults.done || !favouriteResults.done);
        } else {
          setShowMore(false);
        }
        setUIState('default');
      } catch (e) {
        console.error(e);
        setUIState('error');
      }
    })();
  }

  useEffect(() => {
    fetchAccounts(true);
  }, []);

  return (
    <div id="reactions-container" class="sheet">
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" />
        </button>
      )}
      <header>
        <h2>Boosted/Favourited by…</h2>
      </header>
      <main>
        {accounts.length > 0 ? (
          <>
            <ul class="reactions-list">
              {accounts.map((account) => {
                const { _types } = account;
                return (
                  <li key={account.id + _types}>
                    <div class="reactions-block">
                      {_types.map((type) => (
                        <Icon
                          icon={
                            {
                              reblog: 'rocket',
                              favourite: 'heart',
                            }[type]
                          }
                          class={`${type}-icon`}
                        />
                      ))}
                    </div>
                    <AccountBlock account={account} instance={instance} />
                  </li>
                );
              })}
            </ul>
            {uiState === 'default' ? (
              showMore ? (
                <InView
                  onChange={(inView) => {
                    if (inView) {
                      fetchAccounts();
                    }
                  }}
                >
                  <button
                    type="button"
                    class="plain block"
                    onClick={() => fetchAccounts()}
                  >
                    Show more&hellip;
                  </button>
                </InView>
              ) : (
                <p class="ui-state insignificant">The end.</p>
              )
            ) : (
              uiState === 'loading' && (
                <p class="ui-state">
                  <Loader abrupt />
                </p>
              )
            )}
          </>
        ) : uiState === 'loading' ? (
          <p class="ui-state">
            <Loader abrupt />
          </p>
        ) : uiState === 'error' ? (
          <p class="ui-state">Unable to load accounts</p>
        ) : (
          <p class="ui-state insignificant">No one yet.</p>
        )}
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
  icon,
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
      class={`plain ${className} ${checked ? 'checked' : ''}`}
      onClick={(e) => {
        if (!onClick) return;
        e.preventDefault();
        e.stopPropagation();
        onClick(e);
      }}
      {...props}
    >
      <Icon icon={icon} size="l" alt={iconAlt} />
      {!!count && (
        <>
          {' '}
          <small title={count}>{shortenNumber(count)}</small>
        </>
      )}
    </button>
  );
}

export function formatDuration(time) {
  if (!time) return;
  let hours = Math.floor(time / 3600);
  let minutes = Math.floor((time % 3600) / 60);
  let seconds = Math.round(time % 60);

  if (hours === 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  } else {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  }
}

const denylistDomains = /(twitter|github)\.com/i;
const failedUnfurls = {};

function _unfurlMastodonLink(instance, url) {
  const snapStates = snapshot(states);
  if (denylistDomains.test(url)) {
    return;
  }
  if (failedUnfurls[url]) {
    return;
  }
  const instanceRegex = new RegExp(instance + '/');
  if (instanceRegex.test(snapStates.unfurledLinks[url]?.url)) {
    return Promise.resolve(snapStates.unfurledLinks[url]);
  }
  console.debug('🦦 Unfurling URL', url);

  let remoteInstanceFetch;
  let theURL = url;
  if (/\/\/elk\.[^\/]+\/[^.]+\.[^.]+/i.test(theURL)) {
    // E.g. https://elk.zone/domain.com/@stest/123 -> https://domain.com/@stest/123
    theURL = theURL.replace(/elk\.[^\/]+\//i, '');
  }
  const urlObj = new URL(theURL);
  const domain = urlObj.hostname;
  const path = urlObj.pathname;
  // Regex /:username/:id, where username = @username or @username@domain, id = number
  const statusRegex = /\/@([^@\/]+)@?([^\/]+)?\/(\d+)$/i;
  const statusMatch = statusRegex.exec(path);
  if (statusMatch) {
    const id = statusMatch[3];
    const { masto } = api({ instance: domain });
    remoteInstanceFetch = masto.v1.statuses.fetch(id).then((status) => {
      if (status?.id) {
        return {
          status,
          instance: domain,
        };
      } else {
        throw new Error('No results');
      }
    });
  }

  const { masto } = api({ instance });
  const mastoSearchFetch = masto.v2
    .search({
      q: url,
      type: 'statuses',
      resolve: true,
      limit: 1,
    })
    .then((results) => {
      if (results.statuses.length > 0) {
        const status = results.statuses[0];
        return {
          status,
          instance,
        };
      } else {
        throw new Error('No results');
      }
    });

  function handleFulfill(result) {
    const { status, instance } = result;
    const { id } = status;
    const selfURL = `/${instance}/s/${id}`;
    console.debug('🦦 Unfurled URL', url, id, selfURL);
    const data = {
      id,
      instance,
      url: selfURL,
    };
    states.unfurledLinks[url] = data;
    saveStatus(status, instance, {
      skipThreading: true,
    });
    return data;
  }
  function handleCatch(e) {
    failedUnfurls[url] = true;
  }

  if (remoteInstanceFetch) {
    return Promise.any([remoteInstanceFetch, mastoSearchFetch])
      .then(handleFulfill)
      .catch(handleCatch);
  } else {
    return mastoSearchFetch.then(handleFulfill).catch(handleCatch);
  }
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
      {host}
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

const unfurlMastodonLink = throttle(
  mem(_unfurlMastodonLink, {
    cacheKey: (instance, url) => `${instance}:${url}`,
  }),
);

function FilteredStatus({ status, filterInfo, instance, containerProps = {} }) {
  const {
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
      cancelOnMovement: 4, // true allows movement of up to 25 pixels
    },
  );

  return (
    <div
      class={isReblog ? (group ? 'status-group' : 'status-reblog') : ''}
      {...containerProps}
      title={statusPeekText}
      onContextMenu={(e) => {
        e.preventDefault();
        setShowPeek(true);
      }}
      {...bindLongPressPeek()}
    >
      <article class="status filtered" tabindex="-1">
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
          class="light"
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
                class="status-link"
                to={`/${instance}/s/${status.id}`}
                onClick={() => {
                  setShowPeek(false);
                }}
              >
                <Status status={status} instance={instance} size="s" readOnly />
                <button type="button" class="status-post-link plain3">
                  See post &raquo;
                </button>
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
      <Link
        key={q.instance + q.id}
        to={`${q.instance ? `/${q.instance}` : ''}/s/${q.id}`}
        class="status-card-link"
      >
        <Status
          statusID={q.id}
          instance={q.instance}
          size="s"
          quoted={level + 1}
        />
      </Link>
    );
  });
});

export default memo(Status);
