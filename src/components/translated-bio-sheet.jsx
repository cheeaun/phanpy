import { Trans, useLingui } from '@lingui/react/macro';

import getHTMLText from '../utils/getHTMLText';

import Icon from './icon';
import TranslationBlock from './translation-block';

function TranslatedBioSheet({ note, fields, onClose }) {
  const { t } = useLingui();
  const fieldsText =
    fields
      ?.map(({ name, value }) => `${name}\n${getHTMLText(value)}`)
      .join('\n\n') || '';

  const text = getHTMLText(note) + (fieldsText ? `\n\n${fieldsText}` : '');

  return (
    <div class="sheet">
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" alt={t`Close`} />
        </button>
      )}
      <header>
        <h2>
          <Trans>Translated Bio</Trans>
        </h2>
      </header>
      <main>
        <p
          style={{
            whiteSpace: 'pre-wrap',
          }}
        >
          {text}
        </p>
        <TranslationBlock forceTranslate text={text} />
      </main>
    </div>
  );
}

export default TranslatedBioSheet;
