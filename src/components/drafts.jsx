import './drafts.css';

import { useEffect, useMemo, useReducer, useState } from 'react';

import { api } from '../utils/api';
import db from '../utils/db';
import states from '../utils/states';
import { getCurrentAccountNS } from '../utils/store-utils';

import Icon from './icon';
import Loader from './loader';

function Drafts() {
  const { masto } = api();
  const [uiState, setUIState] = useState('default');
  const [drafts, setDrafts] = useState([]);
  const [reloadCount, reload] = useReducer((c) => c + 1, 0);

  useEffect(() => {
    setUIState('loading');
    (async () => {
      try {
        const keys = await db.drafts.keys();
        if (keys.length) {
          const ns = getCurrentAccountNS();
          const ownKeys = keys.filter((key) => key.startsWith(ns));
          if (ownKeys.length) {
            const drafts = await db.drafts.getMany(ownKeys);
            drafts.sort(
              (a, b) =>
                new Date(b.updatedAt).getTime() -
                new Date(a.updatedAt).getTime(),
            );
            setDrafts(drafts);
          } else {
            setDrafts([]);
          }
        } else {
          setDrafts([]);
        }
        setUIState('default');
      } catch (e) {
        console.error(e);
        setUIState('error');
      }
    })();
  }, [reloadCount]);

  const hasDrafts = drafts?.length > 0;

  return (
    <div class="sheet">
      <header>
        <h2>
          Unsent drafts <Loader abrupt hidden={uiState !== 'loading'} />
        </h2>
        {hasDrafts && (
          <div class="insignificant">
            Looks like you have unsent drafts. Let's continue where you left
            off.
          </div>
        )}
      </header>
      <main>
        {hasDrafts ? (
          <>
            <ul class="drafts-list">
              {drafts.map((draft) => {
                const { updatedAt, key, draftStatus, replyTo } = draft;
                const currentYear = new Date().getFullYear();
                const updatedAtDate = new Date(updatedAt);
                return (
                  <li key={updatedAt}>
                    <div class="mini-draft-meta">
                      <b>
                        <Icon icon={replyTo ? 'reply' : 'quill'} size="s" />{' '}
                        <time>
                          {!!replyTo && (
                            <>
                              @{replyTo.account.acct}
                              <br />
                            </>
                          )}
                          {Intl.DateTimeFormat('en', {
                            // Show year if not current year
                            year:
                              updatedAtDate.getFullYear() === currentYear
                                ? undefined
                                : 'numeric',
                            month: 'short',
                            day: 'numeric',
                            weekday: 'short',
                            hour: 'numeric',
                            minute: '2-digit',
                            second: '2-digit',
                          }).format(updatedAtDate)}
                        </time>
                      </b>
                      <button
                        type="button"
                        class="small light"
                        disabled={uiState === 'loading'}
                        onClick={() => {
                          (async () => {
                            try {
                              const yes = confirm(
                                'Are you sure you want to delete this draft?',
                              );
                              if (yes) {
                                await db.drafts.del(key);
                                reload();
                              }
                            } catch (e) {
                              alert('Error deleting draft! Please try again.');
                            }
                          })();
                        }}
                      >
                        Delete&hellip;
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={uiState === 'loading'}
                      class="draft-item"
                      onClick={async () => {
                        // console.log({ draftStatus });
                        let replyToStatus;
                        if (replyTo) {
                          setUIState('loading');
                          try {
                            replyToStatus = await masto.v1.statuses.fetch(
                              replyTo.id,
                            );
                          } catch (e) {
                            console.error(e);
                            alert('Error fetching reply-to status!');
                            setUIState('default');
                            return;
                          }
                          setUIState('default');
                        }
                        window.__COMPOSE__ = {
                          draftStatus,
                          replyToStatus,
                        };
                        states.showCompose = true;
                        states.showDrafts = false;
                      }}
                    >
                      <MiniDraft draft={draft} />
                    </button>
                  </li>
                );
              })}
            </ul>
            <p>
              <button
                type="button"
                class="light danger"
                disabled={uiState === 'loading'}
                onClick={() => {
                  (async () => {
                    const yes = confirm(
                      'Are you sure you want to delete all drafts?',
                    );
                    if (yes) {
                      setUIState('loading');
                      try {
                        await db.drafts.delMany(
                          drafts.map((draft) => draft.key),
                        );
                        setUIState('default');
                        reload();
                      } catch (e) {
                        console.error(e);
                        alert('Error deleting drafts! Please try again.');
                        setUIState('error');
                      }
                    }
                  })();
                }}
              >
                Delete all drafts&hellip;
              </button>
            </p>
          </>
        ) : (
          <p>No drafts found.</p>
        )}
      </main>
    </div>
  );
}

function MiniDraft({ draft }) {
  const { draftStatus, replyTo } = draft;
  const { status, spoilerText, poll, mediaAttachments } = draftStatus;
  const hasPoll = poll?.options?.length > 0;
  const hasMedia = mediaAttachments?.length > 0;
  const hasPollOrMedia = hasPoll || hasMedia;
  const firstImageMedia = useMemo(() => {
    if (!hasMedia) return;
    const image = mediaAttachments.find((media) => /image/.test(media.type));
    if (!image) return;
    const { file } = image;
    const objectURL = URL.createObjectURL(file);
    return objectURL;
  }, [hasMedia, mediaAttachments]);
  return (
    <>
      <div class="mini-draft">
        {hasPollOrMedia && (
          <div
            class={`mini-draft-aside ${firstImageMedia ? 'has-image' : ''}`}
            style={
              firstImageMedia
                ? {
                    '--bg-image': `url(${firstImageMedia})`,
                  }
                : {}
            }
          >
            {hasPoll && <Icon icon="poll" />}
            {hasMedia && (
              <span>
                <Icon icon="attachment" />{' '}
                <small>{mediaAttachments?.length}</small>
              </span>
            )}
          </div>
        )}
        <div class="mini-draft-main">
          {!!spoilerText && <div class="mini-draft-spoiler">{spoilerText}</div>}
          {!!status && <div class="mini-draft-status">{status}</div>}
        </div>
      </div>
    </>
  );
}

export default Drafts;
