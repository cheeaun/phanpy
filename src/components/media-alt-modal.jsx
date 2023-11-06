import { Menu, MenuItem } from '@szhsin/react-menu';
import { useState } from 'preact/hooks';
import { useSnapshot } from 'valtio';

import getTranslateTargetLanguage from '../utils/get-translate-target-language';
import localeMatch from '../utils/locale-match';
import states from '../utils/states';

import Icon from './icon';
import TranslationBlock from './translation-block';

export default function MediaAltModal({ alt, lang, onClose }) {
  const snapStates = useSnapshot(states);
  const [forceTranslate, setForceTranslate] = useState(false);
  const targetLanguage = getTranslateTargetLanguage(true);
  const contentTranslationHideLanguages =
    snapStates.settings.contentTranslationHideLanguages || [];
  const differentLanguage =
    !!lang &&
    lang !== targetLanguage &&
    !localeMatch([lang], [targetLanguage]) &&
    !contentTranslationHideLanguages.find(
      (l) => lang === l || localeMatch([lang], [l]),
    );

  return (
    <div class="sheet" tabindex="-1">
      {!!onClose && (
        <button type="button" class="sheet-close outer" onClick={onClose}>
          <Icon icon="x" />
        </button>
      )}
      <header class="header-grid">
        <h2>Media description</h2>
        <div class="header-side">
          <Menu
            align="end"
            menuButton={
              <button type="button" class="plain4">
                <Icon icon="more" alt="More" size="xl" />
              </button>
            }
          >
            <MenuItem
              disabled={forceTranslate}
              onClick={() => {
                setForceTranslate(true);
              }}
            >
              <Icon icon="translate" />
              <span>Translate</span>
            </MenuItem>
          </Menu>
        </div>
      </header>
      <main lang={lang} dir="auto">
        <p
          style={{
            whiteSpace: 'pre-wrap',
            textWrap: 'pretty',
          }}
        >
          {alt}
        </p>
        {(differentLanguage || forceTranslate) && (
          <TranslationBlock
            forceTranslate={forceTranslate}
            sourceLanguage={lang}
            text={alt}
          />
        )}
      </main>
    </div>
  );
}
