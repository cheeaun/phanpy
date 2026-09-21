import './translation-block.css';

import { Trans, useLingui } from '@lingui/react/macro';
import PQueue from 'p-queue';
import pRetry from 'p-retry';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useOnInView } from 'react-intersection-observer';

import languages from '../data/translang-languages';
import {
  translate as browserTranslate,
  supportsBrowserTranslator,
} from '../utils/browser-translator';
import getTranslateTargetLanguage from '../utils/get-translate-target-language';
import localeCode2Text from '../utils/localeCode2Text';
import pmem from '../utils/pmem';

import Icon from './icon';
import LazyShazam from './lazy-shazam';
import Loader from './loader';

const sourceLanguages = Object.entries(languages.sl).map(([code, name]) => ({
  code,
  name,
}));

const { PHANPY_TRANSLANG_INSTANCES } = import.meta.env;
const TRANSLANG_INSTANCES = PHANPY_TRANSLANG_INSTANCES
  ? PHANPY_TRANSLANG_INSTANCES.split(/\s+/)
  : [];

const translationQueue = new PQueue({
  concurrency: 1,
  interval: 2000,
  intervalCap: 1,
});

const TRANSLATED_MAX_AGE = 1000 * 60 * 60; // 1 hour
let currentTranslangInstance = 0;

function _translangTranslate(text, source, target) {
  console.log('TRANSLATE', text, source, target);
  const fetchCall = () => {
    let instance = TRANSLANG_INSTANCES[currentTranslangInstance];
    const tooLong = text.length > 2000;
    let fetchPromise;
    if (tooLong) {
      // POST
      fetchPromise = fetch(`https://${instance}/api/v1/translate`, {
        method: 'POST',
        priority: 'low',
        referrerPolicy: 'no-referrer',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sl: source,
          tl: target,
          text,
        }),
      });
    } else {
      // GET
      fetchPromise = fetch(
        `https://${instance}/api/v1/translate?sl=${encodeURIComponent(
          source,
        )}&tl=${encodeURIComponent(target)}&text=${encodeURIComponent(text)}`,
        {
          priority: 'low',
          referrerPolicy: 'no-referrer',
        },
      );
    }
    return fetchPromise
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then((res) => {
        return {
          provider: 'translang',
          content: res.translated_text,
          detectedSourceLanguage: res.detected_language,
          pronunciation: res.pronunciation,
        };
      });
  };
  return pRetry(fetchCall, {
    retries: 3,
    onFailedAttempt: (e) => {
      currentTranslangInstance =
        (currentTranslangInstance + 1) % TRANSLANG_INSTANCES.length;
      console.log(
        'Retrying translation with another instance',
        currentTranslangInstance,
      );
    },
  });
}
const translangTranslate = pmem(_translangTranslate, {
  expires: TRANSLATED_MAX_AGE,
});
const throttledTranslangTranslate = pmem(
  ({ signal, text, source, target }) =>
    translationQueue.add(() => translangTranslate(text, source, target), {
      signal,
    }),
  {
    // I know, this is double-layered memoization
    expires: TRANSLATED_MAX_AGE,
  },
);

const throttledBrowserTranslate = ({ text, source, target, signal }) =>
  translationQueue.add(() => browserTranslate(text, source, target), {
    signal,
  });

function renderTranslatedContent(content, urlMap = []) {
  if (!content || !urlMap.length) return content;

  const parts = [];
  const tokenRegex = /__PHANPY_(URL|MENTION|HASHTAG)_(\d+)__/g;
  let lastIndex = 0;
  let match;

  while ((match = tokenRegex.exec(content))) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    const link = urlMap[Number(match[2])];
    if (link?.href) {
      const kind = link.kind || match[1].toLowerCase();
      const isExternalURL = kind === 'url';
      parts.push(
        <a
          key={`translated-${kind}-${match[2]}`}
          href={link.href}
          class={
            kind === 'hashtag'
              ? 'mention hashtag'
              : kind === 'mention'
                ? 'u-url mention'
                : undefined
          }
          target={isExternalURL ? '_blank' : undefined}
          rel={isExternalURL ? 'nofollow noopener' : undefined}
        >
          {link.label || link.href}
        </a>,
      );
    } else {
      parts.push(match[0]);
    }
    lastIndex = tokenRegex.lastIndex;
  }

  if (!parts.length) return content;
  if (lastIndex < content.length) parts.push(content.slice(lastIndex));
  return parts;
}

export async function translateText({
  text,
  source,
  target,
  signal,
  mini = false,
}) {
  if (supportsBrowserTranslator) {
    const result = await throttledBrowserTranslate({
      text,
      source,
      target,
      signal,
    });
    if (result && !result.error) {
      return result;
    }
  }
  return mini
    ? await throttledTranslangTranslate({ signal, text, source, target })
    : await translangTranslate(text, source, target);
}

function TranslationBlock({
  forceTranslate,
  sourceLanguage,
  onTranslate,
  text = '',
  mini,
  inline,
  inlineButton,
  children,
  autoDetected,
  onTranslationVisibilityChange,
  urlMap,
  inlineClassName = 'status-translation-inline',
  inlineContentClassName = 'content status-translation-inline-content',
}) {
  const { t } = useLingui();
  const targetLang = getTranslateTargetLanguage(true);
  const [uiState, setUIState] = useState('default');
  const [pronunciationContent, setPronunciationContent] = useState(null);
  const [translatedContent, setTranslatedContent] = useState(null);
  const [detectedLang, setDetectedLang] = useState(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [inlineVisible, setInlineVisible] = useState(!inline);
  const detailsRef = useRef();
  const abortControllerRef = useRef();

  const inlineRef = useOnInView(
    (inView) => {
      if (inView) setInlineVisible(true);
    },
    {
      rootMargin: '-48px 0px 0px 0px',
      skip: !inline,
      triggerOnce: true,
    },
  );

  const sourceLangText = sourceLanguage
    ? localeCode2Text(sourceLanguage)
    : null;
  const targetLangText = localeCode2Text(targetLang);
  const apiSourceLang = useRef('auto');

  if (!onTranslate) {
    onTranslate = ({ text, source, target, signal }) =>
      translateText({ text, source, target, signal, mini });
  }

  const translate = async () => {
    setUIState('loading');
    try {
      const { content, detectedSourceLanguage, provider, error, ...props } =
        await onTranslate({
          text,
          source: apiSourceLang.current,
          target: targetLang,
          signal: abortControllerRef.current?.signal,
        });
      if (content) {
        if (detectedSourceLanguage) {
          const detectedLangText = localeCode2Text(detectedSourceLanguage);
          setDetectedLang(detectedLangText);
        }
        if (provider === 'translang') {
          const pronunciation = props?.pronunciation;
          if (pronunciation) {
            setPronunciationContent(pronunciation);
          }
        }
        setTranslatedContent(content);
        onTranslationVisibilityChange?.(true);
        setUIState('default');
        if (!mini && content.trim() !== text.trim() && detailsRef.current) {
          detailsRef.current.open = true;
          detailsRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
          });
        }
      } else {
        if (error) console.error(error);
        setUIState('error');
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error(e);
        setUIState('error');
      }
    }
  };

  useEffect(() => {
    if (forceTranslate && (!inline || inlineVisible) && !translatedContent) {
      translate();
    }
  }, [forceTranslate, inline, inlineVisible, translatedContent]);

  useEffect(() => {
    abortControllerRef.current = new AbortController();
    return () => {
      abortControllerRef.current.abort();
    };
  }, []);

  if (inline) {
    const hasTranslation =
      !!translatedContent &&
      translatedContent.trim() !== text.trim() &&
      detectedLang !== targetLangText;
    const toggleLabel = !hasTranslation
      ? inlineButton && sourceLanguage && sourceLangText
        ? autoDetected
          ? t`Translate from ${sourceLangText} (auto-detected)`
          : t`Translate from ${sourceLangText}`
        : t`Translate`
      : showOriginal
        ? t`Show translation`
        : t`Original`;

    return (
      <div
        ref={inlineRef}
        class={`${inlineClassName} ${hasTranslation ? 'is-translated' : ''}`}
      >
        {hasTranslation && !showOriginal ? (
          <div class={inlineContentClassName}>
            <output lang={targetLang} dir="auto">
              {renderTranslatedContent(translatedContent, urlMap)}
            </output>
          </div>
        ) : (
          children
        )}
        <button
          type="button"
          class={`status-translation-inline-toggle ${
            inlineButton ? 'status-translation-inline-toggle-button' : 'plain'
          } ${hasTranslation && !showOriginal ? 'is-active' : ''}`}
          title={toggleLabel}
          aria-label={toggleLabel}
          aria-pressed={hasTranslation ? !showOriginal : undefined}
          disabled={uiState === 'loading'}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!hasTranslation) {
              translate();
            } else {
              setShowOriginal((value) => {
                const nextValue = !value;
                onTranslationVisibilityChange?.(!nextValue);
                return nextValue;
              });
            }
          }}
        >
          <Icon icon="translate" alt={toggleLabel} />
          {inlineButton && <span>{toggleLabel}</span>}
        </button>
      </div>
    );
  }

  if (mini) {
    if (
      !!translatedContent &&
      translatedContent.trim() !== text.trim() &&
      detectedLang !== targetLangText
    ) {
      return (
        <LazyShazam>
          <div class="status-translation-block-mini">
            <Icon
              icon="translate"
              alt={t`Auto-translated from ${sourceLangText}`}
            />
            <output
              lang={targetLang}
              dir="auto"
              title={pronunciationContent || ''}
            >
              {renderTranslatedContent(translatedContent, urlMap)}
            </output>
          </div>
        </LazyShazam>
      );
    }
    return null;
  }

  return (
    <div
      class="status-translation-block"
      onClick={(e) => {
        e.preventDefault();
      }}
    >
      <details ref={detailsRef}>
        <summary>
          <button
            type="button"
            class={uiState === 'loading' ? 'loading-mask' : ''}
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              detailsRef.current.open = !detailsRef.current.open;
              if (uiState === 'loading') return;
              if (!translatedContent) translate();
            }}
          >
            <Icon icon="translate" />{' '}
            <span>
              {uiState === 'loading'
                ? t`Translating…`
                : sourceLanguage && sourceLangText && !detectedLang
                  ? autoDetected
                    ? t`Translate from ${sourceLangText} (auto-detected)`
                    : t`Translate from ${sourceLangText}`
                  : t`Translate`}
            </span>
          </button>
        </summary>
        <div class="translated-block">
          <div class="translation-info insignificant">
            <select
              class="translated-source-select"
              disabled={uiState === 'loading'}
              onChange={(e) => {
                apiSourceLang.current = e.target.value;
                translate();
              }}
            >
              {sourceLanguages.map((l) => {
                const common = localeCode2Text({
                  code: l.code,
                  fallback: l.name,
                });
                const native = localeCode2Text({
                  code: l.code,
                  locale: l.code,
                });
                const showCommon = native && common !== native;
                return (
                  <option value={l.code}>
                    {l.code === 'auto'
                      ? t`Auto (${detectedLang ?? '…'})`
                      : showCommon
                        ? `${native} - ${common}`
                        : common}
                  </option>
                );
              })}
            </select>{' '}
            <span>→ {targetLangText}</span>
            <Loader abrupt hidden={uiState !== 'loading'} />
          </div>
          {uiState === 'error' ? (
            <p class="ui-state">
              <Trans>Failed to translate</Trans>
            </p>
          ) : (
            !!translatedContent && (
              <>
                <output class="translated-content" lang={targetLang} dir="auto">
                  {renderTranslatedContent(translatedContent, urlMap)}
                </output>
                {!!pronunciationContent && (
                  <output
                    class="translated-pronunciation-content"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.target.classList.toggle('expand');
                    }}
                  >
                    {pronunciationContent}
                  </output>
                )}
              </>
            )
          )}
        </div>
      </details>
    </div>
  );
}

export default TRANSLANG_INSTANCES?.length ? TranslationBlock : () => null;
