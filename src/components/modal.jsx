import './modal.css';

import { createPortal } from 'preact/compat';
import { useEffect } from 'preact/hooks';

const $modalContainer = document.getElementById('modal-container');

export default ({ children, onClick, class: className }) => {
  if (!children) return null;

  const Modal = (
    <div className={className} onClick={onClick}>
      {children}
    </div>
  );

  return createPortal(Modal, $modalContainer);

  // return createPortal(children, $modalContainer);
};
