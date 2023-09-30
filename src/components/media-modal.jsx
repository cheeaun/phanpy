import { Menu } from '@szhsin/react-menu';
import { getBlurHashAverageColor } from 'fast-blurhash';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { useHotkeys } from 'react-hotkeys-hook';

import Icon from './icon';
import Link from './link';
import Media from './media';
import MediaAltModal from './media-alt-modal';
import MenuLink from './menu-link';
import Modal from './modal';

function MediaModal({
  mediaAttachments,
  statusID,
  instance,
  lang,
  index = 0,
  onClose = () => {},
}) {
  const carouselRef = useRef(null);

  const [currentIndex, setCurrentIndex] = useState(index);
  const carouselFocusItem = useRef(null);
  useLayoutEffect(() => {
    carouselFocusItem.current?.scrollIntoView();

    // history.pushState({ mediaModal: true }, '');
    // const handlePopState = (e) => {
    //   if (e.state?.mediaModal) {
    //     onClose();
    //   }
    // };
    // window.addEventListener('popstate', handlePopState);
    // return () => {
    //   window.removeEventListener('popstate', handlePopState);
    // };
  }, []);
  const prevStatusID = useRef(statusID);
  useEffect(() => {
    const scrollLeft = index * carouselRef.current.clientWidth;
    const differentStatusID = prevStatusID.current !== statusID;
    if (differentStatusID) prevStatusID.current = statusID;
    carouselRef.current.scrollTo({
      left: scrollLeft,
      behavior: differentStatusID ? 'auto' : 'smooth',
    });
    carouselRef.current.focus();
  }, [index, statusID]);

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

  useEffect(() => {
    let timer = setTimeout(() => {
      carouselRef.current?.focus?.();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div class="media-modal-container">
      <div
        ref={carouselRef}
        tabIndex="0"
        data-swipe-threshold="44"
        class="carousel"
        onClick={(e) => {
          if (
            e.target.classList.contains('carousel-item') ||
            e.target.classList.contains('media') ||
            e.target.classList.contains('media-zoom')
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
                  class="media-alt"
                  hidden={!showControls}
                  onClick={() => {
                    setShowMediaAlt({
                      alt: media.description,
                      lang,
                    });
                  }}
                >
                  <span class="alt-badge">ALT</span>
                  <span class="media-alt-desc" lang={lang} dir="auto">
                    {media.description}
                  </span>
                </button>
              )}
              <Media media={media} showOriginal lang={lang} />
            </div>
          );
        })}
      </div>
      <div class="carousel-top-controls" hidden={!showControls}>
        <span>
          <button
            type="button"
            class="carousel-button"
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
                class={`carousel-dot ${i === currentIndex ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  carouselRef.current.scrollTo({
                    left: carouselRef.current.clientWidth * i,
                    behavior: 'smooth',
                  });
                  carouselRef.current.focus();
                }}
              >
                <Icon icon="round" size="s" />
              </button>
            ))}
          </span>
        ) : (
          <span />
        )}
        <span>
          <Menu
            overflow="auto"
            align="end"
            position="anchor"
            boundingBoxPadding="8 8 8 8"
            gap={4}
            menuClassName="glass-menu"
            menuButton={
              <button type="button" class="carousel-button">
                <Icon icon="more" alt="More" />
              </button>
            }
          >
            <MenuLink
              href={
                mediaAttachments[currentIndex]?.remoteUrl ||
                mediaAttachments[currentIndex]?.url
              }
              class="carousel-button"
              target="_blank"
              title="Open original media in new window"
            >
              <Icon icon="popout" />
              <span>Open original media</span>
            </MenuLink>
          </Menu>{' '}
          <Link
            to={`${instance ? `/${instance}` : ''}/s/${statusID}${
              window.matchMedia('(min-width: calc(40em + 350px))').matches
                ? `?media=${currentIndex + 1}`
                : ''
            }`}
            class="button carousel-button media-post-link"
            // onClick={() => {
            //   // if small screen (not media query min-width 40em + 350px), run onClose
            //   if (
            //     !window.matchMedia('(min-width: calc(40em + 350px))').matches
            //   ) {
            //     onClose();
            //   }
            // }}
          >
            <span class="button-label">See post </span>&raquo;
          </Link>
        </span>
      </div>
      {mediaAttachments?.length > 1 && (
        <div class="carousel-controls" hidden={!showControls}>
          <button
            type="button"
            class="carousel-button"
            hidden={currentIndex === 0}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              carouselRef.current.focus();
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
            class="carousel-button"
            hidden={currentIndex === mediaAttachments.length - 1}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              carouselRef.current.focus();
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
              carouselRef.current.focus();
            }
          }}
        >
          <MediaAltModal
            alt={showMediaAlt.alt || showMediaAlt}
            lang={showMediaAlt?.lang}
            onClose={() => setShowMediaAlt(false)}
          />
        </Modal>
      )}
    </div>
  );
}

export default MediaModal;
