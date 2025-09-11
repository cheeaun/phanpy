const focusDeck = () => {
  let timer = setTimeout(() => {
    const columns = document.getElementById('columns');
    if (columns) {
      // Focus focused column
      const focusedColumn = columns.querySelector('.deck-container.focus');
      if (focusedColumn) {
        focusedColumn.focus();
      } else {
        // Focus first column within viewport
        const firstVisibleColumn = Array.from(
          columns.querySelectorAll('.deck-container'),
        ).find((column) => {
          const columnRect = column.getBoundingClientRect();
          return columnRect.left >= 0;
        });
        if (firstVisibleColumn) {
          firstVisibleColumn.focus();
        } else {
          // Focus first column
          columns.querySelector('.deck-container')?.focus?.();
        }
      }
    } else {
      const modals = document.querySelectorAll('#modal-container > *');
      if (modals?.length) {
        // Focus last modal
        const modal = modals[modals.length - 1]; // last one
        const modalFocusElement =
          modal.querySelector('[tabindex="-1"]') || modal;
        if (modalFocusElement) {
          modalFocusElement.focus();
          return;
        }
      }
      const backDrop = document.querySelector('.deck-backdrop');
      if (backDrop) return;
      // Focus last deck
      const pages = document.querySelectorAll('.deck-container');
      const page = pages[pages.length - 1]; // last one
      if (page && page.tabIndex === -1) {
        console.log('FOCUS', page);
        page.focus();
      }
    }
  }, 100);
  return () => clearTimeout(timer);
};

export default focusDeck;
