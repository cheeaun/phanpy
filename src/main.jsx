import './index.css';
import './cloak-mode.css';
import './polyfills';

import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
// Polyfill needed for Firefox < 122
// https://bugzilla.mozilla.org/show_bug.cgi?id=1423593
// import '@formatjs/intl-segmenter/polyfill';
import { render } from 'preact';
import { HashRouter } from 'react-router-dom';

import { App } from './app';
import { IconSpriteProvider } from './components/icon-sprite-manager';
import { initActivateLang } from './utils/lang';
import { initPWAViewport } from './utils/pwa-viewport';

initActivateLang();
initPWAViewport();

if (import.meta.env.DEV) {
  import('preact/debug');
}

render(
  <I18nProvider i18n={i18n}>
    <HashRouter>
      <IconSpriteProvider>
        <App />
      </IconSpriteProvider>
    </HashRouter>
  </I18nProvider>,
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

// Service worker cache cleanup
if ('serviceWorker' in navigator && typeof caches !== 'undefined') {
  const MAX_SW_CACHE_SIZE = 50;
  const IGNORE_CACHE_KEYS = ['icons'];
  let clearRanOnce = false;
  const FAST_INTERVAL = 10_000; // 10 seconds
  const SLOW_INTERVAL = 60 * 60 * 1000; // 1 hour
  async function clearCaches() {
    if (window.__IDLE__) {
      try {
        const keys = await caches.keys();
        for (const key of keys) {
          if (IGNORE_CACHE_KEYS.includes(key)) continue;
          const cache = await caches.open(key);
          const _keys = await cache.keys();
          if (_keys.length > MAX_SW_CACHE_SIZE) {
            console.warn('Cleaning cache', key, _keys.length);
            const deleteKeys = _keys.slice(MAX_SW_CACHE_SIZE);
            for (const deleteKey of deleteKeys) {
              await cache.delete(deleteKey);
            }
          }
        }
        clearRanOnce = true;
      } catch (e) {} // Silent fail
    }
    // Once cleared, clear again at slower interval
    setTimeout(clearCaches, clearRanOnce ? SLOW_INTERVAL : FAST_INTERVAL);
  }
  setTimeout(clearCaches, FAST_INTERVAL);
}

window.__CLOAK__ = () => {
  document.body.classList.toggle('cloak');
};
