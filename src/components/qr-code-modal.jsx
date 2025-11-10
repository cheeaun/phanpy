import './qr-code-modal.css';

import { useLingui } from '@lingui/react/macro';

import Icon from './icon';
import QrCode from './qr-code';

function QrCodeModal({ text, arena, backgroundMask, caption, onClose }) {
  const { t } = useLingui();

  return (
    <div class="qr-code-modal-container">
      {!!onClose && (
        <button
          type="button"
          class="plain4 qr-code-modal-close"
          onClick={onClose}
        >
          <Icon icon="x" alt={t`Close`} />
        </button>
      )}
      <QrCode
        text={text}
        arena={arena}
        backgroundMask={backgroundMask}
        caption={caption}
      />
      <div class="qr-code-text">{text}</div>
    </div>
  );
}

export default QrCodeModal;
