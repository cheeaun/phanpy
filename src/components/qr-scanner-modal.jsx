import './qr-scanner-modal.css';

import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useRef, useState } from 'preact/hooks';
import { frameLoop, frontalCamera, QRCanvas } from 'qr/dom.js';

import Icon from './icon';

function QrScannerModal({ onClose }) {
  const { t } = useLingui();
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const [decodedText, setDecodedText] = useState('');
  const [isScanning, setIsScanning] = useState(true);
  const [uiState, setUIState] = useState('loading');

  useEffect(() => {
    let cancelMainLoop;
    let cam;
    let qrCanvas;

    const startCamera = async () => {
      try {
        cam = await frontalCamera(videoRef.current);

        qrCanvas = new QRCanvas(
          {
            overlay: overlayRef.current,
          },
          {
            cropToSquare: false,
            overlayMainColor: 'transparent',
            overlayFinderColor: 'rgba(255, 0, 255, 0.5)',
          },
        );

        // Start scanning loop when video plays (following demo pattern)
        const video = videoRef.current;
        if (video) {
          video.addEventListener('play', () => {
            // We won't have correct size until video starts playing
            console.log('Video started playing, beginning scan loop');

            const { videoWidth, videoHeight } = video;
            video.style.aspectRatio = `${videoWidth} / ${videoHeight}`;
            containerRef.current.style.maxWidth = `${videoWidth}px`;

            const mainLoop = () => {
              try {
                const result = cam.readFrame(qrCanvas, true);
                if (result !== undefined && result !== null) {
                  console.log('Scan result:', result);
                  setDecodedText(result);
                  // Keep scanning continuously - don't stop on success
                }
              } catch (e) {
                console.error('Error in scan loop:', e);
              }
            };

            cancelMainLoop = frameLoop(mainLoop);
          });
        }
      } catch (err) {
        console.error('Error accessing camera:', err);
        setUIState('error');
        setIsScanning(false);
      }
    };

    if (isScanning) {
      startCamera();
    }

    return () => {
      if (cancelMainLoop) cancelMainLoop();
      if (cam) {
        cam.stop();
      }
      if (qrCanvas) {
        qrCanvas.clear();
      }
    };
  }, [isScanning]);

  const isValidUrl = (string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  return (
    <div class="qr-scanner-modal">
      <div class="qr-scanner-header">
        <button type="button" class="plain4" onClick={onClose}>
          <Icon icon="x" alt={t`Close`} />
        </button>
      </div>
      {uiState === 'error' ? (
        <div class="ui-state">
          <p>
            <Trans>Unable to access camera. Please check permissions.</Trans>
          </p>
        </div>
      ) : (
        <>
          <div ref={containerRef} class="qr-scanner-video-container">
            <video ref={videoRef} playsInline muted disablepictureinpicture />
            <canvas ref={overlayRef} class="qr-scanner-canvas" />
            <svg
              class="qr-scanner-corner-hint"
              viewBox="0 0 100 100"
              preserveAspectRatio="xMidYMid meet"
            >
              <path
                d="M 25 10 L 15 10 Q 10 10 10 15 L 10 25"
                stroke="currentColor"
                stroke-width="2"
                fill="none"
                stroke-linecap="round"
              />
              <path
                d="M 75 10 L 85 10 Q 90 10 90 15 L 90 25"
                stroke="currentColor"
                stroke-width="2"
                fill="none"
                stroke-linecap="round"
              />
              <path
                d="M 25 90 L 15 90 Q 10 90 10 85 L 10 75"
                stroke="currentColor"
                stroke-width="2"
                fill="none"
                stroke-linecap="round"
              />
              <path
                d="M 75 90 L 85 90 Q 90 90 90 85 L 90 75"
                stroke="currentColor"
                stroke-width="2"
                fill="none"
                stroke-linecap="round"
              />
            </svg>
          </div>
          <div class="qr-scanner-result">
            {!!decodedText && (
              <>
                <p class="qr-scanner-text">{decodedText}</p>
                {isValidUrl(decodedText) && (
                  <a
                    class="button plain6"
                    href={`/#/${decodedText}`}
                    onClick={() => {
                      // Close QR code modal
                      states.showQrCodeModal = false;
                      // Close itself
                      onClose();
                    }}
                  >
                    <Trans>View profile</Trans>
                  </a>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default QrScannerModal;
