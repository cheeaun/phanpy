import './translation-block.css';

import pRetry from 'p-retry';
import pThrottle from 'p-throttle';
import { useEffect, useRef, useState } from 'preact/hooks';

import sourceLanguages from '../data/lingva-source-languages';
import getTranslateTargetLanguage from '../utils/get-translate-target-language';
import localeCode2Text from '../utils/localeCode2Text';
import pmem from '../utils/pmem';

import Icon from './icon';
import Loader from './loader';

const { PHANPY_LINGVA_INSTANCES } = import.meta.env;
const LINGVA_INSTANCES = PHANPY_LINGVA_INSTANCES
  ? PHANPY_LINGVA_INSTANCES.split(/\s+/)
  : [];

const throttle = pThrottle({
  limit: 1,
  interval: 2000,
});

let currentLingvaInstance = 0;

function _lingvaTranslate(text, source, target) {
  console.log('TRANSLATE', text, source, target);
  const fetchCall = () => {
    let instance = LINGVA_INSTANCES[currentLingvaInstance];
    return fetch(
      `https://${instance}/api/v1/${source}/${target}/${encodeURIComponent(
        text,
      )}`,
    )
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then((res) => {
        return {
          provider: 'lingva',
          content: res.translation,
          detectedSourceLanguage: res.info?.detectedSource,
          info: res.info,
        };
      });
  };
  return pRetry(fetchCall, {
    retries: 3,
    onFailedAttempt: (e) => {
      currentLingvaInstance =
        (currentLingvaInstance + 1) % LINGVA_INSTANCES.length;
      console.log(
        'Retrying translation with another instance',
        currentLingvaInstance,
      );
    },
  });
  // return masto.v1.statuses.$select(id).translate({
  //   lang: DEFAULT_LANG,
  // });
}
const TRANSLATED_MAX_AGE = 1000 * 60 * 60; // 1 hour
const lingvaTranslate = pmem(_lingvaTranslate, {
  maxAge: TRANSLATED_MAX_AGE,
});
const throttledLingvaTranslate = pmem(throttle(lingvaTranslate), {
  // I know, this is double-layered memoization
  maxAge: TRANSLATED_MAX_AGE,
});

function TranslationBlock({
  forceTranslate,
  sourceLanguage,
  onTranslate,
  text = '',
  mini,
}) {
  const targetLang = getTranslateTargetLanguage(true);
  const [uiState, setUIState] = useState('default');
  const [pronunciationContent, setPronunciationContent] = useState(null);
  const [translatedContent, setTranslatedContent] = useState(null);
  const [detectedLang, setDetectedLang] = useState(null);
  const detailsRef = useRef();

  const sourceLangText = sourceLanguage
    ? localeCode2Text(sourceLanguage)
    : null;
  const targetLangText = localeCode2Text(targetLang);
  const apiSourceLang = useRef('auto');

  if (!onTranslate) {
    onTranslate = mini ? throttledLingvaTranslate : lingvaTranslate;
  }

  const translate = async () => {
    setUIState('loading');
    try {
      const { content, detectedSourceLanguage, provider, error, ...props } =
        await onTranslate(text, apiSourceLang.current, targetLang);
      if (content) {
        if (detectedSourceLanguage) {
          const detectedLangText = localeCode2Text(detectedSourceLanguage);
          setDetectedLang(detectedLangText);
        }
        if (provider === 'lingva') {
          const pronunciation = props?.info?.pronunciation?.query;
          if (pronunciation) {
            setPronunciationContent(pronunciation);
          }
        }
        setTranslatedContent(content);
        setUIState('default');
        if (!mini && content.trim() !== text.trim()) {
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
      console.error(e);
      setUIState('error');
    }
  };

  useEffect(() => {
    if (forceTranslate) {
      translate();
    }
  }, [forceTranslate]);

  if (mini) {
    if (
      !!translatedContent &&
      translatedContent.trim() !== text.trim() &&
      detectedLang !== targetLangText
    ) {
      return (
        <div class="shazam-container">
          <div class="shazam-container-inner">
            <div class="status-translation-block-mini">
              <Icon
                icon="translate"
                alt={`Auto-translated from ${sourceLangText}`}
              />
              <output
                lang={targetLang}
                dir="auto"
                title={pronunciationContent || ''}
              >
                {translatedContent}
              </output>
            </div>
          </div>
        </div>
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
                ? 'Translating…'
                : sourceLanguage && sourceLangText && !detectedLang
                ? `Translate from ${sourceLangText}`
                : `Translate`}
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
              {sourceLanguages.map((l) => (
                <option value={l.code}>
                  {l.code === 'auto' ? `Auto (${detectedLang ?? '…'})` : l.name}
                </option>
              ))}
            </select>{' '}
            <span>→ {targetLangText}</span>
            <Loader abrupt hidden={uiState !== 'loading'} />
          </div>
          {uiState === 'error' ? (
            <p class="ui-state">Failed to translate</p>
          ) : (
            !!translatedContent && (
              <>
                <output class="translated-content" lang={targetLang} dir="auto">
                  {translatedContent}
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

export default LINGVA_INSTANCES?.length ? TranslationBlock : () => null;
