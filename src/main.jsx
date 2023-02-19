import './index.css';

import { render } from 'preact';
import { HashRouter } from 'react-router-dom';

import { App } from './app';

if (import.meta.env.DEV) {
  import('preact/debug');
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
