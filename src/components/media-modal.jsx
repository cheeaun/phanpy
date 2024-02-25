import { MenuDivider, MenuItem } from '@szhsin/react-menu';
import { getBlurHashAverageColor } from 'fast-blurhash';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import { useHotkeys } from 'react-hotkeys-hook';

import { oklab2rgb, rgb2oklab } from '../utils/color-utils';
import showToast from '../utils/show-toast';
import states from '../utils/states';

import Icon from './icon';
import Link from './link';
import Media from './media';
import Menu2 from './menu2';
import MenuLink from './menu-link';

const { PHANPY_IMG_ALT_API_URL: IMG_ALT_API_URL } = import.meta.env;

function MediaModal({
  mediaAttachments,
  statusID,
  instance,
  lang,
  index = 0,
  onClose = () => {},
}) {
  const [uiState, setUIState] = useState('default');
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

  useHotkeys(
    'esc',
    onClose,
    {
      ignoreEventWhen: (e) => {
        const hasModal = !!document.querySelector('#modal-container > *');
        return hasModal;
      },
    },
    [onClose],
  );

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

  const mediaAccentColors = useMemo(() => {
    return mediaAttachments?.map((media) => {
      const { blurhash } = media;
      if (blurhash) {
        const averageColor = getBlurHashAverageColor(blurhash);
        const labAverageColor = rgb2oklab(averageColor);
        return oklab2rgb([0.6, labAverageColor[1], labAverageColor[2]]);
      }
      return null;
    });
  }, [mediaAttachments]);
  const mediaAccentGradient = useMemo(() => {
    const gap = 5;
    const range = 100 / mediaAccentColors.length;
    return (
      mediaAccentColors
        ?.map((color, i) => {
          const start = i * range + gap;
          const end = (i + 1) * range - gap;
          if (color) {
            return `
            rgba(${color?.join(',')}, 0.4) ${start}%,
            rgba(${color?.join(',')}, 0.4) ${end}%
          `;
          }

          return `
            transparent ${start}%,
            transparent ${end}%
          `;
        })
        ?.join(', ') || 'transparent'
    );
  }, [mediaAccentColors]);

  let toastRef = useRef(null);
  useEffect(() => {
    return () => {
      toastRef.current?.hideToast?.();
    };
  }, []);

  return (
    <div
      class={`media-modal-container media-modal-count-${mediaAttachments?.length}`}
    >
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
        style={
          mediaAttachments.length > 1
            ? {
                backgroundAttachment: 'local',
                backgroundImage: `linear-gradient(
            to right, ${mediaAccentGradient})`,
              }
            : {}
        }
      >
        {mediaAttachments?.map((media, i) => {
          const accentColor =
            mediaAttachments.length === 1 ? mediaAccentColors[i] : null;
          return (
            <div
              class="carousel-item"
              style={
                accentColor
                  ? {
                      '--accent-color': `rgb(${accentColor?.join(',')})`,
                      '--accent-alpha-color': `rgba(${accentColor?.join(
                        ',',
                      )}, 0.4)`,
                    }
                  : {}
              }
              tabindex="0"
              key={media.id}
              ref={i === currentIndex ? carouselFocusItem : null}
              onClick={(e) => {
                // console.log(e);
                // if (e.target !== e.currentTarget) {
                //   setShowControls(!showControls);
                // }
                if (!e.target.classList.contains('media')) {
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
                    states.showMediaAlt = {
                      alt: media.description,
                      lang,
                    };
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
          <Menu2
            overflow="auto"
            align="end"
            position="anchor"
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
            {import.meta.env.DEV && // Only dev for now
              !!states.settings.mediaAltGenerator &&
              !!IMG_ALT_API_URL &&
              !!mediaAttachments[currentIndex]?.url &&
              !mediaAttachments[currentIndex]?.description &&
              mediaAttachments[currentIndex]?.type === 'image' && (
                <>
                  <MenuDivider />
                  <MenuItem
                    disabled={uiState === 'loading'}
                    onClick={() => {
                      setUIState('loading');
                      toastRef.current = showToast({
                        text: 'Attempting to describe image. Please wait...',
                        duration: -1,
                      });
                      (async function () {
                        try {
                          const response = await fetch(
                            `${IMG_ALT_API_URL}?image=${encodeURIComponent(
                              mediaAttachments[currentIndex]?.url,
                            )}`,
                          ).then((r) => r.json());
                          states.showMediaAlt = {
                            alt: response.description,
                          };
                        } catch (e) {
                          console.error(e);
                          showToast('Failed to describe image');
                        } finally {
                          setUIState('default');
                          toastRef.current?.hideToast?.();
                        }
                      })();
                    }}
                  >
                    <Icon icon="sparkles2" />
                    <span>Describe image…</span>
                  </MenuItem>
                </>
              )}
          </Menu2>{' '}
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
            <span class="button-label">View post </span>&raquo;
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
    </div>
  );
}

export default MediaModal;
