import './translation-block.css';

import pThrottle from 'p-throttle';
import { useEffect, useRef, useState } from 'preact/hooks';

import sourceLanguages from '../data/lingva-source-languages';
import getTranslateTargetLanguage from '../utils/get-translate-target-language';
import localeCode2Text from '../utils/localeCode2Text';

import Icon from './icon';
import Loader from './loader';

const throttle = pThrottle({
  limit: 1,
  interval: 2000,
});

function lingvaTranslate(text, source, target) {
  console.log('TRANSLATE', text, source, target);
  // Using another API instance instead of lingva.ml because of this bug (slashes don't work):
  // https://github.com/thedaviddelta/lingva-translate/issues/68
  return fetch(
    `https://lingva.garudalinux.org/api/v1/${source}/${target}/${encodeURIComponent(
      text,
    )}`,
  )
    .then((res) => res.json())
    .then((res) => {
      return {
        provider: 'lingva',
        content: res.translation,
        detectedSourceLanguage: res.info?.detectedSource,
        info: res.info,
      };
    });
  // return masto.v1.statuses.translate(id, {
  //   lang: DEFAULT_LANG,
  // });
}
const throttledLingvaTranslate = throttle(lingvaTranslate);

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
      const { content, detectedSourceLanguage, provider, ...props } =
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
        if (!mini) {
          detailsRef.current.open = true;
          detailsRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
          });
        }
      } else {
        console.error(result);
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
    if (!!translatedContent && detectedLang !== targetLangText) {
      return (
        <div class="status-translation-block-mini">
          <Icon
            icon="translate"
            alt={`Auto-translated from ${sourceLangText}`}
          />
          <output lang={targetLang} dir="auto">
            {translatedContent}
          </output>
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

export default TranslationBlock;
