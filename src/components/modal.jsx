import './modal.css';

import { createPortal } from 'preact/compat';
import { useEffect, useRef } from 'preact/hooks';
import { useHotkeys } from 'react-hotkeys-hook';

import useCloseWatcher from '../utils/useCloseWatcher';

const $modalContainer = document.getElementById('modal-container');

function Modal({ children, onClose, onClick, class: className }) {
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
      tabIndex="-1"
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
