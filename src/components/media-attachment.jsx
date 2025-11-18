import { Trans, useLingui } from '@lingui/react/macro';
import { MenuItem } from '@szhsin/react-menu';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useDebouncedCallback } from 'use-debounce';

import localeCode2Text from '../utils/localeCode2Text';
import prettyBytes from '../utils/pretty-bytes';
import showToast from '../utils/show-toast';
import states from '../utils/states';
import { getCurrentInstanceConfiguration } from '../utils/store-utils';
import supports from '../utils/supports';

import Icon from './icon';
import Menu2 from './menu2';
import Modal from './modal';

const { PHANPY_IMG_ALT_API_URL: IMG_ALT_API_URL } = import.meta.env;

function scaleDimension(matrix, matrixLimit, width, height) {
  // matrix = number of pixels
  // matrixLimit = max number of pixels
  // Calculate new width and height, downsize to within the limit, preserve aspect ratio, no decimals
  const scalingFactor = Math.sqrt(matrixLimit / matrix);
  const newWidth = Math.floor(width * scalingFactor);
  const newHeight = Math.floor(height * scalingFactor);
  return { newWidth, newHeight };
}

function MediaAttachment({
  attachment,
  disabled,
  lang,
  supportedMimeTypes,
  descriptionLimit = 1500,
  onDescriptionChange = () => {},
  onRemove = () => {},
}) {
  const { i18n, t } = useLingui();
  const [uiState, setUIState] = useState('default');
  const supportsEdit =
    supports('@mastodon') || supports('@gotosocial/edit-media-attributes');
  const { type, id, file } = attachment;
  const url = useMemo(
    () => (file ? URL.createObjectURL(file) : attachment.url),
    [file, attachment.url],
  );
  console.log({ attachment });

  const checkMaxError = !!file?.size;
  const configuration = checkMaxError ? getCurrentInstanceConfiguration() : {};
  const {
    mediaAttachments: {
      imageSizeLimit,
      imageMatrixLimit,
      videoSizeLimit,
      videoMatrixLimit,
      videoFrameRateLimit,
    } = {},
  } = configuration || {};

  const [maxError, setMaxError] = useState(() => {
    if (!checkMaxError) return null;
    if (
      type.startsWith('image') &&
      imageSizeLimit &&
      file.size > imageSizeLimit
    ) {
      return {
        type: 'imageSizeLimit',
        details: {
          imageSize: file.size,
          imageSizeLimit,
        },
      };
    } else if (
      type.startsWith('video') &&
      videoSizeLimit &&
      file.size > videoSizeLimit
    ) {
      return {
        type: 'videoSizeLimit',
        details: {
          videoSize: file.size,
          videoSizeLimit,
        },
      };
    }
    return null;
  });

  const [imageMatrix, setImageMatrix] = useState({});
  useEffect(() => {
    if (!checkMaxError || !imageMatrixLimit) return;
    if (imageMatrix?.matrix > imageMatrixLimit) {
      setMaxError({
        type: 'imageMatrixLimit',
        details: {
          imageMatrix: imageMatrix?.matrix,
          imageMatrixLimit,
          width: imageMatrix?.width,
          height: imageMatrix?.height,
        },
      });
    }
  }, [imageMatrix, imageMatrixLimit, checkMaxError]);

  const [videoMatrix, setVideoMatrix] = useState({});
  useEffect(() => {
    if (!checkMaxError || !videoMatrixLimit) return;
    if (videoMatrix?.matrix > videoMatrixLimit) {
      setMaxError({
        type: 'videoMatrixLimit',
        details: {
          videoMatrix: videoMatrix?.matrix,
          videoMatrixLimit,
          width: videoMatrix?.width,
          height: videoMatrix?.height,
        },
      });
    }
  }, [videoMatrix, videoMatrixLimit, checkMaxError]);

  const [description, setDescription] = useState(attachment.description);

  let [suffixType, subtype] = type.split('/');
  // If type is not supported, try to find a supported type with the same subtype
  // E.g. application/ogg -> audio/ogg
  const suffixTypes = new Set();
  const subTypeMap = {};
  if (supportedMimeTypes?.length) {
    supportedMimeTypes.forEach((mimeType) => {
      const [t, st] = mimeType.split('/');
      subTypeMap[st] = t;
      suffixTypes.add(t);
    });
  }
  if (!suffixTypes.has(suffixType)) {
    suffixType = subTypeMap[subtype];
  }

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
          <span class="tag">
            <Trans>Uploaded</Trans>
          </span>
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
              image: t`Image description`,
              video: t`Video description`,
              audio: t`Audio description`,
            }[suffixType]
          }
          autoCapitalize="sentences"
          autoComplete="on"
          autoCorrect="on"
          spellCheck="true"
          dir="auto"
          disabled={disabled || uiState === 'loading'}
          class={uiState === 'loading' ? 'loading' : ''}
          maxlength={descriptionLimit} // Not unicode-aware :(
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

  const maxErrorToast = useRef(null);

  const maxErrorText = (err) => {
    const { type, details } = err;
    switch (type) {
      case 'imageSizeLimit': {
        const { imageSize, imageSizeLimit } = details;
        return t`File size too large. Uploading might encounter issues. Try reduce the file size from ${prettyBytes(
          imageSize,
        )} to ${prettyBytes(imageSizeLimit)} or lower.`;
      }
      case 'imageMatrixLimit': {
        const { imageMatrix, imageMatrixLimit, width, height } = details;
        const { newWidth, newHeight } = scaleDimension(
          imageMatrix,
          imageMatrixLimit,
          width,
          height,
        );
        return t`Dimension too large. Uploading might encounter issues. Try reduce dimension from ${i18n.number(
          width,
        )}×${i18n.number(height)}px to ${i18n.number(newWidth)}×${i18n.number(
          newHeight,
        )}px.`;
      }
      case 'videoSizeLimit': {
        const { videoSize, videoSizeLimit } = details;
        return t`File size too large. Uploading might encounter issues. Try reduce the file size from ${prettyBytes(
          videoSize,
        )} to ${prettyBytes(videoSizeLimit)} or lower.`;
      }
      case 'videoMatrixLimit': {
        const { videoMatrix, videoMatrixLimit, width, height } = details;
        const { newWidth, newHeight } = scaleDimension(
          videoMatrix,
          videoMatrixLimit,
          width,
          height,
        );
        return t`Dimension too large. Uploading might encounter issues. Try reduce dimension from ${i18n.number(
          width,
        )}×${i18n.number(height)}px to ${i18n.number(newWidth)}×${i18n.number(
          newHeight,
        )}px.`;
      }
      case 'videoFrameRateLimit': {
        // Not possible to detect this on client-side for now
        return t`Frame rate too high. Uploading might encounter issues.`;
      }
    }
  };

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
            <img
              src={url}
              alt=""
              onLoad={(e) => {
                if (!checkMaxError) return;
                const { naturalWidth, naturalHeight } = e.target;
                setImageMatrix({
                  matrix: naturalWidth * naturalHeight,
                  width: naturalWidth,
                  height: naturalHeight,
                });
              }}
            />
          ) : suffixType === 'video' || suffixType === 'gifv' ? (
            <video
              src={url + '#t=0.1'} // Make Safari show 1st-frame preview
              playsinline
              muted
              disablePictureInPicture
              preload="metadata"
              onLoadedMetadata={(e) => {
                if (!checkMaxError) return;
                const { videoWidth, videoHeight } = e.target;
                if (videoWidth && videoHeight) {
                  setVideoMatrix({
                    matrix: videoWidth * videoHeight,
                    width: videoWidth,
                    height: videoHeight,
                  });
                }
              }}
            />
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
            <Icon icon="x" alt={t`Remove`} />
          </button>
          {!!maxError && (
            <button
              type="button"
              class="media-error"
              title={maxErrorText(maxError)}
              onClick={() => {
                if (maxErrorToast.current) {
                  maxErrorToast.current.hideToast();
                }
                maxErrorToast.current = showToast({
                  text: maxErrorText(maxError),
                  duration: 10_000,
                });
              }}
            >
              <Icon icon="alert" alt={t`Error`} />
            </button>
          )}
        </div>
      </div>
      {showModal && (
        <Modal
          onClose={() => {
            setShowModal(false);
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
              <Icon icon="x" alt={t`Close`} />
            </button>
            <header>
              <h2>
                {
                  {
                    image: t`Edit image description`,
                    video: t`Edit video description`,
                    audio: t`Edit audio description`,
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
                          <button type="button" class="plain">
                            <Icon icon="more" size="l" alt={t`More`} />
                          </button>
                        }
                      >
                        <MenuItem
                          disabled={uiState === 'loading'}
                          onClick={() => {
                            setUIState('loading');
                            toastRef.current = showToast({
                              text: t`Generating description. Please wait…`,
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
                                  e.message
                                    ? t`Failed to generate description: ${e.message}`
                                    : t`Failed to generate description`,
                                );
                              } finally {
                                setUIState('default');
                                toastRef.current?.hideToast?.();
                              }
                            })();
                          }}
                        >
                          <Icon icon="sparkles2" />
                          {lang && lang !== 'en' ? (
                            <small>
                              <Trans>Generate description…</Trans>
                              <br />
                              (English)
                            </small>
                          ) : (
                            <span>
                              <Trans>Generate description…</Trans>
                            </span>
                          )}
                        </MenuItem>
                        {!!lang && lang !== 'en' && (
                          <MenuItem
                            disabled={uiState === 'loading'}
                            onClick={() => {
                              setUIState('loading');
                              toastRef.current = showToast({
                                text: t`Generating description. Please wait…`,
                                duration: -1,
                              });
                              // POST with multipart
                              (async function () {
                                try {
                                  const body = new FormData();
                                  body.append('image', file);
                                  const params = `?lang=${lang}`;
                                  const response = await fetch(
                                    IMG_ALT_API_URL + params,
                                    {
                                      method: 'POST',
                                      body,
                                    },
                                  ).then((r) => r.json());
                                  if (response.error) {
                                    throw new Error(response.error);
                                  }
                                  setDescription(response.description);
                                } catch (e) {
                                  console.error(e);
                                  showToast(
                                    t`Failed to generate description${
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
                            <small>
                              <Trans>Generate description…</Trans>
                              <br />
                              <Trans>
                                ({localeCode2Text(lang)}){' '}
                                <span class="more-insignificant">
                                  — experimental
                                </span>
                              </Trans>
                            </small>
                          </MenuItem>
                        )}
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
                    <Trans>Done</Trans>
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

export default MediaAttachment;
