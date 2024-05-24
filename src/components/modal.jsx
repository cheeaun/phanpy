import './modal.css';

import { createPortal } from 'preact/compat';
import { useEffect, useRef } from 'preact/hooks';
import { useHotkeys } from 'react-hotkeys-hook';

import useCloseWatcher from '../utils/useCloseWatcher';

const $modalContainer = document.getElementById('modal-container');

function Modal({ children, onClose, onClick, class: className, minimized }) {
  if (!children) return null;

  const modalRef = useRef();
  useEffect(() => {
    let timer = setTimeout(() => {
      const focusElement = modalRef.current?.querySelector('[tabindex="-1"]');
      if (focusElement) {
        focusElement.focus();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const supportsCloseWatcher = window.CloseWatcher;
  const escRef = useHotkeys(
    'esc',
    () => {
      setTimeout(() => {
        onClose?.();
      }, 0);
    },
    {
      enabled: !supportsCloseWatcher && !!onClose,
      // Using keyup and setTimeout above
      // This will run "later" to prevent clash with esc handlers from other components
      keydown: false,
      keyup: true,
    },
    [onClose],
  );
  useCloseWatcher(onClose, [onClose]);

  useEffect(() => {
    const $deckContainers = document.querySelectorAll('.deck-container');
    if (minimized) {
      // Similar to focusDeck in focus-deck.jsx
      // Focus last deck
      const page = $deckContainers[$deckContainers.length - 1]; // last one
      if (page && page.tabIndex === -1) {
        page.focus();
      }
    } else {
      if (children) {
        $deckContainers.forEach(($deckContainer) => {
          $deckContainer.setAttribute('inert', '');
        });
      } else {
        $deckContainers.forEach(($deckContainer) => {
          $deckContainer.removeAttribute('inert');
        });
      }
    }
    return () => {
      $deckContainers.forEach(($deckContainer) => {
        $deckContainer.removeAttribute('inert');
      });
    };
  }, [children, minimized]);

  const Modal = (
    <div
      ref={(node) => {
        modalRef.current = node;
        escRef.current = node?.querySelector?.('[tabindex="-1"]') || node;
      }}
      className={className}
      onClick={(e) => {
        onClick?.(e);
        if (e.target === e.currentTarget) {
          onClose?.(e);
        }
      }}
      tabIndex={minimized ? 0 : '-1'}
      inert={minimized}
      onFocus={(e) => {
        try {
          if (e.target === e.currentTarget) {
            const focusElement =
              modalRef.current?.querySelector('[tabindex="-1"]');
            const isFocusable =
              !!focusElement &&
              getComputedStyle(focusElement)?.pointerEvents !== 'none';
            if (focusElement && isFocusable) {
              focusElement.focus();
            }
          }
        } catch (err) {
          console.error(err);
        }
      }}
    >
      {children}
    </div>
  );

  return createPortal(Modal, $modalContainer);

  // return createPortal(children, $modalContainer);
}

export default Modal;
