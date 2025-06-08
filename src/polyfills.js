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

// AbortSignal.any polyfill
// Based on https://github.com/mozilla/pdf.js/pull/19681/files
if ('AbortSignal' in window && !AbortSignal.any) {
  AbortSignal.any = function (iterable) {
    const ac = new AbortController();
    const { signal } = ac;

    // Return immediately if any of the signals are already aborted.
    for (const s of iterable) {
      if (s.aborted) {
        ac.abort(s.reason);
        return signal;
      }
    }

    // Register "abort" listeners for all signals.
    for (const s of iterable) {
      s.addEventListener(
        'abort',
        () => {
          ac.abort(s.reason);
        },
        { signal }, // Automatically remove the listener.
      );
    }

    return signal;
  };
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
