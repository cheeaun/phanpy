const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent); // https://stackoverflow.com/a/23522755

export default function openOSK() {
  if (isSafari) {
    const fauxEl = document.createElement('input');
    fauxEl.style.position = 'absolute';
    fauxEl.style.top = '0';
    fauxEl.style.left = '0';
    fauxEl.style.opacity = '0';
    document.body.appendChild(fauxEl);
    fauxEl.focus();
    setTimeout(() => {
      document.body.removeChild(fauxEl);
    }, 500);
  }
}
