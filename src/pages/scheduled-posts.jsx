import './scheduled-posts.css';

import { Trans, useLingui } from '@lingui/react/macro';
import { MenuItem } from '@szhsin/react-menu';
import { useEffect, useMemo, useReducer, useState } from 'preact/hooks';
import { useSnapshot } from 'valtio';

import Icon from '../components/icon';
import Link from '../components/link';
import Loader from '../components/loader';
import MenuConfirm from '../components/menu-confirm';
import Menu2 from '../components/menu2';
import Modal from '../components/modal';
import NavMenu from '../components/nav-menu';
import RelativeTime from '../components/relative-time';
import ScheduledAtField, {
  getLocalTimezoneName,
} from '../components/ScheduledAtField';
import Status from '../components/status';
import { api } from '../utils/api';
import niceDateTime from '../utils/nice-date-time';
import showToast from '../utils/show-toast';
import states from '../utils/states';
import useTitle from '../utils/useTitle';

const LIMIT = 40;

export default function ScheduledPosts() {
  const { t } = useLingui();
  const snapStates = useSnapshot(states);
  useTitle(t`Scheduled Posts`, '/sp');
  const { masto } = api();
  const [scheduledPosts, setScheduledPosts] = useState([]);
  const [uiState, setUIState] = useState('default');
  const [reloadCount, reload] = useReducer((c) => c + 1, 0);
  const [showScheduledPostModal, setShowScheduledPostModal] = useState(false);

  useEffect(reload, [snapStates.reloadScheduledPosts]);

  useEffect(() => {
    setUIState('loading');
    (async () => {
      try {
        const postsIterator = masto.v1.scheduledStatuses.list({ limit: LIMIT });
        const allPosts = [];
        let posts;
        do {
          const result = await postsIterator.next();
          posts = result.value;
          if (posts?.length) {
            allPosts.push(...posts);
          }
        } while (posts?.length);
        setScheduledPosts(allPosts);
      } catch (e) {
        console.error(e);
        setUIState('error');
      } finally {
        setUIState('default');
      }
    })();
  }, [reloadCount]);

  return (
    <div id="scheduled-posts-page" class="deck-container" tabIndex="-1">
      <div class="timeline-deck deck">
        <header>
          <div class="header-grid">
            <div class="header-side">
              <NavMenu />
              <Link to="/" class="button plain">
                <Icon icon="home" size="l" alt={t`Home`} />
              </Link>
            </div>
            <h1>
              <Trans>Scheduled Posts</Trans>
            </h1>
            <div class="header-side">
              <Menu2
                portal
                setDownOverflow
                overflow="auto"
                viewScroll="close"
                position="anchor"
                menuButton={
                  <button type="button" class="plain">
                    <Icon icon="more" size="l" alt={t`More`} />
                  </button>
                }
              >
                <MenuItem
                  onClick={() => {
                    reload();
                  }}
                >
                  <Icon icon="refresh" size="l" />
                  <span>
                    <Trans>Refresh</Trans>
                  </span>
                </MenuItem>
              </Menu2>
            </div>
          </div>
        </header>
        <main>
          {!scheduledPosts.length ? (
            <p class="ui-state">
              {uiState === 'loading' ? <Loader /> : t`No scheduled posts.`}
            </p>
          ) : (
            <ul class="posts-list">
              {scheduledPosts.map((post) => {
                const { id, params, scheduledAt, mediaAttachments } = post;
                const {
                  inReplyToId,
                  language,
                  poll,
                  sensitive,
                  spoilerText,
                  text,
                  visibility,
                } = params;
                const status = {
                  // account: account.info,
                  id,
                  inReplyToId,
                  language,
                  mediaAttachments,
                  poll: poll
                    ? {
                        ...poll,
                        expiresAt: new Date(Date.now() + poll.expiresIn * 1000),
                        options: poll.options.map((option) => ({
                          title: option,
                          votesCount: 0,
                        })),
                      }
                    : undefined,
                  sensitive,
                  spoilerText,
                  text,
                  visibility,
                  content: `<p>${text}</p>`,
                  // createdAt: scheduledAt,
                };

                return (
                  <li key={id}>
                    <ScheduledPostPreview
                      status={status}
                      scheduledAt={scheduledAt}
                      onClick={() => {
                        setShowScheduledPostModal({
                          post: status,
                          scheduledAt: new Date(scheduledAt),
                        });
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          )}
          {showScheduledPostModal && (
            <Modal
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowScheduledPostModal(false);
                }
              }}
            >
              <ScheduledPostEdit
                post={showScheduledPostModal.post}
                scheduledAt={showScheduledPostModal.scheduledAt}
                onClose={() => setShowScheduledPostModal(false)}
              />
            </Modal>
          )}
        </main>
      </div>
    </div>
  );
}

function ScheduledPostPreview({ status, scheduledAt, onClick }) {
  // Look at scheduledAt, if it's months away, ICON = 'month'. If it's days away, ICON = 'day', else ICON = 'time'
  const icon = useMemo(() => {
    const hours =
      (new Date(scheduledAt).getTime() - Date.now()) / (1000 * 60 * 60);
    if (hours < 24) {
      return 'time';
    } else if (hours < 720) {
      // 30 days
      return 'day';
    } else {
      return 'month';
    }
  }, [scheduledAt]);

  return (
    <button type="button" class="textual block" onClick={onClick}>
      <div class={`post-schedule-meta post-schedule-${icon}`}>
        <Icon icon={icon} class="insignificant" />{' '}
        <span>
          <Trans comment="Scheduled [in 1 day] ([Thu, Feb 27, 6:30:00 PM])">
            Scheduled{' '}
            <b>
              <RelativeTime datetime={scheduledAt} />
            </b>{' '}
            <small>
              (
              {niceDateTime(scheduledAt, {
                formatOpts: {
                  weekday: 'short',
                  second: 'numeric',
                },
              })}
              )
            </small>
          </Trans>
        </span>
      </div>
      <Status status={status} size="s" previewMode readOnly />
    </button>
  );
}

function ScheduledPostEdit({ post, scheduledAt, onClose }) {
  const { masto } = api();
  const { t } = useLingui();
  const [uiState, setUIState] = useState('default');
  const [newScheduledAt, setNewScheduledAt] = useState();
  const differentScheduledAt =
    newScheduledAt && newScheduledAt.getTime() !== scheduledAt.getTime();
  const localTZ = getLocalTimezoneName();
  const pastSchedule = scheduledAt && scheduledAt <= Date.now();

  const { inReplyToId } = post;
  const [replyToStatus, setReplyToStatus] = useState(null);
  // TODO: Uncomment this once https://github.com/mastodon/mastodon/issues/34000 is fixed
  // useEffect(() => {
  //   if (inReplyToId) {
  //     (async () => {
  //       try {
  //         const status = await masto.v1.statuses.$select(inReplyToId).fetch();
  //         setReplyToStatus(status);
  //       } catch (e) {
  //         console.error(e);
  //       }
  //     })();
  //   }
  // }, [inReplyToId]);

  return (
    <div id="scheduled-post-sheet" class="sheet">
      <button type="button" class="sheet-close" onClick={onClose}>
        <Icon icon="x" size="l" alt={t`Close`} />
      </button>
      <header>
        <h2>
          <Trans comment="Scheduled [in 1 day]">
            Scheduled{' '}
            <b>
              <RelativeTime datetime={scheduledAt} />
            </b>
          </Trans>
          <br />
          <small>
            {niceDateTime(scheduledAt, {
              formatOpts: {
                weekday: 'short',
                second: 'numeric',
              },
            })}
          </small>
        </h2>
      </header>
      <main tabIndex="-1">
        {!!replyToStatus && (
          <div class="status-reply">
            <Status status={replyToStatus} size="s" previewMode readOnly />
          </div>
        )}
        <Status
          status={post}
          size="s"
          previewMode
          readOnly
          onMediaClick={(e, i, media, status) => {
            e.preventDefault();
            states.showMediaModal = {
              mediaAttachments: post.mediaAttachments,
              mediaIndex: i,
            };
          }}
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setUIState('loading');
            (async () => {
              try {
                await masto.v1.scheduledStatuses.$select(post.id).update({
                  scheduledAt: newScheduledAt.toISOString(),
                });
                showToast(t`Scheduled post rescheduled`);
                onClose();
                setUIState('default');
                states.reloadScheduledPosts++;
              } catch (e) {
                setUIState('error');
                console.error(e);
                showToast(t`Failed to reschedule post`);
              }
            })();
          }}
        >
          <footer>
            <div class="row">
              <span>
                <ScheduledAtField
                  scheduledAt={scheduledAt}
                  setScheduledAt={(date) => {
                    setNewScheduledAt(date);
                  }}
                />{' '}
                <small class="ib">{localTZ}</small>
              </span>
            </div>
            <div class="row">
              <button
                disabled={
                  !differentScheduledAt || uiState === 'loading' || pastSchedule
                }
              >
                <Trans>Reschedule</Trans>
              </button>
              <span class="grow" />
              <MenuConfirm
                align="end"
                menuItemClassName="danger"
                confirmLabel={t`Delete scheduled post?`}
                onClick={() => {
                  setUIState('loading');
                  (async () => {
                    try {
                      await api()
                        .masto.v1.scheduledStatuses.$select(post.id)
                        .remove();
                      showToast(t`Scheduled post deleted`);
                      onClose();
                      setUIState('default');
                      states.reloadScheduledPosts++;
                    } catch (e) {
                      setUIState('error');
                      console.error(e);
                      showToast(t`Failed to delete scheduled post`);
                    }
                  })();
                }}
              >
                <button
                  type="button"
                  class="light danger"
                  disabled={uiState === 'loading' || pastSchedule}
                >
                  <Trans>Delete…</Trans>
                </button>
              </MenuConfirm>
            </div>
          </footer>
        </form>
      </main>
    </div>
  );
}
