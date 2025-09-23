import { useEffect, useRef, useState } from 'preact/hooks';

import isRTL from '../utils/is-rtl';

import Icon from './icon';
import Media from './media';

function MediaFirstContainer(props) {
  const { mediaAttachments, language, postID, instance } = props;
  const moreThanOne = mediaAttachments.length > 1;

  const carouselRef = useRef();
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    let handleScroll = () => {
      const { clientWidth, scrollLeft } = carouselRef.current;
      const index = Math.round(Math.abs(scrollLeft) / clientWidth);
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
      <div class="media-first-container">
        <div class="media-first-carousel" ref={carouselRef}>
          {mediaAttachments.map((media, i) => (
            <div class="media-first-item" key={media.id}>
              <Media
                media={media}
                lang={language}
                to={`/${instance}/s/${postID}?media=${i + 1}`}
              />
            </div>
          ))}
        </div>
        {moreThanOne && (
          <div class="media-carousel-controls">
            <div class="carousel-indexer">
              {currentIndex + 1}/{mediaAttachments.length}
            </div>
            <label class="media-carousel-button">
              <button
                type="button"
                class="carousel-button"
                hidden={currentIndex === 0}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  carouselRef.current.focus();
                  carouselRef.current.scrollTo({
                    left:
                      carouselRef.current.clientWidth *
                      (currentIndex - 1) *
                      (isRTL() ? -1 : 1),
                    behavior: 'smooth',
                  });
                }}
              >
                <Icon icon="arrow-left" />
              </button>
            </label>
            <label class="media-carousel-button">
              <button
                type="button"
                class="carousel-button"
                hidden={currentIndex === mediaAttachments.length - 1}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  carouselRef.current.focus();
                  carouselRef.current.scrollTo({
                    left:
                      carouselRef.current.clientWidth *
                      (currentIndex + 1) *
                      (isRTL() ? -1 : 1),
                    behavior: 'smooth',
                  });
                }}
              >
                <Icon icon="arrow-right" />
              </button>
            </label>
          </div>
        )}
      </div>
      {moreThanOne && (
        <div
          class="media-carousel-dots"
          style={{
            '--dots-count': mediaAttachments.length,
          }}
        >
          {mediaAttachments.map((media, i) => (
            <span
              key={media.id}
              class={`carousel-dot ${i === currentIndex ? 'active' : ''}`}
            />
          ))}
        </div>
      )}
    </>
  );
}

export default MediaFirstContainer;
