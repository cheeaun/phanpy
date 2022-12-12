import './compose.css';

import '@github/text-expander-element';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import stringLength from 'string-length';

import emojifyText from '../utils/emojify-text';
import store from '../utils/store';
import visibilityIconsMap from '../utils/visibility-icons-map';

import Avatar from './avatar';
import Icon from './icon';
import Loader from './loader';
import Status from './status';

/* NOTES:
  - Max character limit includes BOTH status text and Content Warning text
*/

export default ({ onClose, replyToStatus, editStatus }) => {
  const [uiState, setUIState] = useState('default');

  const accounts = store.local.getJSON('accounts');
  const currentAccount = store.session.get('currentAccount');
  const currentAccountInfo = accounts.find(
    (a) => a.info.id === currentAccount,
  ).info;

  const configuration = useMemo(() => {
    const instances = store.local.getJSON('instances');
    const currentInstance = accounts.find(
      (a) => a.info.id === currentAccount,
    ).instanceURL;
    const config = instances[currentInstance].configuration;
    console.log(config);
    return config;
  }, []);

  const {
    statuses: { maxCharacters, maxMediaAttachments, charactersReservedPerUrl },
    mediaAttachments: {
      supportedMimeTypes,
      imageSizeLimit,
      imageMatrixLimit,
      videoSizeLimit,
      videoMatrixLimit,
      videoFrameRateLimit,
    },
    polls: { maxOptions, maxCharactersPerOption, maxExpiration, minExpiration },
  } = configuration;

  const textareaRef = useRef();

  const [visibility, setVisibility] = useState(
    replyToStatus?.visibility || 'public',
  );
  const [sensitive, setSensitive] = useState(replyToStatus?.sensitive || false);
  const spoilerTextRef = useRef();

  useEffect(() => {
    let timer = setTimeout(() => {
      const spoilerText = replyToStatus?.spoilerText;
      if (spoilerText && spoilerTextRef.current) {
        spoilerTextRef.current.value = spoilerText;
        spoilerTextRef.current.focus();
      } else {
        textareaRef.current?.focus();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (editStatus) {
      const { visibility, sensitive, mediaAttachments } = editStatus;
      setUIState('loading');
      (async () => {
        try {
          const statusSource = await masto.statuses.fetchSource(editStatus.id);
          console.log({ statusSource });
          const { text, spoilerText } = statusSource;
          textareaRef.current.value = text;
          textareaRef.current.dataset.source = text;
          spoilerTextRef.current.value = spoilerText;
          setVisibility(visibility);
          setSensitive(sensitive);
          setMediaAttachments(mediaAttachments);
          setUIState('default');
        } catch (e) {
          console.error(e);
          alert(e?.reason || e);
          setUIState('error');
        }
      })();
    }
  }, [editStatus]);

  const textExpanderRef = useRef();
  const textExpanderTextRef = useRef('');
  useEffect(() => {
    if (textExpanderRef.current) {
      const handleChange = (e) => {
        console.log('text-expander-change', e);
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
        const type = {
          '@': 'accounts',
          '#': 'hashtags',
        }[key];
        provide(
          new Promise((resolve) => {
            const resultsIterator = masto.search({
              type,
              q: text,
              limit: 5,
            });
            resultsIterator.next().then(({ value }) => {
              if (text !== textExpanderTextRef.current) {
                return;
              }
              const results = value[type];
              console.log('RESULTS', value, results);
              const menu = document.createElement('ul');
              menu.role = 'listbox';
              menu.className = 'text-expander-menu';
              results.forEach((result) => {
                const {
                  name,
                  avatarStatic,
                  displayName,
                  username,
                  acct,
                  emojis,
                } = result;
                const displayNameWithEmoji = emojifyText(displayName, emojis);
                const item = document.createElement('li');
                item.setAttribute('role', 'option');
                if (acct) {
                  item.dataset.value = acct;
                  // Want to use <Avatar /> here, but will need to render to string 😅
                  item.innerHTML = `
                    <span class="avatar">
                      <img src="${avatarStatic}" width="16" height="16" alt="" loading="lazy" />
                    </span>
                    <span>
                    <b>${displayNameWithEmoji || username}</b>
                    <br>@${acct}
                    </span>
                  `;
                } else {
                  item.dataset.value = name;
                  item.innerHTML = `
                    <span>#<b>${name}</b></span>
                  `;
                }
                menu.appendChild(item);
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

      textExpanderRef.current.addEventListener('text-expander-value', (e) => {
        const { key, item } = e.detail;
        e.detail.value = key + item.dataset.value;
      });
    }
  }, []);

  const [mediaAttachments, setMediaAttachments] = useState([]);

  const formRef = useRef();

  const beforeUnloadCopy =
    'You have unsaved changes. Are you sure you want to discard this post?';
  const canClose = () => {
    // check for status or mediaAttachments
    const { value, dataset } = textareaRef.current;
    const containNonIDMediaAttachments =
      mediaAttachments.length > 0 &&
      mediaAttachments.some((media) => !media.id);

    if ((value && value !== dataset?.source) || containNonIDMediaAttachments) {
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

  return (
    <div id="compose-container">
      <div class="compose-top">
        {currentAccountInfo?.avatarStatic && (
          <Avatar
            url={currentAccountInfo.avatarStatic}
            size="l"
            alt={currentAccountInfo.username}
          />
        )}
        <button
          type="button"
          class="light close-button"
          onClick={() => {
            if (canClose()) {
              onClose();
            }
          }}
        >
          <Icon icon="x" />
        </button>
      </div>
      {!!replyToStatus && (
        <div class="reply-to">
          <Status status={replyToStatus} size="s" />
        </div>
      )}
      <form
        ref={formRef}
        style={{
          pointerEvents: uiState === 'loading' ? 'none' : 'auto',
          opacity: uiState === 'loading' ? 0.5 : 1,
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
          // TODO: check for URLs and use `charactersReservedPerUrl` to calculate max characters

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
                  const { file, description, sourceDescription, id } =
                    attachment;
                  console.log('UPLOADING', attachment);
                  if (id) {
                    // If already uploaded
                    return attachment;
                  } else {
                    const params = {
                      file,
                      description,
                    };
                    return masto.mediaAttachments.create(params).then((res) => {
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
                      alert(result.reason || `Attachment #${i} failed`);
                    }
                  });
                  return;
                }

                console.log({ results, mediaAttachments });
              }

              const params = {
                status,
                spoilerText,
                sensitive,
                mediaIds: mediaAttachments.map((attachment) => attachment.id),
              };
              if (!editStatus) {
                params.visibility = visibility;
                params.inReplyToId = replyToStatus?.id || undefined;
              }
              console.log('POST', params);

              let newStatus;
              if (editStatus) {
                newStatus = await masto.statuses.update(editStatus.id, params);
              } else {
                newStatus = await masto.statuses.create(params);
              }
              setUIState('default');

              // Close
              onClose({
                newStatus,
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
            placeholder="Spoiler text"
            disabled={uiState === 'loading'}
            class="spoiler-text-field"
            style={{
              opacity: sensitive ? 1 : 0,
              pointerEvents: sensitive ? 'auto' : 'none',
            }}
          />
          <label
            class="toolbar-button"
            title="Content warning or sensitive media"
          >
            <input
              name="sensitive"
              type="checkbox"
              disabled={uiState === 'loading' || !!editStatus}
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
            }`}
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
              <option value="direct">Direct</option>
            </select>
          </label>{' '}
        </div>
        <text-expander ref={textExpanderRef} keys="@ #">
          <textarea
            class="large"
            ref={textareaRef}
            placeholder={
              replyToStatus
                ? 'Post your reply'
                : editStatus
                ? 'Edit your status'
                : 'What are you doing?'
            }
            required={mediaAttachments.length === 0}
            autoCapitalize="sentences"
            autoComplete="on"
            autoCorrect="on"
            spellCheck="true"
            dir="auto"
            rows="6"
            cols="50"
            name="status"
            disabled={uiState === 'loading'}
            onInput={(e) => {
              const { scrollHeight, offsetHeight, clientHeight, value } =
                e.target;
              const offset = offsetHeight - clientHeight;
              e.target.style.height = value
                ? scrollHeight + offset + 'px'
                : null;
            }}
            style={{
              maxHeight: `${maxCharacters / 50}em`,
            }}
          ></textarea>
        </text-expander>
        {mediaAttachments.length > 0 && (
          <div class="media-attachments">
            {mediaAttachments.map((attachment, i) => {
              const { id } = attachment;
              return (
                <MediaAttachment
                  key={i + id}
                  attachment={attachment}
                  disabled={uiState === 'loading'}
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
          </div>
        )}
        <div class="toolbar">
          <div>
            <label class="toolbar-button">
              <input
                type="file"
                accept={supportedMimeTypes.join(',')}
                multiple={mediaAttachments.length < maxMediaAttachments - 1}
                disabled={
                  uiState === 'loading' ||
                  mediaAttachments.length >= maxMediaAttachments
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
                }}
              />
              <Icon icon="attachment" />
            </label>
          </div>
          <div>
            {uiState === 'loading' && <Loader abrupt />}{' '}
            <button
              type="submit"
              class="large"
              disabled={uiState === 'loading'}
            >
              {replyToStatus ? 'Reply' : editStatus ? 'Update' : 'Post'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

function MediaAttachment({
  attachment,
  disabled,
  onDescriptionChange = () => {},
  onRemove = () => {},
}) {
  const { url, type, id, description } = attachment;
  const suffixType = type.split('/')[0];
  return (
    <div class="media-attachment">
      <div class="media-preview">
        {suffixType === 'image' ? (
          <img src={url} alt="" />
        ) : suffixType === 'video' || suffixType === 'gifv' ? (
          <video src={url} playsinline muted />
        ) : suffixType === 'audio' ? (
          <audio src={url} controls />
        ) : null}
      </div>
      {!!id ? (
        <div class="media-desc">
          <span class="tag">Uploaded</span>
          <p title={description}>{description || <i>No description</i>}</p>
        </div>
      ) : (
        <textarea
          value={description || ''}
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
          disabled={disabled}
          maxlength="1500" // Not unicode-aware :(
          // TODO: Un-hard-code this maxlength, ref: https://github.com/mastodon/mastodon/blob/b59fb28e90bc21d6fd1a6bafd13cfbd81ab5be54/app/models/media_attachment.rb#L39
          onInput={(e) => {
            const { value } = e.target;
            onDescriptionChange(value);
          }}
        ></textarea>
      )}
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
  );
}
