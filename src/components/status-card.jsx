import '@justinribeiro/lite-youtube';

import { decodeBlurHash, getBlurHashAverageColor } from 'fast-blurhash';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { useSnapshot } from 'valtio';

import getDomain from '../utils/get-domain';
import isMastodonLinkMaybe from '../utils/isMastodonLinkMaybe';
import states from '../utils/states';
import unfurlMastodonLink from '../utils/unfurl-link';

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
  const isLandscape = width / height >= 1.2;
  const size = isLandscape ? 'large' : '';

  const [cardStatusURL, setCardStatusURL] = useState(null);
  // const [cardStatusID, setCardStatusID] = useState(null);
  useEffect(() => {
    if (hasText && image && !selfReferential && isMastodonLinkMaybe(url)) {
      unfurlMastodonLink(instance, url).then((result) => {
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
    }
  }, [hasText, image, selfReferential]);

  // if (cardStatusID) {
  //   return (
  //     <Status statusID={cardStatusID} instance={instance} size="s" readOnly />
  //   );
  // }

  if (snapStates.unfurledLinks[url]) return null;

  const hasIframeHTML = /<iframe/i.test(html);
  const handleClick = useCallback(
    (e) => {
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
    [hasIframeHTML],
  );

  const [blurhashImage, setBlurhashImage] = useState(null);
  if (hasText && (image || (type === 'photo' && blurhash))) {
    const domain = getDomain(url);
    const rgbAverageColor =
      image && blurhash ? getBlurHashAverageColor(blurhash) : null;
    if (!image) {
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
    }

    const isPost = isCardPost(domain);

    return (
      <Byline hidden={!!selfAuthor} authors={authors}>
        <a
          href={cardStatusURL || url}
          target={cardStatusURL ? null : '_blank'}
          rel="nofollow noopener"
          class={`card link ${isPost ? 'card-post' : ''} ${
            blurhashImage ? '' : size
          }`}
          style={{
            '--average-color':
              rgbAverageColor && `rgb(${rgbAverageColor.join(',')})`,
          }}
          onClick={handleClick}
        >
          <div class="card-image">
            <img
              src={image || blurhashImage}
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
          <div class="meta-container" lang={language}>
            <p class="meta domain">
              <span class="domain">{domain}</span>{' '}
              {!!publishedAt && <>&middot; </>}
              {!!publishedAt && (
                <>
                  <RelativeTime datetime={publishedAt} format="micro" />
                </>
              )}
            </p>
            <p class="title" dir="auto" title={title}>
              {title}
            </p>
            <p class="meta" dir="auto" title={description}>
              {description ||
                (!!publishedAt && (
                  <RelativeTime datetime={publishedAt} format="micro" />
                ))}
            </p>
          </div>
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
    if (hasText && !image) {
      const domain = getDomain(url);
      const isPost = isCardPost(domain);
      return (
        <a
          href={cardStatusURL || url}
          target={cardStatusURL ? null : '_blank'}
          rel="nofollow noopener"
          class={`card link ${isPost ? 'card-post' : ''} no-image`}
          lang={language}
          dir="auto"
          onClick={handleClick}
        >
          <div class="meta-container">
            <p class="meta domain">
              <span class="domain">
                <Icon icon="link" size="s" /> <span>{domain}</span>
              </span>{' '}
              {!!publishedAt && <>&middot; </>}
              {!!publishedAt && (
                <>
                  <RelativeTime datetime={publishedAt} format="micro" />
                </>
              )}
            </p>
            <p class="title" title={title}>
              {title}
            </p>
            <p class="meta" title={description || providerName || authorName}>
              {description || providerName || authorName}
            </p>
          </div>
        </a>
      );
    }
  }
}

export default StatusCard;
