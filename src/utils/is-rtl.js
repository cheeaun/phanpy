let IS_RTL = false;

// Use MutationObserver to detect RTL
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'attributes') {
      const { value } = mutation.target;
      if (value === 'rtl') {
        IS_RTL = true;
      } else {
        IS_RTL = false;
      }
      // Fire custom event 'dirchange' on document
      // document.dispatchEvent(new Event('dirchange'));
    }
  });
});
observer.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['dir'],
});

export default function isRTL() {
  return IS_RTL;
  // return document.documentElement.dir === 'rtl';
}
