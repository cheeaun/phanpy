import './status.css';

import { Menu, MenuItem } from '@szhsin/react-menu';
import mem from 'mem';
import pThrottle from 'p-throttle';
import { memo } from 'preact/compat';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import 'swiped-events';
import useResizeObserver from 'use-resize-observer';
import { useSnapshot } from 'valtio';

import Loader from '../components/loader';
import Modal from '../components/modal';
import NameText from '../components/name-text';
import { api } from '../utils/api';
import enhanceContent from '../utils/enhance-content';
import handleContentLinks from '../utils/handle-content-links';
import htmlContentLength from '../utils/html-content-length';
import shortenNumber from '../utils/shorten-number';
import states, { saveStatus, statusKey } from '../utils/states';
import store from '../utils/store';
import visibilityIconsMap from '../utils/visibility-icons-map';

import Avatar from './avatar';
import Icon from './icon';
import Link from './link';
import Media from './media';
import RelativeTime from './relative-time';

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

function Status({
  statusID,
  status,
  instance: propInstance,
  withinContext,
  size = 'm',
  skeleton,
  readOnly,
  contentTextWeight,
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

  const showSpoiler = !!snapStates.spoilers[id] || false;

  const debugHover = (e) => {
    if (e.shiftKey) {
      console.log(status);
    }
  };

  if (reblog) {
    return (
      <div class="status-reblog" onMouseEnter={debugHover}>
        <div class="status-pre-meta">
          <Icon icon="rocket" size="l" />{' '}
          <NameText account={status.account} instance={instance} showAvatar />{' '}
          boosted
        </div>
        <Status
          status={reblog}
          instance={instance}
          size={size}
          contentTextWeight={contentTextWeight}
        />
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

  const unauthInteractionErrorMessage = `Sorry, your current logged-in instance can't interact with this status from another instance.`;

  const textWeight = () =>
    Math.round((spoilerText.length + htmlContentLength(content)) / 140) || 1;

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
      }`}
      onMouseEnter={debugHover}
    >
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
          <Avatar url={avatarStatic} size="xxl" />
        </a>
      )}
      <div class="container">
        <div class="meta">
          {/* <span> */}
          <NameText
            account={status.account}
            instance={instance}
            showAvatar={size === 's'}
            showAcct={size === 'l'}
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
            (url ? (
              <Link
                to={instance ? `/${instance}/s/${id}` : `/s/${id}`}
                class="time"
              >
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
            (size === 'l' || contentTextWeight) && {
              '--content-text-weight': textWeight(),
            }
          }
        >
          {!!spoilerText && (
            <>
              <div
                class="content"
                lang={language}
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
            ref={contentRef}
            data-read-more={readMoreText}
            onClick={handleContentLinks({ mentions, instance })}
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
                .slice(0, size === 'l' ? undefined : 4)
                .map((media, i) => (
                  <Media
                    key={media.id}
                    media={media}
                    autoAnimate={size === 'l'}
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
        {size === 'l' && (
          <>
            <div class="extra-meta">
              <Icon icon={visibilityIconsMap[visibility]} alt={visibility} />{' '}
              <a href={url} target="_blank">
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
                    if (!sameInstance || !authenticated) {
                      return alert(unauthInteractionErrorMessage);
                    }
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
                      if (!sameInstance || !authenticated) {
                        return alert(unauthInteractionErrorMessage);
                      }
                      try {
                        if (!reblogged) {
                          const yes = confirm('Boost this post?');
                          if (!yes) {
                            return;
                          }
                        }
                        // Optimistic
                        states.statuses[sKey] = {
                          ...status,
                          reblogged: !reblogged,
                          reblogsCount: reblogsCount + (reblogged ? -1 : 1),
                        };
                        if (reblogged) {
                          const newStatus = await masto.v1.statuses.unreblog(
                            id,
                          );
                          saveStatus(newStatus, instance);
                        } else {
                          const newStatus = await masto.v1.statuses.reblog(id);
                          saveStatus(newStatus, instance);
                        }
                      } catch (e) {
                        console.error(e);
                        // Revert optimistism
                        states.statuses[sKey] = status;
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
                    if (!sameInstance || !authenticated) {
                      return alert(unauthInteractionErrorMessage);
                    }
                    try {
                      // Optimistic
                      states.statuses[sKey] = {
                        ...status,
                        favourited: !favourited,
                        favouritesCount:
                          favouritesCount + (favourited ? -1 : 1),
                      };
                      if (favourited) {
                        const newStatus = await masto.v1.statuses.unfavourite(
                          id,
                        );
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
                        const newStatus = await masto.v1.statuses.unbookmark(
                          id,
                        );
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
                  }}
                />
              </div>
              {isSelf && (
                <Menu
                  align="end"
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
                  {isSelf && (
                    <MenuItem
                      onClick={() => {
                        states.showCompose = {
                          editStatus: status,
                        };
                      }}
                    >
                      <Icon icon="pencil" /> <span>Edit&hellip;</span>
                    </MenuItem>
                  )}
                </Menu>
              )}
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

  if (hasText && image) {
    const domain = new URL(url).hostname.replace(/^www\./, '');
    return (
      <a
        href={cardStatusURL || url}
        target={cardStatusURL ? null : '_blank'}
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
  useEffect(() => {
    let timeout;
    if (!expired && expiresAtDate) {
      const ms = expiresAtDate.getTime() - Date.now() + 1; // +1 to give it a little buffer
      if (ms > 0) {
        timeout = setTimeout(() => {
          setUIState('loading');
          (async () => {
            await refresh();
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
            const choices = [];
            formData.forEach((value, key) => {
              if (key === 'poll') {
                choices.push(value);
              }
            });
            setUIState('loading');
            await votePoll(choices);
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
                  <Status
                    status={status}
                    instance={instance}
                    size="s"
                    withinContext
                    readOnly
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
  const { masto } = api({ instance });
  return masto.v2
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
      console.warn(e);
      // Silently fail
    });
}

const unfurlMastodonLink = throttle(_unfurlMastodonLink);

export default memo(Status);
