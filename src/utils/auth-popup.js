export function openAuthPopup(url) {
  const width = Math.min(500, Math.floor(window.screen.width * 0.9));
  const height = Math.min(600, Math.floor(window.screen.height * 0.8));

  const features = `popup,width=${width},height=${height}`;

  try {
    const popup = window.open(url, 'auth-popup', features);
    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      return null;
    }
    return popup;
  } catch (e) {
    console.error('Failed to open popup:', e);
    return null;
  }
}

export function closeAuthPopup(popup) {
  if (popup && !popup.closed) {
    try {
      popup.close();
    } catch (e) {
      console.error('Failed to close popup:', e);
    }
  }
}

export function watchAuthPopup(popup, onSuccess, onError) {
  let resolved = false;

  const messageHandler = (event) => {
    // Security: verify event origin matches current origin
    if (event.origin !== window.location.origin) {
      return;
    }

    if (event.data && event.data.type === 'oauth-callback') {
      resolved = true;
      cleanup();

      if (event.data.code) {
        onSuccess(event.data.code);
      } else {
        onError(new Error('No authorization code received'));
      }
    }
  };

  window.addEventListener('message', messageHandler);

  const pollInterval = setInterval(() => {
    if (!popup || popup.closed) {
      clearInterval(pollInterval);
      if (!resolved) {
        resolved = true;
        cleanup();
        onError(new Error('Popup was closed before authentication completed'));
      }
    }
  }, 500);

  const cleanup = () => {
    window.removeEventListener('message', messageHandler);
    clearInterval(pollInterval);
    closeAuthPopup(popup);
  };

  return cleanup;
}
