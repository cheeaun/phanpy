import './qr-code-modal.css';

import { useLingui } from '@lingui/react/macro';

import Icon from './icon';
import QrCode from './qr-code';

export const mediaDevicesSupported = !!navigator.mediaDevices?.getUserMedia;

function QrCodeModal({
  text,
  arena,
  backgroundMask,
  caption,
  onClose,
  onScannerClick,
}) {
  const { t } = useLingui();
  console.log('onScannerClick', onScannerClick);

  return (
    <div class="qr-code-modal-container">
      <div class="qr-code-modal-controls">
        {mediaDevicesSupported && typeof onScannerClick === 'function' ? (
          <button type="button" class="plain4" onClick={onScannerClick}>
            <Icon icon="scan" alt={t`Scan QR code`} />
          </button>
        ) : (
          <span />
        )}
        {!!onClose && (
          <button type="button" class="plain4" onClick={onClose}>
            <Icon icon="x" alt={t`Close`} />
          </button>
        )}
      </div>
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
