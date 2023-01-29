import { getBlurHashAverageColor } from 'fast-blurhash';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { useHotkeys } from 'react-hotkeys-hook';
import { useMatch } from 'react-router-dom';

import Icon from './icon';
import Link from './link';
import Media from './media';
import Modal from './modal';

function MediaModal({
  mediaAttachments,
  statusID,
  index = 0,
  onClose = () => {},
}) {
  const carouselRef = useRef(null);
  const isStatusLocation = useMatch('/s/:id');

  const [currentIndex, setCurrentIndex] = useState(index);
  const carouselFocusItem = useRef(null);
  useLayoutEffect(() => {
    carouselFocusItem.current?.scrollIntoView();
  }, []);
  useEffect(() => {
    const scrollLeft = index * carouselRef.current.clientWidth;
    carouselRef.current.scrollTo({
      left: scrollLeft,
      behavior: 'smooth',
    });
  }, [index]);

  const [showControls, setShowControls] = useState(true);

  useEffect(() => {
    let handleSwipe = () => {
      onClose();
    };
    if (carouselRef.current) {
      carouselRef.current.addEventListener('swiped-down', handleSwipe);
    }
    return () => {
      if (carouselRef.current) {
        carouselRef.current.removeEventListener('swiped-down', handleSwipe);
      }
    };
  }, []);

  useHotkeys('esc', onClose, [onClose]);

  const [showMediaAlt, setShowMediaAlt] = useState(false);

  useEffect(() => {
    let handleScroll = () => {
      const { clientWidth, scrollLeft } = carouselRef.current;
      const index = Math.round(scrollLeft / clientWidth);
      setCurrentIndex(index);
    };
    if (carouselRef.current) {
      carouselRef.current.addEventListener('scroll', handleScroll, {
        passive: true,
      });
    }
    return () => {
      if (carouselRef.current) {
        carouselRef.current.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  return (
    <>
      <div
        ref={carouselRef}
        tabIndex="-1"
        data-swipe-threshold="44"
        class="carousel"
        onClick={(e) => {
          if (
            e.target.classList.contains('carousel-item') ||
            e.target.classList.contains('media')
          ) {
            onClose();
          }
        }}
      >
        {mediaAttachments?.map((media, i) => {
          const { blurhash } = media;
          const rgbAverageColor = blurhash
            ? getBlurHashAverageColor(blurhash)
            : null;
          return (
            <div
              class="carousel-item"
              style={{
                '--average-color': `rgb(${rgbAverageColor?.join(',')})`,
                '--average-color-alpha': `rgba(${rgbAverageColor?.join(
                  ',',
                )}, .5)`,
              }}
              tabindex="0"
              key={media.id}
              ref={i === currentIndex ? carouselFocusItem : null}
              onClick={(e) => {
                if (e.target !== e.currentTarget) {
                  setShowControls(!showControls);
                }
              }}
            >
              {!!media.description && (
                <button
                  type="button"
                  class="plain2 media-alt"
                  hidden={!showControls}
                  onClick={() => {
                    setShowMediaAlt(media.description);
                  }}
                >
                  <span class="tag">ALT</span>{' '}
                  <span class="media-alt-desc">{media.description}</span>
                </button>
              )}
              <Media media={media} showOriginal />
            </div>
          );
        })}
      </div>
      <div class="carousel-top-controls" hidden={!showControls}>
        <span>
          <button
            type="button"
            class="carousel-button plain3"
            onClick={() => onClose()}
          >
            <Icon icon="x" />
          </button>
        </span>
        {mediaAttachments?.length > 1 ? (
          <span class="carousel-dots">
            {mediaAttachments?.map((media, i) => (
              <button
                key={media.id}
                type="button"
                disabled={i === currentIndex}
                class={`plain carousel-dot ${
                  i === currentIndex ? 'active' : ''
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  carouselRef.current.scrollTo({
                    left: carouselRef.current.clientWidth * i,
                    behavior: 'smooth',
                  });
                }}
              >
                &bull;
              </button>
            ))}
          </span>
        ) : (
          <span />
        )}
        <span>
          {!isStatusLocation && (
            <Link
              to={`/s/${statusID}`}
              class="button carousel-button plain3"
              onClick={() => {
                // if small screen (not media query min-width 40em + 350px), run onClose
                if (
                  !window.matchMedia('(min-width: calc(40em + 350px))').matches
                ) {
                  onClose();
                }
              }}
            >
              See post &raquo;
            </Link>
          )}{' '}
          <a
            href={
              mediaAttachments[currentIndex]?.remoteUrl ||
              mediaAttachments[currentIndex]?.url
            }
            target="_blank"
            class="button carousel-button plain3"
            title="Open original media in new window"
          >
            <Icon icon="popout" alt="Open original media in new window" />
          </a>{' '}
        </span>
      </div>
      {mediaAttachments?.length > 1 && (
        <div class="carousel-controls" hidden={!showControls}>
          <button
            type="button"
            class="carousel-button plain3"
            hidden={currentIndex === 0}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              carouselRef.current.scrollTo({
                left: carouselRef.current.clientWidth * (currentIndex - 1),
                behavior: 'smooth',
              });
            }}
          >
            <Icon icon="arrow-left" />
          </button>
          <button
            type="button"
            class="carousel-button plain3"
            hidden={currentIndex === mediaAttachments.length - 1}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              carouselRef.current.scrollTo({
                left: carouselRef.current.clientWidth * (currentIndex + 1),
                behavior: 'smooth',
              });
            }}
          >
            <Icon icon="arrow-right" />
          </button>
        </div>
      )}
      {!!showMediaAlt && (
        <Modal
          class="light"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowMediaAlt(false);
            }
          }}
        >
          <div class="sheet">
            <header>
              <h2>Media description</h2>
            </header>
            <main>
              <p
                style={{
                  whiteSpace: 'pre-wrap',
                }}
              >
                {showMediaAlt}
              </p>
            </main>
          </div>
        </Modal>
      )}
      {!!showMediaAlt && (
        <Modal
          class="light"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowMediaAlt(false);
            }
          }}
        >
          <div class="sheet">
            <header>
              <h2>Media description</h2>
            </header>
            <main>
              <p
                style={{
                  whiteSpace: 'pre-wrap',
                }}
              >
                {showMediaAlt}
              </p>
            </main>
          </div>
        </Modal>
      )}
    </>
  );
}

export default MediaModal;
