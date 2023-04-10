import './status.css';

import { match } from '@formatjs/intl-localematcher';
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
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { InView } from 'react-intersection-observer';
import 'swiped-events';
import { useLongPress } from 'use-long-press';
import useResizeObserver from 'use-resize-observer';
import { useSnapshot } from 'valtio';

import AccountBlock from '../components/account-block';
import Loader from '../components/loader';
import Modal from '../components/modal';
import NameText from '../components/name-text';
import { api } from '../utils/api';
import enhanceContent from '../utils/enhance-content';
import getTranslateTargetLanguage from '../utils/get-translate-target-language';
import getHTMLText from '../utils/getHTMLText';
import handleContentLinks from '../utils/handle-content-links';
import htmlContentLength from '../utils/html-content-length';
import niceDateTime from '../utils/nice-date-time';
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
  previewMode,
  allowFilters,
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

  const sKey = statusKey(statusID, instance);
  const snapStates = useSnapshot(states);
  if (!status) {
    status = snapStates.statuses[sKey] || snapStates.statuses[statusID];
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

  console.debug('RENDER Status', id, status?.account.displayName);

  const debugHover = (e) => {
    if (e.shiftKey) {
      console.log(status);
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

  const showSpoiler = !!snapStates.spoilers[id] || false;

  if (reblog) {
    // If has statusID, means useItemID (cached in states)
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

  const [forceTranslate, setForceTranslate] = useState(false);
  const targetLanguage = getTranslateTargetLanguage(true);
  const contentTranslationHideLanguages =
    snapStates.settings.contentTranslationHideLanguages || [];
  if (!snapStates.settings.contentTranslation) enableTranslate = false;

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

  const unauthInteractionErrorMessage = `Sorry, your current logged-in instance can't interact with this status from another instance.`;

  const textWeight = () =>
    Math.max(
      Math.round((spoilerText.length + htmlContentLength(content)) / 140) || 1,
      1,
    );

  const createdDateText = niceDateTime(createdAtDate);
  const editedDateText = editedAt && niceDateTime(editedAtDate);

  const isSizeLarge = size === 'l';
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

  const boostStatus = async () => {
    if (!sameInstance || !authenticated) {
      alert(unauthInteractionErrorMessage);
      return false;
    }
    try {
      if (!reblogged) {
        // Check if media has no descriptions
        const hasNoDescriptions = mediaAttachments.some(
          (attachment) => !attachment.description?.trim?.(),
        );
        let confirmText = 'Boost this post?';
        if (hasNoDescriptions) {
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
          <MenuLink to={instance ? `/${instance}/s/${id}` : `/s/${id}`}>
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
            <MenuItem onClick={replyStatus}>
              <Icon icon="reply" />
              <span>Reply</span>
            </MenuItem>
            <MenuItem
              disabled={!canBoost}
              onClick={async () => {
                try {
                  const done = await boostStatus();
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
            </MenuItem>
          </div>
          <div class="menu-horizontal">
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
      {enableTranslate && (
        <MenuItem
          disabled={forceTranslate}
          onClick={() => {
            setForceTranslate(true);
          }}
        >
          <Icon icon="translate" />
          <span>Translate</span>
        </MenuItem>
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
            <MenuItem
              onClick={() => {
                const yes = confirm('Delete this post?');
                if (yes) {
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
                }
              }}
            >
              <Icon icon="trash" />
              <span>Delete…</span>
            </MenuItem>
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
  const bindLongPress = useLongPress(
    (e) => {
      const { clientX, clientY } = e.touches?.[0] || e;
      setContextMenuAnchorPoint({
        x: clientX,
        y: clientY,
      });
      setIsContextMenuOpen(true);
    },
    {
      captureEvent: true,
      detect: 'touch',
      cancelOnMovement: true,
    },
  );

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
      } ${_deleted ? 'status-deleted' : ''}`}
      onMouseEnter={debugHover}
      onContextMenu={(e) => {
        if (size === 'l') return;
        if (e.metaKey) return;
        if (previewMode) return;
        if (_deleted) return;
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
      {...bindLongPress()}
    >
      {size !== 'l' && (
        <ControlledMenu
          ref={contextMenuRef}
          state={isContextMenuOpen ? 'open' : undefined}
          anchorPoint={contextMenuAnchorPoint}
          direction="right"
          onClose={() => setIsContextMenuOpen(false)}
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
            ) : url && !previewMode ? (
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
                  onClick: () => {
                    menuInstanceRef.current?.closeMenu?.();
                  },
                }}
                align="end"
                offsetY={4}
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
                class="content"
                lang={language}
                dir="auto"
                ref={spoilerContentRef}
                data-read-more={readMoreText}
              >
                <p>{spoilerText}</p>
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
          <div
            class="content"
            lang={language}
            dir="auto"
            ref={contentRef}
            data-read-more={readMoreText}
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
                  dom
                    .querySelectorAll(
                      'a[href]:not(.u-url):not(.mention):not(.hashtag)',
                    )
                    .forEach((a) => {
                      if (isMastodonLinkMaybe(a.href)) {
                        unfurlMastodonLink(currentInstance, a.href).then(() => {
                          a.removeAttribute('target');
                        });
                      }
                    });
                },
              }),
            }}
          />
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
          {((enableTranslate &&
            !!content.trim() &&
            language &&
            language !== targetLanguage &&
            !match([language], [targetLanguage]) &&
            !contentTranslationHideLanguages.find(
              (l) => language === l || match([language], [l]),
            )) ||
            forceTranslate) && (
            <TranslationBlock
              forceTranslate={forceTranslate}
              sourceLanguage={language}
              text={
                (spoilerText ? `${spoilerText}\n\n` : '') +
                getHTMLText(content) +
                (poll?.options?.length
                  ? `\n\nPoll:\n${poll.options
                      .map((option) => `- ${option.title}`)
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
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      states.showMediaModal = {
                        mediaAttachments,
                        index: i,
                        instance,
                        statusID: readOnly ? null : id,
                      };
                    }}
                  />
                ))}
            </div>
          )}
          {!!card &&
            !sensitive &&
            !spoilerText &&
            !poll &&
            !mediaAttachments.length && (
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
                    alt={visibility}
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
              <div class="action has-count">
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
              </div>
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
                offsetY={4}
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
          <ReactionsModal statusID={id} instance={instance} />
        </Modal>
      )}
    </article>
  );
}

function Card({ card, instance }) {
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

  if (hasText && (image || (!type !== 'photo' && blurhash))) {
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
  }
}

function Poll({
  poll,
  lang,
  readOnly,
  refresh = () => {},
  votePoll = () => {},
}) {
  const [uiState, setUIState] = useState('default');

  const {
    expired,
    expiresAt,
    id,
    multiple,
    options,
    ownVotes,
    voted,
    votersCount,
    votesCount,
  } = poll;

  const expiresAtDate = !!expiresAt && new Date(expiresAt);

  // Update poll at point of expiry
  // NOTE: Disable this because setTimeout runs immediately if delay is too large
  // https://stackoverflow.com/a/56718027/20838
  // useEffect(() => {
  //   let timeout;
  //   if (!expired && expiresAtDate) {
  //     const ms = expiresAtDate.getTime() - Date.now() + 1; // +1 to give it a little buffer
  //     if (ms > 0) {
  //       timeout = setTimeout(() => {
  //         setUIState('loading');
  //         (async () => {
  //           // await refresh();
  //           setUIState('default');
  //         })();
  //       }, ms);
  //     }
  //   }
  //   return () => {
  //     clearTimeout(timeout);
  //   };
  // }, [expired, expiresAtDate]);

  const pollVotesCount = votersCount || votesCount;
  let roundPrecision = 0;
  if (pollVotesCount <= 1000) {
    roundPrecision = 0;
  } else if (pollVotesCount <= 10000) {
    roundPrecision = 1;
  } else if (pollVotesCount <= 100000) {
    roundPrecision = 2;
  }

  const [showResults, setShowResults] = useState(false);
  const optionsHaveVoteCounts = options.every((o) => o.votesCount !== null);

  return (
    <div
      lang={lang}
      dir="auto"
      class={`poll ${readOnly ? 'read-only' : ''} ${
        uiState === 'loading' ? 'loading' : ''
      }`}
      onDblClick={() => {
        setShowResults(!showResults);
      }}
    >
      {(showResults && optionsHaveVoteCounts) || voted || expired ? (
        <div class="poll-options">
          {options.map((option, i) => {
            const { title, votesCount: optionVotesCount } = option;
            const percentage = pollVotesCount
              ? ((optionVotesCount / pollVotesCount) * 100).toFixed(
                  roundPrecision,
                )
              : 0;
            // check if current poll choice is the leading one
            const isLeading =
              optionVotesCount > 0 &&
              optionVotesCount ===
                Math.max(...options.map((o) => o.votesCount));
            return (
              <div
                key={`${i}-${title}-${optionVotesCount}`}
                class={`poll-option poll-result ${
                  isLeading ? 'poll-option-leading' : ''
                }`}
                style={{
                  '--percentage': `${percentage}%`,
                }}
              >
                <div class="poll-option-title">
                  {title}
                  {voted && ownVotes.includes(i) && (
                    <>
                      {' '}
                      <Icon icon="check-circle" />
                    </>
                  )}
                </div>
                <div
                  class="poll-option-votes"
                  title={`${optionVotesCount} vote${
                    optionVotesCount === 1 ? '' : 's'
                  }`}
                >
                  {percentage}%
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.target;
            const formData = new FormData(form);
            const choices = [];
            formData.forEach((value, key) => {
              if (key === 'poll') {
                choices.push(value);
              }
            });
            if (!choices.length) return;
            setUIState('loading');
            await votePoll(choices);
            setUIState('default');
          }}
        >
          <div class="poll-options">
            {options.map((option, i) => {
              const { title } = option;
              return (
                <div class="poll-option">
                  <label class="poll-label">
                    <input
                      type={multiple ? 'checkbox' : 'radio'}
                      name="poll"
                      value={i}
                      disabled={uiState === 'loading'}
                      readOnly={readOnly}
                    />
                    <span class="poll-option-title">{title}</span>
                  </label>
                </div>
              );
            })}
          </div>
          {!readOnly && (
            <button
              class="poll-vote-button"
              type="submit"
              disabled={uiState === 'loading'}
            >
              Vote
            </button>
          )}
        </form>
      )}
      {!readOnly && (
        <p class="poll-meta">
          {!expired && (
            <>
              <button
                type="button"
                class="textual"
                disabled={uiState === 'loading'}
                onClick={(e) => {
                  e.preventDefault();
                  setUIState('loading');
                  (async () => {
                    await refresh();
                    setUIState('default');
                  })();
                }}
              >
                Refresh
              </button>{' '}
              &bull;{' '}
            </>
          )}
          <span title={votesCount}>{shortenNumber(votesCount)}</span> vote
          {votesCount === 1 ? '' : 's'}
          {!!votersCount && votersCount !== votesCount && (
            <>
              {' '}
              &bull;{' '}
              <span title={votersCount}>{shortenNumber(votersCount)}</span>{' '}
              voter
              {votersCount === 1 ? '' : 's'}
            </>
          )}{' '}
          &bull; {expired ? 'Ended' : 'Ending'}{' '}
          {!!expiresAtDate && <RelativeTime datetime={expiresAtDate} />}
        </p>
      )}
    </div>
  );
}

function EditedAtModal({
  statusID,
  instance,
  fetchStatusHistory = () => {},
  onClose = () => {},
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
      <header>
        {/* <button type="button" class="close-button plain large" onClick={onClose}>
        <Icon icon="x" alt="Close" />
      </button> */}
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
function ReactionsModal({ statusID, instance }) {
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

function isMastodonLinkMaybe(url) {
  return /^https:\/\/.*\/\d+$/i.test(url);
}

const denylistDomains = /(twitter|github)\.com/i;
const failedUnfurls = {};

function _unfurlMastodonLink(instance, url) {
  if (denylistDomains.test(url)) {
    return;
  }
  if (failedUnfurls[url]) {
    return;
  }
  const instanceRegex = new RegExp(instance + '/');
  if (instanceRegex.test(states.unfurledLinks[url]?.url)) {
    return Promise.resolve(states.unfurledLinks[url]);
  }
  console.debug('🦦 Unfurling URL', url);

  let remoteInstanceFetch;
  const urlObj = new URL(url);
  const domain = urlObj.hostname;
  const path = urlObj.pathname;
  // Regex /:username/:id, where username = @username or @username@domain, id = number
  const statusRegex = /\/@([^@\/]+)@?([^\/]+)?\/(\d+)$/i;
  const statusMatch = statusRegex.exec(path);
  if (statusMatch) {
    const id = statusMatch[3];
    const { masto } = api({ instance: domain });
    remoteInstanceFetch = masto.v1.statuses
      .fetch(id)
      .then((status) => {
        if (status?.id) {
          const statusURL = `/${domain}/s/${id}`;
          const result = {
            id,
            url: statusURL,
          };
          console.debug('🦦 Unfurled URL', url, id, statusURL);
          states.unfurledLinks[url] = result;
          return result;
        } else {
          failedUnfurls[url] = true;
          throw new Error('No results');
        }
      })
      .catch((e) => {
        failedUnfurls[url] = true;
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
        const { id } = status;
        const statusURL = `/${instance}/s/${id}`;
        const result = {
          id,
          url: statusURL,
        };
        console.debug('🦦 Unfurled URL', url, id, statusURL);
        states.unfurledLinks[url] = result;
        return result;
      } else {
        failedUnfurls[url] = true;
        throw new Error('No results');
      }
    })
    .catch((e) => {
      failedUnfurls[url] = true;
      // console.warn(e);
      // Silently fail
    });

  return Promise.any([remoteInstanceFetch, mastoSearchFetch]);
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

const unfurlMastodonLink = throttle(_unfurlMastodonLink);

const root = document.documentElement;
const defaultBoundingBoxPadding = 8;
function safeBoundingBoxPadding() {
  // Get safe area inset variables from root
  const style = getComputedStyle(root);
  const safeAreaInsetTop = style.getPropertyValue('--sai-top');
  const safeAreaInsetRight = style.getPropertyValue('--sai-right');
  const safeAreaInsetBottom = style.getPropertyValue('--sai-bottom');
  const safeAreaInsetLeft = style.getPropertyValue('--sai-left');
  const str = [
    safeAreaInsetTop,
    safeAreaInsetRight,
    safeAreaInsetBottom,
    safeAreaInsetLeft,
  ]
    .map((v) => parseInt(v, 10) || defaultBoundingBoxPadding)
    .join(' ');
  // console.log(str);
  return str;
}

function FilteredStatus({ status, filterInfo, instance, containerProps = {} }) {
  const {
    account: { avatar, avatarStatic, bot },
    createdAt,
    visibility,
    reblog,
  } = status;
  const isReblog = !!reblog;
  const filterTitleStr = filterInfo?.titlesStr || '';
  const createdAtDate = new Date(createdAt);
  const statusPeekText = statusPeek(status.reblog || status);

  const [showPeek, setShowPeek] = useState(false);
  const bindLongPress = useLongPress(
    () => {
      setShowPeek(true);
    },
    {
      captureEvent: true,
      detect: 'touch',
      cancelOnMovement: true,
    },
  );

  return (
    <div
      class={isReblog ? 'status-reblog' : ''}
      {...containerProps}
      title={statusPeekText}
      onContextMenu={(e) => {
        e.preventDefault();
        setShowPeek(true);
      }}
      {...bindLongPress()}
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
            <main tabIndex="-1">
              <p class="heading">
                <b class="status-filtered-badge">Filtered</b> {filterTitleStr}
              </p>
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

export default memo(Status);
