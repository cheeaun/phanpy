import './qr-code-modal.css';

import { useLingui } from '@lingui/react/macro';

import states, { hideAllModals } from '../utils/states';

import Icon from './icon';
import QrCode from './qr-code';

const mediaDevicesSupported = !!navigator.mediaDevices?.getUserMedia;

const isValidUrl = (string) => {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
};

function QrCodeModal({ text, arena, backgroundMask, caption, onClose }) {
  const { t } = useLingui();

  const handleScanClick = () => {
    states.showQrScannerModal = {
      checkValidity: isValidUrl,
      actionableText: t`View profile`,
      onClose: ({ text } = {}) => {
        if (text) {
          hideAllModals();
          location.hash = `/${text}`;
        }
      },
    };
  };

  return (
    <div class="qr-code-modal-container">
      <div class="qr-code-modal-controls">
        {mediaDevicesSupported ? (
          <button type="button" class="plain4" onClick={handleScanClick}>
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
