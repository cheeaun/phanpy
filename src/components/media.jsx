import { getBlurHashAverageColor } from 'fast-blurhash';
import { Fragment } from 'preact';
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import QuickPinchZoom, { make3dTransformValue } from 'react-quick-pinch-zoom';

import mem from '../utils/mem';
import states from '../utils/states';

import Icon from './icon';
import Link from './link';
import { formatDuration } from './status';

const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent); // https://stackoverflow.com/a/23522755

/*
Media type
===
unknown = unsupported or unrecognized file type
image = Static image
gifv = Looping, soundless animation
video = Video clip
audio = Audio track
*/

const dataAltLabel = 'ALT';
const AltBadge = (props) => {
  const { alt, lang, index, ...rest } = props;
  if (!alt || !alt.trim()) return null;
  return (
    <button
      type="button"
      class="alt-badge clickable"
      {...rest}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        states.showMediaAlt = {
          alt,
          lang,
        };
      }}
      title="Media description"
    >
      {dataAltLabel}
      {!!index && <sup>{index}</sup>}
    </button>
  );
};

const MEDIA_CAPTION_LIMIT = 140;
export const isMediaCaptionLong = mem((caption) =>
  caption?.length
    ? caption.length > MEDIA_CAPTION_LIMIT ||
      /[\n\r].*[\n\r]/.test(caption.trim())
    : false,
);

function Media({
  class: className = '',
  media,
  to,
  lang,
  showOriginal,
  autoAnimate,
  showCaption,
  altIndex,
  onClick = () => {},
}) {
  const {
    blurhash,
    description,
    meta,
    previewRemoteUrl,
    previewUrl,
    remoteUrl,
    url,
    type,
  } = media;
  const { original = {}, small, focus } = meta || {};

  const width = showOriginal ? original?.width : small?.width;
  const height = showOriginal ? original?.height : small?.height;
  const mediaURL = showOriginal ? url : previewUrl || url;
  const remoteMediaURL = showOriginal
    ? remoteUrl
    : previewRemoteUrl || remoteUrl;
  const orientation = width >= height ? 'landscape' : 'portrait';

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

  const mediaRef = useRef();
  const onUpdate = useCallback(({ x, y, scale }) => {
    const { current: media } = mediaRef;

    if (media) {
      const value = make3dTransformValue({ x, y, scale });

      if (scale === 1) {
        media.style.removeProperty('transform');
      } else {
        media.style.setProperty('transform', value);
      }

      media.closest('.media-zoom').style.touchAction =
        scale <= 1.01 ? 'pan-x' : '';
    }
  }, []);

  const [pinchZoomEnabled, setPinchZoomEnabled] = useState(false);
  const quickPinchZoomProps = {
    enabled: pinchZoomEnabled,
    draggableUnZoomed: false,
    inertiaFriction: 0.9,
    doubleTapZoomOutOnMaxScale: true,
    containerProps: {
      className: 'media-zoom',
      style: {
        overflow: 'visible',
        //   width: 'inherit',
        //   height: 'inherit',
        //   justifyContent: 'inherit',
        //   alignItems: 'inherit',
        //   display: 'inherit',
      },
    },
    onUpdate,
  };

  const Parent = useMemo(
    () => (to ? (props) => <Link to={to} {...props} /> : 'div'),
    [to],
  );

  const isVideoMaybe =
    type === 'unknown' &&
    /\.(mp4|m4a|m4p|m4b|m4r|m4v|mov|webm)$/i.test(remoteMediaURL);
  const isImage =
    type === 'image' || (type === 'unknown' && previewUrl && !isVideoMaybe);

  const parentRef = useRef();
  const [imageSmallerThanParent, setImageSmallerThanParent] = useState(false);
  useLayoutEffect(() => {
    if (!isImage) return;
    if (!showOriginal) return;
    if (!parentRef.current) return;
    const { offsetWidth, offsetHeight } = parentRef.current;
    const smaller = width < offsetWidth && height < offsetHeight;
    if (smaller) setImageSmallerThanParent(smaller);
  }, [width, height]);

  const maxAspectHeight =
    window.innerHeight * (orientation === 'portrait' ? 0.45 : 0.33);
  const maxHeight = orientation === 'portrait' ? 0 : 160;
  const averageColorStyle = {
    '--average-color': rgbAverageColor && `rgb(${rgbAverageColor.join(',')})`,
  };
  const mediaStyles =
    width && height
      ? {
          '--width': `${width}px`,
          '--height': `${height}px`,
          // Calculate '--aspectWidth' based on aspect ratio calculated from '--width' and '--height', max height has to be 160px
          '--aspectWidth': `${
            (width / height) * Math.max(maxHeight, maxAspectHeight)
          }px`,
          aspectRatio: `${width} / ${height}`,
          ...averageColorStyle,
        }
      : {
          ...averageColorStyle,
        };

  const longDesc = isMediaCaptionLong(description);
  const showInlineDesc =
    !!showCaption && !showOriginal && !!description && !longDesc;
  const Figure = !showInlineDesc
    ? Fragment
    : (props) => {
        const { children, ...restProps } = props;
        return (
          <figure {...restProps}>
            {children}
            <figcaption
              class="media-caption"
              lang={lang}
              dir="auto"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                states.showMediaAlt = {
                  alt: description,
                  lang,
                };
              }}
            >
              {description}
            </figcaption>
          </figure>
        );
      };

  if (isImage) {
    // Note: type: unknown might not have width/height
    quickPinchZoomProps.containerProps.style.display = 'inherit';

    useLayoutEffect(() => {
      if (!isSafari) return;
      if (!showOriginal) return;
      (async () => {
        try {
          await fetch(mediaURL, { mode: 'no-cors' });
          mediaRef.current.src = mediaURL;
        } catch (e) {
          // Ignore
        }
      })();
    }, [mediaURL]);

    return (
      <Figure>
        <Parent
          ref={parentRef}
          class={`media media-image ${className}`}
          onClick={onClick}
          data-orientation={orientation}
          data-has-alt={!showInlineDesc}
          style={
            showOriginal
              ? {
                  backgroundImage: `url(${previewUrl})`,
                  backgroundSize: imageSmallerThanParent
                    ? `${width}px ${height}px`
                    : undefined,
                  ...averageColorStyle,
                }
              : mediaStyles
          }
        >
          {showOriginal ? (
            <QuickPinchZoom {...quickPinchZoomProps}>
              <img
                ref={mediaRef}
                src={mediaURL}
                alt={description}
                width={width}
                height={height}
                data-orientation={orientation}
                loading="eager"
                decoding="sync"
                onLoad={(e) => {
                  e.target.closest('.media-image').style.backgroundImage = '';
                  e.target.closest('.media-zoom').style.display = '';
                  setPinchZoomEnabled(true);
                }}
                onError={(e) => {
                  const { src } = e.target;
                  if (src === mediaURL) {
                    e.target.src = remoteMediaURL;
                  }
                }}
              />
            </QuickPinchZoom>
          ) : (
            <>
              <img
                src={mediaURL}
                alt={showInlineDesc ? '' : description}
                width={width}
                height={height}
                data-orientation={orientation}
                loading="lazy"
                style={{
                  backgroundColor:
                    rgbAverageColor && `rgb(${rgbAverageColor.join(',')})`,
                  backgroundPosition: focalBackgroundPosition || 'center',
                  // Duration based on width or height in pixels
                  // 100px per second (rough estimate)
                  // Clamp between 5s and 120s
                  '--anim-duration': `${Math.min(
                    Math.max(Math.max(width, height) / 100, 5),
                    120,
                  )}s`,
                }}
                onLoad={(e) => {
                  e.target.closest('.media-image').style.backgroundImage = '';
                  e.target.dataset.loaded = true;
                }}
                onError={(e) => {
                  const { src } = e.target;
                  if (src === mediaURL) {
                    e.target.src = remoteMediaURL;
                  }
                }}
              />
              {!showInlineDesc && (
                <AltBadge alt={description} lang={lang} index={altIndex} />
              )}
            </>
          )}
        </Parent>
      </Figure>
    );
  } else if (type === 'gifv' || type === 'video' || isVideoMaybe) {
    const shortDuration = original.duration < 31;
    const isGIF = type === 'gifv' && shortDuration;
    // If GIF is too long, treat it as a video
    const loopable = original.duration < 61;
    const formattedDuration = formatDuration(original.duration);
    const hoverAnimate = !showOriginal && !autoAnimate && isGIF;
    const autoGIFAnimate = !showOriginal && autoAnimate && isGIF;
    const showProgress = original.duration > 5;

    const videoHTML = `
    <video
      src="${url}"
      poster="${previewUrl}"
      width="${width}"
      height="${height}"
      data-orientation="${orientation}"
      preload="auto"
      autoplay
      muted="${isGIF}"
      ${isGIF ? '' : 'controls'}
      playsinline
      loop="${loopable}"
      ${isGIF ? 'ondblclick="this.paused ? this.play() : this.pause()"' : ''}
      ${
        isGIF && showProgress
          ? "ontimeupdate=\"this.closest('.media-gif') && this.closest('.media-gif').style.setProperty('--progress', `${~~((this.currentTime / this.duration) * 100)}%`)\""
          : ''
      }
    ></video>
  `;

    return (
      <Figure>
        <Parent
          class={`media ${className} media-${isGIF ? 'gif' : 'video'} ${
            autoGIFAnimate ? 'media-contain' : ''
          }`}
          data-orientation={orientation}
          data-formatted-duration={
            !showOriginal ? formattedDuration : undefined
          }
          data-label={isGIF && !showOriginal && !autoGIFAnimate ? 'GIF' : ''}
          data-has-alt={!showInlineDesc}
          // style={{
          //   backgroundColor:
          //     rgbAverageColor && `rgb(${rgbAverageColor.join(',')})`,
          // }}
          style={!showOriginal && mediaStyles}
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
          onFocus={() => {
            if (hoverAnimate) {
              try {
                videoRef.current.play();
              } catch (e) {}
            }
          }}
          onBlur={() => {
            if (hoverAnimate) {
              try {
                videoRef.current.pause();
              } catch (e) {}
            }
          }}
        >
          {showOriginal || autoGIFAnimate ? (
            isGIF && showOriginal ? (
              <QuickPinchZoom {...quickPinchZoomProps} enabled>
                <div
                  ref={mediaRef}
                  dangerouslySetInnerHTML={{
                    __html: videoHTML,
                  }}
                />
              </QuickPinchZoom>
            ) : (
              <div
                class="video-container"
                dangerouslySetInnerHTML={{
                  __html: videoHTML,
                }}
              />
            )
          ) : isGIF ? (
            <video
              ref={videoRef}
              src={url}
              poster={previewUrl}
              width={width}
              height={height}
              data-orientation={orientation}
              preload="auto"
              // controls
              playsinline
              loop
              muted
              onTimeUpdate={
                showProgress
                  ? (e) => {
                      const { target } = e;
                      const container = target?.closest('.media-gif');
                      if (container) {
                        const percentage =
                          (target.currentTime / target.duration) * 100;
                        container.style.setProperty(
                          '--progress',
                          `${percentage}%`,
                        );
                      }
                    }
                  : undefined
              }
            />
          ) : (
            <>
              <img
                src={previewUrl}
                alt={showInlineDesc ? '' : description}
                width={width}
                height={height}
                data-orientation={orientation}
                loading="lazy"
              />
              <div class="media-play">
                <Icon icon="play" size="xl" />
              </div>
            </>
          )}
          {!showOriginal && !showInlineDesc && (
            <AltBadge alt={description} lang={lang} index={altIndex} />
          )}
        </Parent>
      </Figure>
    );
  } else if (type === 'audio') {
    const formattedDuration = formatDuration(original.duration);
    return (
      <Figure>
        <Parent
          class={`media media-audio ${className}`}
          data-formatted-duration={
            !showOriginal ? formattedDuration : undefined
          }
          data-has-alt={!showInlineDesc}
          onClick={onClick}
          style={!showOriginal && mediaStyles}
        >
          {showOriginal ? (
            <audio src={remoteUrl || url} preload="none" controls autoplay />
          ) : previewUrl ? (
            <img
              src={previewUrl}
              alt={showInlineDesc ? '' : description}
              width={width}
              height={height}
              data-orientation={orientation}
              loading="lazy"
            />
          ) : null}
          {!showOriginal && (
            <>
              <div class="media-play">
                <Icon icon="play" size="xl" />
              </div>
              {!showInlineDesc && (
                <AltBadge alt={description} lang={lang} index={altIndex} />
              )}
            </>
          )}
        </Parent>
      </Figure>
    );
  }
}

export default Media;
