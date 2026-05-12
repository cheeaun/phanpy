import './embed-modal.css';

import { Trans, useLingui } from '@lingui/react/macro';

import Icon from './icon';

function EmbedModal({
  html,
  url,
  iframeUrl,
  title,
  width,
  height,
  onClose = () => {},
}) {
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
      {iframeUrl ? (
        <div class="embed-content iframe-content">
          <iframe
            src={iframeUrl}
            title={title || 'Embedded content'}
            sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
            allow="clipboard-write; fullscreen"
            referrerpolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : (
        <div
          class="embed-content"
          dangerouslySetInnerHTML={{ __html: html }}
          style={{
            '--width': width + 'px',
            '--height': height + 'px',
            '--aspect-ratio': `${width}/${height}`,
          }}
        />
      )}
    </div>
  );
}

export default EmbedModal;
