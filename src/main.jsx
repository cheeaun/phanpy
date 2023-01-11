import './index.css';

import { render } from 'preact';

import { App } from './app';

if (import.meta.env.DEV) {
  import('preact/debug');
}

render(<App />, document.getElementById('app'));

// Clean up iconify localStorage
// TODO: Remove this after few weeks?
setTimeout(() => {
  try {
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
  } catch (e) {}
}, 5000);
