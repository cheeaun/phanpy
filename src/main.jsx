import './index.css';

import './cloak-mode.css';

// Polyfill needed for Firefox < 122
// https://bugzilla.mozilla.org/show_bug.cgi?id=1423593
// import '@formatjs/intl-segmenter/polyfill';
import { render } from 'preact';
import { HashRouter } from 'react-router-dom';

import { App } from './app';

if (import.meta.env.DEV) {
  import('preact/debug');
}

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

render(
  <HashRouter>
    <App />
  </HashRouter>,
  document.getElementById('app'),
);

// Storage cleanup
setTimeout(() => {
  try {
    // Clean up iconify localStorage
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('iconify')) {
        localStorage.removeItem(key);
      }
    });
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith('iconify')) {
        sessionStorage.removeItem(key);
      }
    });

    // Clean up old settings key
    localStorage.removeItem('settings:boostsCarousel');
  } catch (e) {}
}, 5000);

window.__CLOAK__ = () => {
  document.body.classList.toggle('cloak');
};
