import './index.css';

import '@github/time-elements';
import { render } from 'preact';

import { App } from './app';

if (import.meta.env.DEV) {
  import('preact/debug');
}

render(<App />, document.getElementById('app'));
