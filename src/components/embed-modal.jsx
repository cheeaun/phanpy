import './embed-modal.css';

import { Trans, useLingui } from '@lingui/react/macro';

import Icon from './icon';

function EmbedModal({ html, url, width, height, onClose = () => {} }) {
  const { t } = useLingui();
  return (
    <div class="embed-modal-container">
      <div class="top-controls">
        <button type="button" class="light" onClick={() => onClose()}>
          <Icon icon="x" alt={t`Close`} />
        </button>
        {url && (
          <a href={url} target="_blank" rel="noopener" class="button plain">
            <span>
              <Trans>Open in new window</Trans>
            </span>{' '}
            <Icon icon="external" />
          </a>
        )}
      </div>
      <div
        class="embed-content"
        dangerouslySetInnerHTML={{ __html: html }}
        style={{
          '--width': width + 'px',
          '--height': height + 'px',
          '--aspect-ratio': `${width}/${height}`,
        }}
      />
    </div>
  );
}

export default EmbedModal;
