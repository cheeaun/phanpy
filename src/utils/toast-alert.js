// Replace alert() with toastify-js
import Toastify from 'toastify-js';

const nativeAlert = window.alert;
if (!window.__nativeAlert) window.__nativeAlert = nativeAlert;

window.alert = function (message) {
  console.debug(
    'ALERT: This is a custom alert() function. Native alert() is still available as window.__nativeAlert()',
  );
  // If Error object, show the message
  if (message instanceof Error && message?.message) {
    message = message.message;
  }
  // If not string, stringify it
  if (typeof message !== 'string') {
    message = JSON.stringify(message);
  }

  const toast = Toastify({
    text: message,
    className: 'alert',
    gravity: 'top',
    position: 'center',
    duration: 10_000,
    offset: {
      y: 48,
    },
    onClick: () => {
      toast.hideToast();
    },
  });
  toast.showToast();
};
