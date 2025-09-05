import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useDebouncedCallback } from 'use-debounce';

import poweredByGiphyURL from '../assets/powered-by-giphy.svg';

import Icon from './icon';
import Loader from './loader';

const { PHANPY_GIPHY_API_KEY: GIPHY_API_KEY } = import.meta.env;

const GIFS_PER_PAGE = 20;

function GIFPickerModal({ onClose = () => {}, onSelect = () => {} }) {
  const { i18n, t } = useLingui();
  const [uiState, setUIState] = useState('default');
  const [results, setResults] = useState([]);
  const formRef = useRef(null);
  const qRef = useRef(null);
  const currentOffset = useRef(0);
  const scrollableRef = useRef(null);

  function fetchGIFs({ offset }) {
    console.log('fetchGIFs', { offset });
    if (!qRef.current?.value) return;
    setUIState('loading');
    scrollableRef.current?.scrollTo?.({
      top: 0,
      left: 0,
      behavior: 'smooth',
    });
    (async () => {
      try {
        const query = {
          api_key: GIPHY_API_KEY,
          q: qRef.current.value,
          rating: 'g',
          limit: GIFS_PER_PAGE,
          bundle: 'messaging_non_clips',
          offset,
          lang: i18n.locale || 'en',
        };
        const response = await fetch(
          'https://api.giphy.com/v1/gifs/search?' + new URLSearchParams(query),
          {
            referrerPolicy: 'no-referrer',
          },
        ).then((r) => r.json());
        currentOffset.current = response.pagination?.offset || 0;
        setResults(response);
        setUIState('results');
      } catch (e) {
        setUIState('error');
        console.error(e);
      }
    })();
  }

  useEffect(() => {
    qRef.current?.focus();
  }, []);

  const debouncedOnInput = useDebouncedCallback(() => {
    fetchGIFs({ offset: 0 });
  }, 1000);

  return (
    <div id="gif-picker-sheet" class="sheet">
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" alt={t`Close`} />
        </button>
      )}
      <header>
        <form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            fetchGIFs({ offset: 0 });
          }}
        >
          <input
            ref={qRef}
            type="search"
            name="q"
            placeholder={t`Search GIFs`}
            required
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellCheck="false"
            dir="auto"
            onInput={debouncedOnInput}
          />
          <input
            type="image"
            class="powered-button"
            src={poweredByGiphyURL}
            width="86"
            height="30"
            alt={t`Powered by GIPHY`}
          />
        </form>
      </header>
      <main ref={scrollableRef} class={uiState === 'loading' ? 'loading' : ''}>
        {uiState === 'default' && (
          <div class="ui-state">
            <p class="insignificant">
              <Trans>Type to search GIFs</Trans>
            </p>
          </div>
        )}
        {uiState === 'loading' && !results?.data?.length && (
          <div class="ui-state">
            <Loader abrupt />
          </div>
        )}
        {results?.data?.length > 0 ? (
          <>
            <ul>
              {results.data.map((gif) => {
                const { id, images, title, alt_text } = gif;
                const {
                  fixed_height_small,
                  fixed_height_downsampled,
                  fixed_height,
                  original,
                } = images;
                const theImage = fixed_height_small?.url
                  ? fixed_height_small
                  : fixed_height_downsampled?.url
                    ? fixed_height_downsampled
                    : fixed_height;
                let { url, webp, width, height } = theImage;
                if (+height > 100) {
                  width = (width / height) * 100;
                  height = 100;
                }
                const urlObj = URL.parse(url);
                const strippedURL = urlObj.origin + urlObj.pathname;
                let strippedWebP;
                if (webp) {
                  const webpObj = URL.parse(webp);
                  strippedWebP = webpObj.origin + webpObj.pathname;
                }
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => {
                        const { mp4, url } = original;
                        const theURL = mp4 || url;
                        const urlObj = URL.parse(theURL);
                        const strippedURL = urlObj.origin + urlObj.pathname;
                        onClose();
                        onSelect({
                          url: strippedURL,
                          type: mp4 ? 'video/mp4' : 'image/gif',
                          alt_text: alt_text || title,
                        });
                      }}
                    >
                      <figure
                        style={{
                          '--figure-width': width + 'px',
                          // width: width + 'px'
                        }}
                      >
                        <picture>
                          {strippedWebP && (
                            <source srcset={strippedWebP} type="image/webp" />
                          )}
                          <img
                            src={strippedURL}
                            width={width}
                            height={height}
                            loading="lazy"
                            decoding="async"
                            alt={alt_text}
                            referrerpolicy="no-referrer"
                            onLoad={(e) => {
                              e.target.style.backgroundColor = 'transparent';
                            }}
                          />
                        </picture>
                        <figcaption>{alt_text || title}</figcaption>
                      </figure>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p class="pagination">
              {results.pagination?.offset > 0 && (
                <button
                  type="button"
                  class="light small"
                  disabled={uiState === 'loading'}
                  onClick={() => {
                    fetchGIFs({
                      offset: results.pagination?.offset - GIFS_PER_PAGE,
                    });
                  }}
                >
                  <Icon icon="chevron-left" />
                  <span>
                    <Trans>Previous</Trans>
                  </span>
                </button>
              )}
              <span />
              {results.pagination?.offset + results.pagination?.count <
                results.pagination?.total_count && (
                <button
                  type="button"
                  class="light small"
                  disabled={uiState === 'loading'}
                  onClick={() => {
                    fetchGIFs({
                      offset: results.pagination?.offset + GIFS_PER_PAGE,
                    });
                  }}
                >
                  <span>
                    <Trans>Next</Trans>
                  </span>{' '}
                  <Icon icon="chevron-right" />
                </button>
              )}
            </p>
          </>
        ) : (
          uiState === 'results' && (
            <div class="ui-state">
              <p>No results</p>
            </div>
          )
        )}
        {uiState === 'error' && (
          <div class="ui-state">
            <p>
              <Trans>Error loading GIFs</Trans>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default GIFPickerModal;
