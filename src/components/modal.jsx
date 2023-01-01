import './modal.css';

import { createPortal } from 'preact/compat';
import { useEffect, useRef } from 'preact/hooks';

const $modalContainer = document.getElementById('modal-container');

function Modal({ children, onClick, class: className }) {
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

  const Modal = (
    <div ref={modalRef} className={className} onClick={onClick}>
      {children}
    </div>
  );

  return createPortal(Modal, $modalContainer);

  // return createPortal(children, $modalContainer);
}

export default Modal;
