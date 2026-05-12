let IS_RTL = false;

// Use MutationObserver to detect RTL
const observer = new MutationObserver((): void => {
  IS_RTL = document.documentElement.dir === 'rtl';
});
observer.observe(document.documentElement, {
  attributeFilter: ['dir'],
  attributes: true,
});

export default function isRTL(): boolean {
  return IS_RTL;
}
