import { Menu, MenuItem } from '@szhsin/react-menu';
import { useState } from 'preact/hooks';

import Icon from './icon';
import TranslationBlock from './translation-block';

export default function MediaAltModal({ alt, lang, onClose }) {
  const [forceTranslate, setForceTranslate] = useState(false);
  return (
    <div class="sheet">
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
          }}
        >
          {alt}
        </p>
        {forceTranslate && (
          <TranslationBlock forceTranslate={forceTranslate} text={alt} />
        )}
      </main>
    </div>
  );
}
