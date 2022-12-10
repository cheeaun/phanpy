import { render } from 'preact';
import { App } from './app';

import 'iconify-icon';
import '@github/time-elements';

import './index.css';

render(<App />, document.getElementById('app'));
