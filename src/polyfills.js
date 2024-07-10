// AbortSignal.timeout polyfill
// Temporary fix from https://github.com/mo/abortcontroller-polyfill/issues/73#issuecomment-1541180943
// Incorrect implementation, but should be good enough for now
if ('AbortSignal' in window) {
  AbortSignal.timeout =
    AbortSignal.timeout ||
    ((duration) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), duration);
      return controller.signal;
    });
}

// URL.parse() polyfill
if ('URL' in window && typeof URL.parse !== 'function') {
  URL.parse = function (url, base) {
    if (!url) return null;
    try {
      return base ? new URL(url, base) : new URL(url);
    } catch (e) {
      return null;
    }
  };
}
