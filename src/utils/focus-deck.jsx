const focusDeck = () => {
  let timer = setTimeout(() => {
    const columns = document.getElementById('columns');
    if (columns) {
      // Focus first column
      // columns.querySelector('.deck-container')?.focus?.();
    } else {
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
