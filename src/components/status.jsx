import './status.css';

import { getBlurHashAverageColor } from 'fast-blurhash';
import mem from 'mem';
import { memo } from 'preact/compat';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import { useHotkeys } from 'react-hotkeys-hook';
import { InView } from 'react-intersection-observer';
import 'swiped-events';
import useResizeObserver from 'use-resize-observer';
import { useSnapshot } from 'valtio';

import Loader from '../components/loader';
import Modal from '../components/modal';
import NameText from '../components/name-text';
import enhanceContent from '../utils/enhance-content';
import handleAccountLinks from '../utils/handle-account-links';
import htmlContentLength from '../utils/html-content-length';
import shortenNumber from '../utils/shorten-number';
import states, { saveStatus } from '../utils/states';
import store from '../utils/store';
import useDebouncedCallback from '../utils/useDebouncedCallback';
import visibilityIconsMap from '../utils/visibility-icons-map';

import Avatar from './avatar';
import Icon from './icon';
import Link from './link';
import RelativeTime from './relative-time';

function fetchAccount(id) {
  return masto.v1.accounts.fetch(id);
}
const memFetchAccount = mem(fetchAccount);

function Status({
  statusID,
  status,
  withinContext,
  size = 'm',
  skeleton,
  readOnly,
}) {
  if (skeleton) {
    return (
      <div class="status skeleton">
        <Avatar size="xxl" />
        <div class="container">
          <div class="meta">███ ████████████</div>
          <div class="content-container">
            <div class="content">
              <p>████ ████████████</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const snapStates = useSnapshot(states);
  if (!status) {
    status = snapStates.statuses[statusID];
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
      url,
      displayName,
      username,
      emojis: accountEmojis,
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
    emojis,
    _deleted,
  } = status;

  console.debug('RENDER Status', id, status?.account.displayName);

  const createdAtDate = new Date(createdAt);
  const editedAtDate = new Date(editedAt);

  const isSelf = useMemo(() => {
    const currentAccount = store.session.get('currentAccount');
    return currentAccount && currentAccount === accountId;
  }, [accountId]);

  let inReplyToAccountRef = mentions?.find(
    (mention) => mention.id === inReplyToAccountId,
  );
  if (!inReplyToAccountRef && inReplyToAccountId === id) {
    inReplyToAccountRef = { url, username, displayName };
  }
  const [inReplyToAccount, setInReplyToAccount] = useState(inReplyToAccountRef);
  if (!withinContext && !inReplyToAccount && inReplyToAccountId) {
    const account = states.accounts[inReplyToAccountId];
    if (account) {
      setInReplyToAccount(account);
    } else {
      memFetchAccount(inReplyToAccountId)
        .then((account) => {
          setInReplyToAccount(account);
          states.accounts[account.id] = account;
        })
        .catch((e) => {});
    }
  }

  const showSpoiler = !!snapStates.spoilers[id] || false;

  const debugHover = (e) => {
    if (e.shiftKey) {
      console.log(status);
    }
  };

  const [showMediaModal, setShowMediaModal] = useState(false);

  if (reblog) {
    return (
      <div class="status-reblog" onMouseEnter={debugHover}>
        <div class="status-pre-meta">
          <Icon icon="rocket" size="l" />{' '}
          <NameText account={status.account} showAvatar /> boosted
        </div>
        <Status status={reblog} size={size} />
      </div>
    );
  }

  const [showEdited, setShowEdited] = useState(false);

  const currentYear = new Date().getFullYear();

  const spoilerContentRef = useRef(null);
  useResizeObserver({
    ref: spoilerContentRef,
    onResize: () => {
      if (spoilerContentRef.current) {
        const { scrollHeight, clientHeight } = spoilerContentRef.current;
        spoilerContentRef.current.classList.toggle(
          'truncated',
          scrollHeight > clientHeight,
        );
      }
    },
  });
  const contentRef = useRef(null);
  useResizeObserver({
    ref: contentRef,
    onResize: () => {
      if (contentRef.current) {
        const { scrollHeight, clientHeight } = contentRef.current;
        contentRef.current.classList.toggle(
          'truncated',
          scrollHeight > clientHeight,
        );
      }
    },
  });
  const readMoreText = 'Read more →';

  const statusRef = useRef(null);

  return (
    <article
      ref={statusRef}
      tabindex="-1"
      class={`status ${
        !withinContext && inReplyToAccount ? 'status-reply-to' : ''
      } visibility-${visibility} ${
        {
          s: 'small',
          m: 'medium',
          l: 'large',
        }[size]
      }`}
      onMouseEnter={debugHover}
    >
      {size !== 'l' && (
        <div class="status-badge">
          {reblogged && <Icon class="reblog" icon="rocket" size="s" />}
          {favourited && <Icon class="favourite" icon="heart" size="s" />}
          {bookmarked && <Icon class="bookmark" icon="bookmark" size="s" />}
        </div>
      )}
      {size !== 's' && (
        <a
          href={url}
          tabindex="-1"
          // target="_blank"
          title={`@${acct}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            states.showAccount = status.account;
          }}
        >
          <Avatar url={avatarStatic} size="xxl" />
        </a>
      )}
      <div class="container">
        <div class="meta">
          {/* <span> */}
          <NameText
            account={status.account}
            showAvatar={size === 's'}
            showAcct={size === 'l'}
          />
          {/* {inReplyToAccount && !withinContext && size !== 's' && (
              <>
                {' '}
                <span class="ib">
                  <Icon icon="arrow-right" class="arrow" />{' '}
                  <NameText account={inReplyToAccount} short />
                </span>
              </>
            )} */}
          {/* </span> */}{' '}
          {size !== 'l' &&
            (uri ? (
              <Link to={`/s/${id}`} class="time">
                <Icon
                  icon={visibilityIconsMap[visibility]}
                  alt={visibility}
                  size="s"
                />{' '}
                <RelativeTime datetime={createdAtDate} format="micro" />
              </Link>
            ) : (
              <span class="time">
                <Icon
                  icon={visibilityIconsMap[visibility]}
                  alt={visibility}
                  size="s"
                />{' '}
                <RelativeTime datetime={createdAtDate} format="micro" />
              </span>
            ))}
        </div>
        {!withinContext && size !== 's' && (
          <>
            {inReplyToAccountId === status.account?.id ||
            !!snapStates.statusThreadNumber[id] ? (
              <div class="status-thread-badge">
                <Icon icon="thread" size="s" />
                Thread
                {snapStates.statusThreadNumber[id]
                  ? ` ${snapStates.statusThreadNumber[id]}/X`
                  : ''}
              </div>
            ) : (
              !!inReplyToId &&
              !!inReplyToAccount &&
              (!!spoilerText || filtered.length > 0 ||
                !mentions.find((mention) => {
                  return mention.id === inReplyToAccountId;
                })) && (
                <div class="status-reply-badge">
                  <Icon icon="reply" />{' '}
                  <NameText account={inReplyToAccount} short />
                </div>
              )
            )}
          </>
        )}
        <div
          class={`content-container ${
            filtered.length > 0 || sensitive || spoilerText ? 'has-spoiler' : ''
          } ${showSpoiler ? 'show-spoiler' : ''}`}
          style={
            size === 'l' && {
              '--content-text-weight':
                Math.round(
                  ((spoilerText || (filtered[0] || {filter:{}}).filter.title || '').length + htmlContentLength(content)) / 140,
                ) || 1,
            }
          }
        >
          {(filtered.length > 0 || (!!spoilerText && sensitive)) && (
            <>
              <div
                class="content"
                lang={language}
                ref={spoilerContentRef}
                data-read-more={readMoreText}
              >
                <p>{spoilerText || (filtered[0] || {filter:{}}).filter.title || ''}</p>
              </div>
              <button
                class="light spoiler"
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
            ref={contentRef}
            data-read-more={readMoreText}
            onClick={handleAccountLinks({ mentions })}
            dangerouslySetInnerHTML={{
              __html: enhanceContent(content, {
                emojis,
                postEnhanceDOM: (dom) => {
                  dom
                    .querySelectorAll('a.u-url[target="_blank"]')
                    .forEach((a) => {
                      // Remove target="_blank" from links
                      if (!/http/i.test(a.innerText.trim())) {
                        a.removeAttribute('target');
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
              readOnly={readOnly}
              onUpdate={(newPoll) => {
                states.statuses[id].poll = newPoll;
              }}
            />
          )}
          {!spoilerText && (sensitive || filtered.length > 0) && !!mediaAttachments.length && (
            <button
              class="plain spoiler"
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
              class={`media-container ${
                mediaAttachments.length > 2 ? 'media-gt2' : ''
              } ${mediaAttachments.length > 4 ? 'media-gt4' : ''}`}
            >
              {mediaAttachments
                .slice(0, size === 'l' ? undefined : 4)
                .map((media, i) => (
                  <Media
                    key={media.id}
                    media={media}
                    autoAnimate={size === 'l'}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowMediaModal(i);
                    }}
                  />
                ))}
            </div>
          )}
          {!!card &&
            !sensitive &&
            !spoilerText &&
            filtered.length === 0 &&
            !poll &&
            !mediaAttachments.length && <Card card={card} />}
        </div>
        {size === 'l' && (
          <>
            <div class="extra-meta">
              <Icon icon={visibilityIconsMap[visibility]} alt={visibility} />{' '}
              <a href={uri} target="_blank">
                <time class="created" datetime={createdAtDate.toISOString()}>
                  {Intl.DateTimeFormat('en', {
                    // Show year if not current year
                    year:
                      createdAtDate.getFullYear() === currentYear
                        ? undefined
                        : 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  }).format(createdAtDate)}
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
                    {Intl.DateTimeFormat('en', {
                      // Show year if not this year
                      year:
                        editedAtDate.getFullYear() === currentYear
                          ? undefined
                          : 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    }).format(editedAtDate)}
                  </time>
                </>
              )}
            </div>
            <div class="actions">
              <div class="action has-count">
                <StatusButton
                  title="Reply"
                  alt="Comments"
                  class="reply-button"
                  icon="comment"
                  count={repliesCount}
                  onClick={() => {
                    states.showCompose = {
                      replyToStatus: status,
                    };
                  }}
                />
              </div>
              {/* TODO: if visibility = private, only can reblog own statuses */}
              {visibility !== 'direct' && (
                <div class="action has-count">
                  <StatusButton
                    checked={reblogged}
                    title={['Boost', 'Unboost']}
                    alt={['Boost', 'Boosted']}
                    class="reblog-button"
                    icon="rocket"
                    count={reblogsCount}
                    onClick={async () => {
                      try {
                        if (!reblogged) {
                          const yes = confirm(
                            'Are you sure that you want to boost this post?',
                          );
                          if (!yes) {
                            return;
                          }
                        }
                        // Optimistic
                        states.statuses[id] = {
                          ...status,
                          reblogged: !reblogged,
                          reblogsCount: reblogsCount + (reblogged ? -1 : 1),
                        };
                        if (reblogged) {
                          const newStatus = await masto.v1.statuses.unreblog(
                            id,
                          );
                          saveStatus(newStatus);
                        } else {
                          const newStatus = await masto.v1.statuses.reblog(id);
                          saveStatus(newStatus);
                        }
                      } catch (e) {
                        console.error(e);
                        // Revert optimistism
                        states.statuses[id] = status;
                      }
                    }}
                  />
                </div>
              )}
              <div class="action has-count">
                <StatusButton
                  checked={favourited}
                  title={['Favourite', 'Unfavourite']}
                  alt={['Favourite', 'Favourited']}
                  class="favourite-button"
                  icon="heart"
                  count={favouritesCount}
                  onClick={async () => {
                    try {
                      // Optimistic
                      states.statuses[statusID] = {
                        ...status,
                        favourited: !favourited,
                        favouritesCount:
                          favouritesCount + (favourited ? -1 : 1),
                      };
                      if (favourited) {
                        const newStatus = await masto.v1.statuses.unfavourite(
                          id,
                        );
                        saveStatus(newStatus);
                      } else {
                        const newStatus = await masto.v1.statuses.favourite(id);
                        saveStatus(newStatus);
                      }
                    } catch (e) {
                      console.error(e);
                      // Revert optimistism
                      states.statuses[statusID] = status;
                    }
                  }}
                />
              </div>
              <div class="action">
                <StatusButton
                  checked={bookmarked}
                  title={['Bookmark', 'Unbookmark']}
                  alt={['Bookmark', 'Bookmarked']}
                  class="bookmark-button"
                  icon="bookmark"
                  onClick={async () => {
                    try {
                      // Optimistic
                      states.statuses[statusID] = {
                        ...status,
                        bookmarked: !bookmarked,
                      };
                      if (bookmarked) {
                        const newStatus = await masto.v1.statuses.unbookmark(
                          id,
                        );
                        saveStatus(newStatus);
                      } else {
                        const newStatus = await masto.v1.statuses.bookmark(id);
                        saveStatus(newStatus);
                      }
                    } catch (e) {
                      console.error(e);
                      // Revert optimistism
                      states.statuses[statusID] = status;
                    }
                  }}
                />
              </div>
              {isSelf && (
                <span class="menu-container">
                  <button type="button" title="More" class="plain more-button">
                    <Icon icon="more" size="l" alt="More" />
                  </button>
                  <menu>
                    {isSelf && (
                      <li>
                        <button
                          type="button"
                          class="plain"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            states.showCompose = {
                              editStatus: status,
                            };
                          }}
                        >
                          Edit&hellip;
                        </button>
                      </li>
                    )}
                  </menu>
                </span>
              )}
            </div>
          </>
        )}
      </div>
      {showMediaModal !== false && (
        <Modal>
          <Carousel
            mediaAttachments={mediaAttachments}
            index={showMediaModal}
            onClose={() => {
              setShowMediaModal(false);
            }}
          />
        </Modal>
      )}
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
            onClose={() => {
              setShowEdited(false);
              statusRef.current?.focus();
            }}
          />
        </Modal>
      )}
    </article>
  );
}

/*
Media type
===
unknown = unsupported or unrecognized file type
image = Static image
gifv = Looping, soundless animation
video = Video clip
audio = Audio track
*/

function Media({ media, showOriginal, autoAnimate, onClick = () => {} }) {
  const { blurhash, description, meta, previewUrl, remoteUrl, url, type } =
    media;
  const { original, small, focus } = meta || {};

  const width = showOriginal ? original?.width : small?.width;
  const height = showOriginal ? original?.height : small?.height;
  const mediaURL = showOriginal ? url : previewUrl;

  const rgbAverageColor = blurhash ? getBlurHashAverageColor(blurhash) : null;

  const videoRef = useRef();

  let focalBackgroundPosition;
  if (focus) {
    // Convert focal point to CSS background position
    // Formula from jquery-focuspoint
    // x = -1, y = 1 => 0% 0%
    // x = 0, y = 0 => 50% 50%
    // x = 1, y = -1 => 100% 100%
    const x = ((focus.x + 1) / 2) * 100;
    const y = ((1 - focus.y) / 2) * 100;
    focalBackgroundPosition = `${x.toFixed(0)}% ${y.toFixed(0)}%`;
  }

  if (type === 'image' || (type === 'unknown' && previewUrl && url)) {
    // Note: type: unknown might not have width/height
    return (
      <div
        class={`media media-image`}
        onClick={onClick}
        style={
          showOriginal && {
            backgroundImage: `url(${previewUrl})`,
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            aspectRatio: `${width}/${height}`,
            width,
            height,
            maxWidth: '100%',
            maxHeight: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }
        }
      >
        <img
          src={mediaURL}
          alt={description}
          width={width}
          height={height}
          loading={showOriginal ? 'eager' : 'lazy'}
          style={
            !showOriginal && {
              backgroundColor:
                rgbAverageColor && `rgb(${rgbAverageColor.join(',')})`,
              backgroundPosition: focalBackgroundPosition || 'center',
            }
          }
        />
      </div>
    );
  } else if (type === 'gifv' || type === 'video') {
    const shortDuration = original.duration < 31;
    const isGIF = type === 'gifv' && shortDuration;
    // If GIF is too long, treat it as a video
    const loopable = original.duration < 61;
    const formattedDuration = formatDuration(original.duration);
    const hoverAnimate = !showOriginal && !autoAnimate && isGIF;
    const autoGIFAnimate = !showOriginal && autoAnimate && isGIF;
    return (
      <div
        class={`media media-${isGIF ? 'gif' : 'video'} ${
          autoGIFAnimate ? 'media-contain' : ''
        }`}
        data-formatted-duration={formattedDuration}
        data-label={isGIF && !showOriginal && !autoGIFAnimate ? 'GIF' : ''}
        style={{
          backgroundColor:
            rgbAverageColor && `rgb(${rgbAverageColor.join(',')})`,
        }}
        onClick={(e) => {
          if (hoverAnimate) {
            try {
              videoRef.current.pause();
            } catch (e) {}
          }
          onClick(e);
        }}
        onMouseEnter={() => {
          if (hoverAnimate) {
            try {
              videoRef.current.play();
            } catch (e) {}
          }
        }}
        onMouseLeave={() => {
          if (hoverAnimate) {
            try {
              videoRef.current.pause();
            } catch (e) {}
          }
        }}
      >
        {showOriginal || autoGIFAnimate ? (
          <div
            style={{
              width: '100%',
              height: '100%',
            }}
            dangerouslySetInnerHTML={{
              __html: `
              <video
                src="${url}"
                poster="${previewUrl}"
                width="${width}"
                height="${height}"
                preload="auto"
                autoplay
                muted="${isGIF}"
                ${isGIF ? '' : 'controls'}
                playsinline
                loop="${loopable}"
              ></video>
            `,
            }}
          />
        ) : isGIF ? (
          <video
            ref={videoRef}
            src={url}
            poster={previewUrl}
            width={width}
            height={height}
            preload="auto"
            // controls
            playsinline
            loop
            muted
          />
        ) : (
          <img
            src={previewUrl}
            alt={description}
            width={width}
            height={height}
            loading="lazy"
          />
        )}
      </div>
    );
  } else if (type === 'audio') {
    const formattedDuration = formatDuration(original.duration);
    return (
      <div
        class="media media-audio"
        data-formatted-duration={formattedDuration}
        onClick={onClick}
      >
        {showOriginal ? (
          <audio src={remoteUrl || url} preload="none" controls autoplay />
        ) : previewUrl ? (
          <img
            src={previewUrl}
            alt={description}
            width={width}
            height={height}
            loading="lazy"
          />
        ) : null}
      </div>
    );
  }
}

function Card({ card }) {
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

  if (hasText && image) {
    const domain = new URL(url).hostname.replace(/^www\./, '');
    return (
      <a
        href={url}
        target="_blank"
        rel="nofollow noopener noreferrer"
        class={`card link ${size}`}
      >
        <div class="card-image">
          <img
            src={image}
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
          <p
            class="title"
            dangerouslySetInnerHTML={{
              __html: title,
            }}
          />
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

function Poll({ poll, lang, readOnly, onUpdate = () => {} }) {
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
  useEffect(() => {
    let timeout;
    if (!expired && expiresAtDate) {
      const ms = expiresAtDate.getTime() - Date.now() + 1; // +1 to give it a little buffer
      if (ms > 0) {
        timeout = setTimeout(() => {
          setUIState('loading');
          (async () => {
            try {
              const pollResponse = await masto.v1.polls.fetch(id);
              onUpdate(pollResponse);
            } catch (e) {
              // Silent fail
            }
            setUIState('default');
          })();
        }, ms);
      }
    }
    return () => {
      clearTimeout(timeout);
    };
  }, [expired, expiresAtDate]);

  const pollVotesCount = votersCount || votesCount;
  let roundPrecision = 0;
  if (pollVotesCount <= 1000) {
    roundPrecision = 0;
  } else if (pollVotesCount <= 10000) {
    roundPrecision = 1;
  } else if (pollVotesCount <= 100000) {
    roundPrecision = 2;
  }

  return (
    <div
      lang={lang}
      class={`poll ${readOnly ? 'read-only' : ''} ${
        uiState === 'loading' ? 'loading' : ''
      }`}
    >
      {voted || expired ? (
        options.map((option, i) => {
          const { title, votesCount: optionVotesCount } = option;
          const percentage = pollVotesCount
            ? ((optionVotesCount / pollVotesCount) * 100).toFixed(
                roundPrecision,
              )
            : 0;
          // check if current poll choice is the leading one
          const isLeading =
            optionVotesCount > 0 &&
            optionVotesCount === Math.max(...options.map((o) => o.votesCount));
          return (
            <div
              key={`${i}-${title}-${optionVotesCount}`}
              class={`poll-option ${isLeading ? 'poll-option-leading' : ''}`}
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
        })
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.target;
            const formData = new FormData(form);
            const votes = [];
            formData.forEach((value, key) => {
              if (key === 'poll') {
                votes.push(value);
              }
            });
            console.log(votes);
            setUIState('loading');
            const pollResponse = await masto.v1.polls.vote(id, {
              choices: votes,
            });
            console.log(pollResponse);
            onUpdate(pollResponse);
            setUIState('default');
          }}
        >
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
                    try {
                      const pollResponse = await masto.v1.polls.fetch(id);
                      onUpdate(pollResponse);
                    } catch (e) {
                      // Silent fail
                    }
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

function EditedAtModal({ statusID, onClose = () => {} }) {
  const [uiState, setUIState] = useState('default');
  const [editHistory, setEditHistory] = useState([]);

  useEffect(() => {
    setUIState('loading');
    (async () => {
      try {
        const editHistory = await masto.v1.statuses.listHistory(statusID);
        console.log(editHistory);
        setEditHistory(editHistory);
        setUIState('default');
      } catch (e) {
        console.error(e);
        setUIState('error');
      }
    })();
  }, []);

  const currentYear = new Date().getFullYear();

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
                      {Intl.DateTimeFormat('en', {
                        // Show year if not current year
                        year:
                          createdAtDate.getFullYear() === currentYear
                            ? undefined
                            : 'numeric',
                        month: 'short',
                        day: 'numeric',
                        weekday: 'short',
                        hour: 'numeric',
                        minute: '2-digit',
                        second: '2-digit',
                      }).format(createdAtDate)}
                    </time>
                  </h3>
                  <Status status={status} size="s" withinContext readOnly />
                </li>
              );
            })}
          </ol>
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

function Carousel({ mediaAttachments, index = 0, onClose = () => {} }) {
  const carouselRef = useRef(null);

  const [currentIndex, setCurrentIndex] = useState(index);
  const carouselFocusItem = useRef(null);
  useLayoutEffect(() => {
    carouselFocusItem.current?.node?.scrollIntoView();
  }, []);
  useLayoutEffect(() => {
    carouselFocusItem.current?.node?.scrollIntoView({
      behavior: 'smooth',
    });
  }, [currentIndex]);

  const onSnap = useDebouncedCallback((inView, i) => {
    if (inView) {
      setCurrentIndex(i);
    }
  }, 100);

  const [showControls, setShowControls] = useState(true);

  useEffect(() => {
    let handleSwipe = () => {
      onClose();
    };
    if (carouselRef.current) {
      carouselRef.current.addEventListener('swiped-down', handleSwipe);
    }
    return () => {
      if (carouselRef.current) {
        carouselRef.current.removeEventListener('swiped-down', handleSwipe);
      }
    };
  }, []);

  useHotkeys('esc', onClose, [onClose]);

  const [showMediaAlt, setShowMediaAlt] = useState(false);

  return (
    <>
      <div
        ref={carouselRef}
        tabIndex="-1"
        data-swipe-threshold="44"
        class="carousel"
        onClick={(e) => {
          if (
            e.target.classList.contains('carousel-item') ||
            e.target.classList.contains('media')
          ) {
            onClose();
          }
        }}
      >
        {mediaAttachments?.map((media, i) => {
          const { blurhash } = media;
          const rgbAverageColor = blurhash
            ? getBlurHashAverageColor(blurhash)
            : null;
          return (
            <InView
              class="carousel-item"
              style={{
                '--average-color': `rgb(${rgbAverageColor?.join(',')})`,
                '--average-color-alpha': `rgba(${rgbAverageColor?.join(
                  ',',
                )}, .5)`,
              }}
              tabindex="0"
              key={media.id}
              ref={i === currentIndex ? carouselFocusItem : null} // InView options
              root={carouselRef.current}
              threshold={1}
              onChange={(inView) => onSnap(inView, i)}
              onClick={(e) => {
                if (e.target !== e.currentTarget) {
                  setShowControls(!showControls);
                }
              }}
            >
              {!!media.description && (
                <button
                  type="button"
                  class="plain2 media-alt"
                  hidden={!showControls}
                  onClick={() => {
                    setShowMediaAlt(media.description);
                  }}
                >
                  <span class="tag">ALT</span>{' '}
                  <span class="media-alt-desc">{media.description}</span>
                </button>
              )}
              <Media media={media} showOriginal />
            </InView>
          );
        })}
      </div>
      <div class="carousel-top-controls" hidden={!showControls}>
        <span>
          <button
            type="button"
            class="carousel-button plain2"
            onClick={() => onClose()}
          >
            <Icon icon="x" />
          </button>
        </span>
        {mediaAttachments?.length > 1 ? (
          <span class="carousel-dots">
            {mediaAttachments?.map((media, i) => (
              <button
                key={media.id}
                type="button"
                disabled={i === currentIndex}
                class={`plain carousel-dot ${
                  i === currentIndex ? 'active' : ''
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCurrentIndex(i);
                }}
              >
                &bull;
              </button>
            ))}
          </span>
        ) : (
          <span />
        )}
        <span>
          <a
            href={
              mediaAttachments[currentIndex]?.remoteUrl ||
              mediaAttachments[currentIndex]?.url
            }
            target="_blank"
            class="button carousel-button plain2"
            title="Open original media in new window"
          >
            <Icon icon="popout" alt="Open original media in new window" />
          </a>{' '}
        </span>
      </div>
      {mediaAttachments?.length > 1 && (
        <div class="carousel-controls" hidden={!showControls}>
          <button
            type="button"
            class="carousel-button plain2"
            hidden={currentIndex === 0}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setCurrentIndex(
                (currentIndex - 1 + mediaAttachments.length) %
                  mediaAttachments.length,
              );
            }}
          >
            <Icon icon="arrow-left" />
          </button>
          <button
            type="button"
            class="carousel-button plain2"
            hidden={currentIndex === mediaAttachments.length - 1}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setCurrentIndex((currentIndex + 1) % mediaAttachments.length);
            }}
          >
            <Icon icon="arrow-right" />
          </button>
        </div>
      )}
      {!!showMediaAlt && (
        <Modal
          class="light"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowMediaAlt(false);
            }
          }}
        >
          <div class="sheet">
            <header>
              <h2>Media description</h2>
            </header>
            <main>
              <p>{showMediaAlt}</p>
            </main>
          </div>
        </Modal>
      )}
    </>
  );
}

function formatDuration(time) {
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

export default memo(Status);
