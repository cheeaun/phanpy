import './modal.css';

import { createPortal } from 'preact/compat';

const $modalContainer = document.getElementById('modal-container');

function Modal({ children, onClick, class: className }) {
  if (!children) return null;

  const Modal = (
    <div className={className} onClick={onClick}>
      {children}
    </div>
  );

  return createPortal(Modal, $modalContainer);

  // return createPortal(children, $modalContainer);
}

export default Modal;
