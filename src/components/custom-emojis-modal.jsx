import './custom-emojis-modal.css';

import { Trans, useLingui } from '@lingui/react/macro';
import { memo } from 'preact/compat';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';

import getCustomEmojis from '../utils/custom-emojis';
import store from '../utils/store';

import Icon from './icon';
import Loader from './loader';

const CUSTOM_EMOJIS_COUNT = 100;
const EMOJI_SIZE_MIN = 1;
const EMOJI_SIZE_MAX = 2;
const EMOJI_SIZE_STEP = 0.5;

const CustomEmojiButton = memo(({ emoji, onClick, showCode }) => {
  const addEdges = (e) => {
    // Add edge-left or edge-right class based on self position relative to scrollable parent
    // If near left edge, add edge-left, if near right edge, add edge-right
    const buffer = 88;
    const parent = e.currentTarget.closest('main');
    if (parent) {
      const rect = parent.getBoundingClientRect();
      const selfRect = e.currentTarget.getBoundingClientRect();
      const targetClassList = e.currentTarget.classList;
      if (selfRect.left < rect.left + buffer) {
        targetClassList.add('edge-left');
        targetClassList.remove('edge-right');
      } else if (selfRect.right > rect.right - buffer) {
        targetClassList.add('edge-right');
        targetClassList.remove('edge-left');
      } else {
        targetClassList.remove('edge-left', 'edge-right');
      }
    }
  };

  return (
    <button
      type="button"
      className="plain4"
      onClick={onClick}
      data-title={showCode ? undefined : emoji.shortcode}
      onPointerEnter={addEdges}
      onFocus={addEdges}
    >
      <picture>
        {!!emoji.staticUrl && (
          <source
            srcSet={emoji.staticUrl}
            media="(prefers-reduced-motion: reduce)"
          />
        )}
        <img
          className="shortcode-emoji"
          src={emoji.url || emoji.staticUrl}
          alt={emoji.shortcode}
          width="24"
          height="24"
          loading="lazy"
          decoding="async"
        />
      </picture>
      {showCode && (
        <>
          {' '}
          <code>{emoji.shortcode}</code>
        </>
      )}
    </button>
  );
});

const CustomEmojisList = memo(({ emojis, onSelect }) => {
  const { i18n } = useLingui();
  const [max, setMax] = useState(CUSTOM_EMOJIS_COUNT);
  const showMore = emojis.length > max;
  return (
    <section>
      {emojis.slice(0, max).map((emoji) => (
        <CustomEmojiButton
          key={emoji.shortcode}
          emoji={emoji}
          onClick={() => {
            onSelect(`:${emoji.shortcode}:`);
          }}
        />
      ))}
      {showMore && (
        <button
          type="button"
          class="plain small"
          onClick={() => setMax(max + CUSTOM_EMOJIS_COUNT)}
        >
          <Trans>{i18n.number(emojis.length - max)} more…</Trans>
        </button>
      )}
    </section>
  );
});

const CUSTOM_EMOJI_SIZE = 'composer-customEmojiSize';

function CustomEmojisModal({
  masto,
  instance,
  onClose = () => {},
  onSelect = () => {},
  defaultSearchTerm,
}) {
  const { t } = useLingui();
  const [uiState, setUIState] = useState('default');
  const customEmojisList = useRef([]);
  const [customEmojis, setCustomEmojis] = useState([]);
  const recentlyUsedCustomEmojis = useMemo(
    () => store.account.get('recentlyUsedCustomEmojis') || [],
  );
  const searcherRef = useRef();
  useEffect(() => {
    setUIState('loading');
    (async () => {
      try {
        const [emojis, searcher] = await getCustomEmojis(instance, masto);
        console.log('emojis', emojis);
        searcherRef.current = searcher;
        setCustomEmojis(emojis);
        setUIState('default');
      } catch (e) {
        setUIState('error');
        console.error(e);
      }
    })();
  }, []);

  const customEmojisCatList = useMemo(() => {
    // Group emojis by category
    const emojisCat = {
      '--recent--': recentlyUsedCustomEmojis.filter((emoji) =>
        customEmojis.find((e) => e.shortcode === emoji.shortcode),
      ),
    };
    const othersCat = [];
    customEmojis.forEach((emoji) => {
      customEmojisList.current?.push?.(emoji);
      if (!emoji.category) {
        othersCat.push(emoji);
        return;
      }
      if (!emojisCat[emoji.category]) {
        emojisCat[emoji.category] = [];
      }
      emojisCat[emoji.category].push(emoji);
    });
    if (othersCat.length) {
      emojisCat['--others--'] = othersCat;
    }
    return emojisCat;
  }, [customEmojis]);

  const scrollableRef = useRef();
  const [matches, setMatches] = useState(null);
  const [emojiSize, setEmojiSize] = useState(
    store.local.get(CUSTOM_EMOJI_SIZE) || EMOJI_SIZE_MIN,
  );
  const onEmojiSizeDecrease = useCallback(() => {
    const newSize = Math.max(EMOJI_SIZE_MIN, emojiSize - EMOJI_SIZE_STEP);
    setEmojiSize(newSize);
    if (newSize === EMOJI_SIZE_MIN) {
      store.local.del(CUSTOM_EMOJI_SIZE);
    } else {
      store.local.set(CUSTOM_EMOJI_SIZE, newSize);
    }
  }, [emojiSize]);

  const onEmojiSizeIncrease = useCallback(() => {
    const newSize = Math.min(EMOJI_SIZE_MAX, emojiSize + EMOJI_SIZE_STEP);
    setEmojiSize(newSize);
    if (newSize === EMOJI_SIZE_MIN) {
      store.local.del(CUSTOM_EMOJI_SIZE);
    } else {
      store.local.set(CUSTOM_EMOJI_SIZE, newSize);
    }
  }, [emojiSize]);

  const onFind = useCallback(
    (e) => {
      const { value } = e.target;
      if (value) {
        const results = searcherRef.current?.search(value, {
          limit: CUSTOM_EMOJIS_COUNT,
        });
        setMatches(results.map((r) => r.item));
        scrollableRef.current?.scrollTo?.(0, 0);
      } else {
        setMatches(null);
      }
    },
    [customEmojis],
  );
  useEffect(() => {
    if (defaultSearchTerm && customEmojis?.length) {
      onFind({ target: { value: defaultSearchTerm } });
    }
  }, [defaultSearchTerm, onFind, customEmojis]);

  const onSelectEmoji = useCallback(
    (emoji) => {
      onSelect?.(emoji);
      onClose?.();

      queueMicrotask(() => {
        let recentlyUsedCustomEmojis =
          store.account.get('recentlyUsedCustomEmojis') || [];
        const recentlyUsedEmojiIndex = recentlyUsedCustomEmojis.findIndex(
          (e) => e.shortcode === emoji.shortcode,
        );
        if (recentlyUsedEmojiIndex !== -1) {
          // Move emoji to index 0
          recentlyUsedCustomEmojis.splice(recentlyUsedEmojiIndex, 1);
          recentlyUsedCustomEmojis.unshift(emoji);
        } else {
          recentlyUsedCustomEmojis.unshift(emoji);
          // Remove unavailable ones
          recentlyUsedCustomEmojis = recentlyUsedCustomEmojis.filter((e) =>
            customEmojisList.current?.find?.(
              (emoji) => emoji.shortcode === e.shortcode,
            ),
          );
          // Limit to 10
          recentlyUsedCustomEmojis = recentlyUsedCustomEmojis.slice(0, 10);
        }

        // Store back
        store.account.set('recentlyUsedCustomEmojis', recentlyUsedCustomEmojis);
      });
    },
    [onSelect],
  );

  const inputRef = useRef();
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      // Put cursor at the end
      if (inputRef.current.value) {
        inputRef.current.selectionStart = inputRef.current.value.length;
        inputRef.current.selectionEnd = inputRef.current.value.length;
      }
    }
  }, []);

  return (
    <div
      id="custom-emojis-sheet"
      class="sheet"
      style={{
        '--custom-emoji-size': emojiSize,
      }}
    >
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" alt={t`Close`} />
        </button>
      )}
      <header>
        <div>
          <b>
            <Trans>Custom emojis</Trans>
          </b>{' '}
          {uiState === 'loading' ? (
            <Loader />
          ) : (
            <small class="insignificant"> • {instance}</small>
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const emoji = matches[0];
            if (emoji) {
              onSelectEmoji(`:${emoji.shortcode}:`);
            }
          }}
        >
          <input
            ref={inputRef}
            type="search"
            placeholder={t`Search emoji`}
            onInput={onFind}
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellCheck="false"
            dir="auto"
            defaultValue={defaultSearchTerm || ''}
          />
        </form>
      </header>
      <main ref={scrollableRef}>
        {matches !== null ? (
          <ul class="custom-emojis-matches custom-emojis-list">
            {matches.map((emoji) => (
              <li key={emoji.shortcode} class="custom-emojis-match">
                <CustomEmojiButton
                  emoji={emoji}
                  onClick={() => {
                    onSelectEmoji(`:${emoji.shortcode}:`);
                  }}
                  showCode
                />
              </li>
            ))}
          </ul>
        ) : (
          <div class="custom-emojis-list">
            {uiState === 'error' && (
              <div class="ui-state">
                <p>
                  <Trans>Error loading custom emojis</Trans>
                </p>
              </div>
            )}
            {uiState === 'default' &&
              Object.entries(customEmojisCatList).map(
                ([category, emojis]) =>
                  !!emojis?.length && (
                    <div class="section-container">
                      <div class="section-header">
                        {{
                          '--recent--': t`Recently used`,
                          '--others--': t`Others`,
                        }[category] || category}
                      </div>
                      <CustomEmojisList
                        emojis={emojis}
                        onSelect={onSelectEmoji}
                      />
                    </div>
                  ),
              )}
          </div>
        )}
        <div class="size-range">
          <button
            type="button"
            class="plain4"
            onClick={onEmojiSizeDecrease}
            disabled={emojiSize <= EMOJI_SIZE_MIN}
          >
            <Icon icon="zoom-out" size="l" alt={t`Zoom out`} />
          </button>
          <button
            type="button"
            class="plain4"
            onClick={onEmojiSizeIncrease}
            disabled={emojiSize >= EMOJI_SIZE_MAX}
          >
            <Icon icon="zoom-in" size="l" alt={t`Zoom in`} />
          </button>
        </div>
      </main>
    </div>
  );
}

export default CustomEmojisModal;
