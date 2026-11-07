import '@justinribeiro/lite-youtube';

import { decodeBlurHash, getBlurHashAverageColor } from 'fast-blurhash';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { useSnapshot } from 'valtio';

import getDomain from '../utils/get-domain';
import isMastodonLinkMaybe from '../utils/isMastodonLinkMaybe';
import states from '../utils/states';
import unfurlMastodonLink, { unfurlCollectionLink } from '../utils/unfurl-link';

import Byline from './byline';
import Icon from './icon';
import RelativeTime from './relative-time';

// "Post": Quote post + card link preview combo
// Assume all links from these domains are "posts"
// Mastodon links are "posts" too but they are converted to real quote posts and there's too many domains to check
// This is just "Progressive Enhancement"
function isCardPost(domain) {
  return [
    'x.com',
    'twitter.com',
    'threads.net',
    'bsky.app',
    'bsky.brid.gy',
    'fed.brid.gy',
  ].includes(domain);
}

function StatusCard({ card, selfReferential, selfAuthor, instance }) {
  const snapStates = useSnapshot(states);
  const {
    blurhash,
    title,
    description,
    html,
    providerName,
    providerUrl,
    authorName,
    authorUrl,
    width,
    height,
    image,
    imageDescription,
    url,
    type,
    embedUrl,
    language,
    publishedAt,
    authors,
  } = card;

  /* type
  link = Link OEmbed
  photo = Photo OEmbed
  video = Video OEmbed
  rich = iframe OEmbed. Not currently accepted, so won't show up in practice.
  */

  const hasText = title || providerName || authorName;
  // Some cards have same title and description, don't need to repeat
  const descriptionTrimmed = description?.trim();
  const showDescription =
    !!descriptionTrimmed && descriptionTrimmed !== title?.trim();
  const metaFallback = providerName || authorName || null;
  const timestampPosition = !publishedAt
    ? null
    : showDescription || metaFallback
      ? 'top'
      : 'bottom';

  const blurhashOnly = !image && type === 'photo' && !!blurhash;
  const [blurhashImage, setBlurhashImage] = useState(null);
  const [cardStatusURL, setCardStatusURL] = useState(null);
  // const [cardStatusID, setCardStatusID] = useState(null);
  useEffect(() => {
    if (!hasText || !image || selfReferential || !isMastodonLinkMaybe(url)) {
      return;
    }

    const abortController = new AbortController();
    unfurlMastodonLink(instance, url, abortController.signal).then((result) => {
      if (!result) return;
      const { id, url } = result;
      setCardStatusURL('#' + url);

      // NOTE: This is for quote post
      // (async () => {
      //   const { masto } = api({ instance });
      //   const status = await masto.v1.statuses.$select(id).fetch();
      //   saveStatus(status, instance);
      //   setCardStatusID(id);
      // })();
    });
    unfurlCollectionLink(instance, url);

    return () => {
      abortController.abort();
    };
  }, [hasText, image, selfReferential]);

  useEffect(() => {
    if (!blurhashOnly) return;

    const w = 44;
    const h = 44;
    const blurhashPixels = decodeBlurHash(blurhash, w, h);
    const canvas = window.OffscreenCanvas
      ? new OffscreenCanvas(1, 1)
      : document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const imageData = ctx.createImageData(w, h);
    imageData.data.set(blurhashPixels);
    ctx.putImageData(imageData, 0, 0);
    try {
      if (window.OffscreenCanvas) {
        canvas.convertToBlob().then((blob) => {
          setBlurhashImage(URL.createObjectURL(blob));
        });
      } else {
        setBlurhashImage(canvas.toDataURL());
      }
    } catch (e) {
      // Silently fail
      console.error(e);
    }
  }, [blurhashOnly, blurhash]);

  // if (cardStatusID) {
  //   return (
  //     <Status statusID={cardStatusID} instance={instance} size="s" readOnly />
  //   );
  // }

  const hasIframeHTML = /<iframe/i.test(html || '');
  const handleClick = useCallback(
    (e) => {
      const unfurled = states.unfurledLinks[url];
      if (unfurled?.url) {
        e.preventDefault();
        e.stopPropagation();
        location.hash = '#' + unfurled.url;
        return;
      }
      if (hasIframeHTML) {
        e.preventDefault();
        states.showEmbedModal = {
          html,
          url: url || embedUrl,
          width,
          height,
        };
      }
    },
    [hasIframeHTML, url],
  );

  if (
    snapStates.unfurledLinks[url]?.url &&
    !snapStates.unfurledLinks[url].collections
  )
    // Hide card after unfurling a regular status;
    // keep it for account collections pages so it's clickable
    return null;

  // YouTube videos without an image keep their dedicated player instead of a link card
  const isYoutubeVideo =
    type === 'video' &&
    /youtube/i.test(providerName) &&
    /watch\?v=([^&]+)/.test(url);

  if (
    hasText &&
    (image || blurhashOnly || (type !== 'photo' && !isYoutubeVideo))
  ) {
    const domain = getDomain(url);
    const rgbAverageColor =
      image && blurhash ? getBlurHashAverageColor(blurhash) : null;
    const hasImage = !!image || blurhashOnly;

    const isPost = isCardPost(domain);

    return (
      <Byline authors={authors}>
        <a
          href={cardStatusURL || url}
          target={cardStatusURL ? null : '_blank'}
          rel="nofollow noopener"
          class={`card link ${isPost ? 'card-post' : ''} ${
            hasImage ? '' : 'no-image'
          } ${hasIframeHTML ? 'can-show-embed' : ''}`}
          style={{
            '--average-color':
              rgbAverageColor && `rgb(${rgbAverageColor.join(',')})`,
          }}
          onClick={handleClick}
        >
          <div class="card-content" lang={language}>
            <p class="meta domain">
              <span class="domain">
                <Icon icon="web" size="s" /> <span>{domain}</span>
              </span>
              {timestampPosition === 'top' && (
                <>
                  {' '}
                  &middot;{' '}
                  <RelativeTime datetime={publishedAt} format="micro" />
                </>
              )}
            </p>
            <p class="title" dir="auto" title={title}>
              {title}
            </p>
            {(showDescription ||
              metaFallback ||
              timestampPosition === 'bottom') && (
              <p class="meta" dir="auto" title={description || metaFallback}>
                {showDescription
                  ? description
                  : metaFallback || (
                      <RelativeTime datetime={publishedAt} format="micro" />
                    )}
              </p>
            )}
          </div>
          {hasImage && (
            <div class="card-image">
              <img
                src={image || blurhashImage}
                class={blurhashImage ? 'blurhash' : ''}
                width={width}
                height={height}
                loading="lazy"
                decoding="async"
                fetchPriority="low"
                alt={imageDescription || ''}
                onError={(e) => {
                  try {
                    e.target.style.display = 'none';
                  } catch (e) {}
                }}
                style={{
                  '--anim-duration':
                    width &&
                    height &&
                    `${Math.min(
                      Math.max(Math.max(width, height) / 100, 5),
                      120,
                    )}s`,
                }}
              />
            </div>
          )}
        </a>
      </Byline>
    );
  } else if (type === 'photo') {
    return (
      <a
        href={url}
        target="_blank"
        rel="nofollow noopener"
        class="card photo"
        onClick={handleClick}
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
  } else {
    if (type === 'video') {
      if (/youtube/i.test(providerName)) {
        // Get ID from e.g. https://www.youtube.com/watch?v=[VIDEO_ID]
        const videoID = url.match(/watch\?v=([^&]+)/)?.[1];
        if (videoID) {
          return (
            <a class="card video" onClick={handleClick}>
              <lite-youtube videoid={videoID} nocookie autoPause></lite-youtube>
            </a>
          );
        }
      }
      // return (
      //   <div
      //     class="card video"
      //     style={{
      //       aspectRatio: `${width}/${height}`,
      //     }}
      //     dangerouslySetInnerHTML={{ __html: html }}
      //   />
      // );
    }
  }
}

export default StatusCard;
