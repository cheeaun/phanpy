import './embed-modal.css';

import { t, Trans } from '@lingui/macro';

import Icon from './icon';

function EmbedModal({ html, url, width, height, onClose = () => {} }) {
  return (
    <div class="embed-modal-container">
      <div class="top-controls">
        <button type="button" class="light" onClick={() => onClose()}>
          <Icon icon="x" alt={t`Close`} />
        </button>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            class="button plain"
          >
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
