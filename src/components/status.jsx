import './status.css';

import { getBlurHashAverageColor } from 'fast-blurhash';
import mem from 'mem';
import { useEffect, useRef, useState } from 'preact/hooks';
import { InView } from 'react-intersection-observer';
import { useSnapshot } from 'valtio';

import Loader from '../components/loader';
import Modal from '../components/modal';
import NameText from '../components/name-text';
import enhanceContent from '../utils/enhance-content';
import shortenNumber from '../utils/shorten-number';
import states from '../utils/states';
import visibilityIconsMap from '../utils/visibility-icons-map';

import Avatar from './avatar';
import Icon from './icon';

/*
Media type
===
unknown = unsupported or unrecognized file type
image = Static image
gifv = Looping, soundless animation
video = Video clip
audio = Audio track
*/

function Media({ media, showOriginal, onClick }) {
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

  if (type === 'image') {
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
          style={
            !showOriginal && {
              backgroundColor: `rgb(${rgbAverageColor.join(',')})`,
              backgroundPosition: focalBackgroundPosition || 'center',
            }
          }
        />
      </div>
    );
  } else if (type === 'gifv' || type === 'video') {
    // 20 seconds, treat as a gif
    const isGIF = type === 'gifv' && original.duration <= 20;
    return (
      <div
        class={`media media-${isGIF ? 'gif' : 'video'}`}
        style={{
          backgroundColor: `rgb(${rgbAverageColor.join(',')})`,
        }}
        onClick={(e) => {
          if (isGIF) {
            try {
              videoRef.current?.pause();
            } catch (e) {}
          }
          onClick(e);
        }}
        onMouseEnter={() => {
          if (isGIF) {
            try {
              videoRef.current?.play();
            } catch (e) {}
          }
        }}
        onMouseLeave={() => {
          if (isGIF) {
            try {
              videoRef.current?.pause();
            } catch (e) {}
          }
        }}
      >
        {showOriginal ? (
          <video
            src={url}
            poster={previewUrl}
            width={width}
            height={height}
            preload="auto"
            autoplay
            muted={isGIF}
            controls={!isGIF}
            playsinline
            loop
            onClick={() => {
              if (isGIF) {
                try {
                  videoRef.current?.play();
                } catch (e) {}
              }
            }}
          ></video>
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
          />
        )}
      </div>
    );
  } else if (type === 'audio') {
    return (
      <div class="media media-audio">
        <audio src={remoteUrl || url} preload="none" controls />
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

  if (hasText && image) {
    const domain = new URL(url).hostname.replace(/^www\./, '');
    return (
      <a
        href={url}
        target="_blank"
        rel="nofollow noopener noreferrer"
        class="card link"
      >
        <img
          class="image"
          src={image}
          width={width}
          height={height}
          alt=""
          onError={() => {
            this.style.display = 'none';
          }}
        />
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

function Poll({ poll }) {
  const [pollSnapshot, setPollSnapshot] = useState(poll);
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
  } = pollSnapshot;

  const expiresAtDate = new Date(expiresAt);

  return (
    <div class="poll">
      {voted || expired ? (
        options.map((option, i) => {
          const { title, votesCount: optionVotesCount } = option;
          const percentage = Math.round((optionVotesCount / votesCount) * 100);
          return (
            <div
              class="poll-option"
              style={{
                '--percentage': `${percentage}%`,
              }}
            >
              <div class="poll-option-title">
                {title}
                {voted && ownVotes.includes(i) && (
                  <>
                    {' '}
                    <Icon icon="check" size="s" />
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
            const pollResponse = await masto.poll.vote(id, {
              choices: votes,
            });
            console.log(pollResponse);
            setPollSnapshot(pollResponse);
            setUIState('default');
          }}
          style={{
            pointerEvents: uiState === 'loading' ? 'none' : 'auto',
            opacity: uiState === 'loading' ? 0.5 : 1,
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
                  />
                  <span class="poll-option-title">{title}</span>
                </label>
              </div>
            );
          })}
          <button
            class="poll-vote-button"
            type="submit"
            disabled={uiState === 'loading'}
          >
            Vote
          </button>
        </form>
      )}
      <p class="poll-meta">
        <span title={votersCount}>{shortenNumber(votersCount)}</span>{' '}
        {votersCount === 1 ? 'voter' : 'voters'}
        {votersCount !== votesCount && (
          <>
            {' '}
            &bull; <span title={votesCount}>
              {shortenNumber(votesCount)}
            </span>{' '}
            vote
            {votesCount === 1 ? '' : 's'}
          </>
        )}{' '}
        &bull; {expired ? 'Ended' : 'Ending'}{' '}
        <relative-time datetime={expiresAtDate.toISOString()} />
      </p>
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
        const editHistory = await masto.statuses.fetchHistory(statusID);
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
    <div id="edit-history" class="box">
      <button type="button" class="close-button plain large" onClick={onClose}>
        <Icon icon="x" alt="Close" />
      </button>
      <h2>Edit History</h2>
      {uiState === 'error' && <p>Failed to load history</p>}
      {uiState === 'loading' && (
        <p>
          <Loader abrupt /> Loading&hellip;
        </p>
      )}
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
                <Status status={status} size="s" withinContext editStatus />
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function fetchAccount(id) {
  return masto.accounts.fetch(id);
}
const memFetchAccount = mem(fetchAccount);

function Status({
  statusID,
  status,
  withinContext,
  size = 'm',
  skeleton,
  editStatus,
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
    status = snapStates.statuses.get(statusID);
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
    inReplyToAccountId,
    content,
    mentions,
    mediaAttachments,
    reblog,
    uri,
    emojis,
  } = status;

  const createdAtDate = new Date(createdAt);
  const editedAtDate = new Date(editedAt);

  let inReplyToAccountRef = mentions?.find(
    (mention) => mention.id === inReplyToAccountId,
  );
  if (!inReplyToAccountRef && inReplyToAccountId === id) {
    inReplyToAccountRef = { url, username, displayName };
  }
  const [inReplyToAccount, setInReplyToAccount] = useState(inReplyToAccountRef);
  if (!withinContext && !inReplyToAccount && inReplyToAccountId) {
    const account = states.accounts.get(inReplyToAccountId);
    if (account) {
      setInReplyToAccount(account);
    } else {
      memFetchAccount(inReplyToAccountId)
        .then((account) => {
          setInReplyToAccount(account);
          states.accounts.set(account.id, account);
        })
        .catch((e) => {});
    }
  }

  const [showSpoiler, setShowSpoiler] = useState(false);

  const debugHover = (e) => {
    if (e.shiftKey) {
      console.log(status);
    }
  };

  const [showMediaModal, setShowMediaModal] = useState(false);
  const carouselFocusItem = useRef(null);
  const prevShowMediaModal = useRef(showMediaModal);
  useEffect(() => {
    if (showMediaModal !== false) {
      carouselFocusItem.current?.node?.scrollIntoView({
        behavior: prevShowMediaModal.current === false ? 'auto' : 'smooth',
      });
    }
    prevShowMediaModal.current = showMediaModal;
  }, [showMediaModal]);

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

  const [actionsUIState, setActionsUIState] = useState(null); // boost-loading, favourite-loading, bookmark-loading
  const [showEdited, setShowEdited] = useState(false);

  const carouselRef = useRef(null);
  const currentYear = new Date().getFullYear();

  return (
    <div
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
      {size !== 's' && (
        <a
          href={url}
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
          <span>
            <NameText
              account={status.account}
              showAvatar={size === 's'}
              showAcct={size === 'l'}
            />
            {inReplyToAccount && !withinContext && size !== 's' && (
              <>
                {' '}
                <span class="ib">
                  <Icon icon="arrow-right" class="arrow" />{' '}
                  <NameText account={inReplyToAccount} short />
                </span>
              </>
            )}
          </span>{' '}
          {size !== 'l' && !editStatus && (
            <a href={uri} target="_blank" class="time">
              <Icon
                icon={visibilityIconsMap[visibility]}
                alt={visibility}
                size="s"
              />{' '}
              <relative-time
                datetime={createdAtDate.toISOString()}
                format="micro"
                threshold="P1D"
                prefix=""
              >
                {createdAtDate.toLocaleString()}
              </relative-time>
            </a>
          )}
        </div>
        <div
          class={`content-container ${
            sensitive || spoilerText ? 'has-spoiler' : ''
          } ${showSpoiler ? 'show-spoiler' : ''}`}
        >
          {!!spoilerText && sensitive && (
            <>
              <div class="content">
                <p>{spoilerText}</p>
              </div>
              <button
                class="light spoiler"
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowSpoiler(!showSpoiler);
                }}
              >
                <Icon icon={showSpoiler ? 'eye-open' : 'eye-close'} />{' '}
                {showSpoiler ? 'Show less' : 'Show more'}
              </button>
            </>
          )}
          <div
            class="content"
            onClick={(e) => {
              let { target } = e;
              if (target.parentNode.tagName.toLowerCase() === 'a') {
                target = target.parentNode;
              }
              if (
                target.tagName.toLowerCase() === 'a' &&
                target.classList.contains('u-url')
              ) {
                e.preventDefault();
                e.stopPropagation();
                const username = target.querySelector('span');
                const mention = mentions.find(
                  (mention) => mention.username === username?.innerText.trim(),
                );
                if (mention) {
                  states.showAccount = mention.acct;
                } else {
                  const href = target.getAttribute('href');
                  states.showAccount = href;
                }
              }
            }}
            dangerouslySetInnerHTML={{
              __html: enhanceContent(content, {
                emojis,
                postEnhanceDOM: (dom) => {
                  dom
                    .querySelectorAll('a.u-url[target="_blank"]')
                    .forEach((a) => {
                      // Remove target="_blank" from links
                      a.removeAttribute('target');
                    });
                },
              }),
            }}
          />
          {!!poll && <Poll poll={poll} />}
          {!spoilerText && sensitive && !!mediaAttachments.length && (
            <button
              class="plain spoiler"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowSpoiler(!showSpoiler);
              }}
            >
              <Icon icon={showSpoiler ? 'eye-open' : 'eye-close'} /> Sensitive
              content
            </button>
          )}
          {!!mediaAttachments.length && (
            <div class="media-container">
              {mediaAttachments.map((media, i) => (
                <Media
                  media={media}
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
            (size === 'l' ||
              (size === 'm' && !poll && !mediaAttachments.length)) && (
              <Card card={card} />
            )}
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
              <button
                type="button"
                title="Comment"
                class="plain reply-button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  states.showCompose = {
                    replyToStatus: status,
                  };
                }}
              >
                <Icon icon="comment" size="l" alt="Reply" />
                {!!repliesCount && (
                  <>
                    {' '}
                    <small>{shortenNumber(repliesCount)}</small>
                  </>
                )}
              </button>
              {/* TODO: if visibility = private, only can reblog own statuses */}
              {visibility !== 'direct' && (
                <button
                  type="button"
                  title={reblogged ? 'Unboost' : 'Boost'}
                  class={`plain reblog-button ${reblogged ? 'reblogged' : ''}`}
                  disabled={actionsUIState === 'boost-loading'}
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const yes = confirm(
                      reblogged ? 'Unboost this status?' : 'Boost this status?',
                    );
                    if (!yes) return;
                    setActionsUIState('boost-loading');
                    try {
                      if (reblogged) {
                        const newStatus = await masto.statuses.unreblog(id);
                        states.statuses.set(newStatus.id, newStatus);
                      } else {
                        const newStatus = await masto.statuses.reblog(id);
                        states.statuses.set(newStatus.id, newStatus);
                        states.statuses.set(
                          newStatus.reblog.id,
                          newStatus.reblog,
                        );
                      }
                    } catch (e) {
                      alert(e);
                      console.error(e);
                    } finally {
                      setActionsUIState(null);
                    }
                  }}
                >
                  <Icon
                    icon="rocket"
                    size="l"
                    alt={reblogged ? 'Boosted' : 'Boost'}
                  />
                  {!!reblogsCount && (
                    <>
                      {' '}
                      <small>{shortenNumber(reblogsCount)}</small>
                    </>
                  )}
                </button>
              )}
              <button
                type="button"
                title={favourited ? 'Unfavourite' : 'Favourite'}
                class={`plain favourite-button ${
                  favourited ? 'favourited' : ''
                }`}
                disabled={actionsUIState === 'favourite-loading'}
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActionsUIState('favourite-loading');
                  try {
                    if (favourited) {
                      const newStatus = await masto.statuses.unfavourite(id);
                      states.statuses.set(newStatus.id, newStatus);
                    } else {
                      const newStatus = await masto.statuses.favourite(id);
                      states.statuses.set(newStatus.id, newStatus);
                    }
                  } catch (e) {
                    alert(e);
                    console.error(e);
                  } finally {
                    setActionsUIState(null);
                  }
                }}
              >
                <Icon
                  icon="heart"
                  size="l"
                  alt={favourited ? 'Favourited' : 'Favourite'}
                />
                {!!favouritesCount && (
                  <>
                    {' '}
                    <small>{shortenNumber(favouritesCount)}</small>
                  </>
                )}
              </button>
              <button
                type="button"
                title={bookmarked ? 'Unbookmark' : 'Bookmark'}
                class={`plain bookmark-button ${
                  bookmarked ? 'bookmarked' : ''
                }`}
                disabled={actionsUIState === 'bookmark-loading'}
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActionsUIState('bookmark-loading');
                  try {
                    if (bookmarked) {
                      const newStatus = await masto.statuses.unbookmark(id);
                      states.statuses.set(newStatus.id, newStatus);
                    } else {
                      const newStatus = await masto.statuses.bookmark(id);
                      states.statuses.set(newStatus.id, newStatus);
                    }
                  } catch (e) {
                    alert(e);
                    console.error(e);
                  } finally {
                    setActionsUIState(null);
                  }
                }}
              >
                <Icon
                  icon="bookmark"
                  size="l"
                  alt={bookmarked ? 'Bookmarked' : 'Bookmark'}
                />
              </button>
            </div>
          </>
        )}
      </div>
      {showMediaModal !== false && (
        <Modal>
          <div
            ref={carouselRef}
            class="carousel"
            onClick={(e) => {
              if (
                e.target.classList.contains('carousel-item') ||
                e.target.classList.contains('media')
              ) {
                setShowMediaModal(false);
              }
            }}
            tabindex="0"
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
                    backgroundColor: `rgba(${rgbAverageColor.join(',')}, .5)`,
                  }}
                  tabindex="0"
                  key={media.id}
                  ref={i === showMediaModal ? carouselFocusItem : null}
                  // InView options
                  root={carouselRef.current}
                  threshold={1}
                  onChange={(inView) => {
                    if (inView) {
                      setShowMediaModal(i);
                    }
                  }}
                >
                  <Media media={media} showOriginal />
                </InView>
              );
            })}
          </div>
          <div class="carousel-top-controls">
            <span />
            <button
              type="button"
              class="carousel-button plain2"
              onClick={() => setShowMediaModal(false)}
            >
              <Icon icon="x" />
            </button>
          </div>
          {mediaAttachments?.length > 1 && (
            <div class="carousel-controls">
              <button
                type="button"
                class="carousel-button plain2"
                hidden={showMediaModal === 0}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowMediaModal(
                    (showMediaModal - 1 + mediaAttachments.length) %
                      mediaAttachments.length,
                  );
                }}
              >
                <Icon icon="arrow-left" />
              </button>
              <span class="carousel-dots">
                {mediaAttachments?.map((media, i) => (
                  <button
                    key={media.id}
                    type="button"
                    disabled={i === showMediaModal}
                    class={`plain carousel-dot ${
                      i === showMediaModal ? 'active' : ''
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowMediaModal(i);
                    }}
                  >
                    &bull;
                  </button>
                ))}
              </span>
              <button
                type="button"
                class="carousel-button plain2"
                hidden={showMediaModal === mediaAttachments.length - 1}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowMediaModal(
                    (showMediaModal + 1) % mediaAttachments.length,
                  );
                }}
              >
                <Icon icon="arrow-right" />
              </button>
            </div>
          )}
        </Modal>
      )}
      {!!showEdited && (
        <Modal
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowEdited(false);
            }
          }}
        >
          <EditedAtModal
            statusID={showEdited}
            onClose={() => {
              setShowEdited(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

export default Status;
