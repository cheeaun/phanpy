import { getBlurHashAverageColor } from 'fast-blurhash';
import { useRef } from 'preact/hooks';

import Icon from './icon';
import { formatDuration } from './status';

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
  const { original = {}, small, focus } = meta || {};

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
          onDblClick={() => {
            // Open original image in new tab
            window.open(url, '_blank');
          }}
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
                ${
                  isGIF
                    ? 'ondblclick="this.paused ? this.play() : this.pause()"'
                    : ''
                }
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
          <>
            <img
              src={previewUrl}
              alt={description}
              width={width}
              height={height}
              loading="lazy"
            />
            <div class="media-play">
              <Icon icon="play" size="xxl" />
            </div>
          </>
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

export default Media;
