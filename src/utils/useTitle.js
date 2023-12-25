import { useLayoutEffect } from 'preact/hooks';
import { matchPath } from 'react-router-dom';
import { subscribeKey } from 'valtio/utils';

import states from './states';

const { PHANPY_CLIENT_NAME: CLIENT_NAME } = import.meta.env;

export default function useTitle(title, path) {
  function setTitle() {
    const { currentLocation } = states;
    const hasPaths = Array.isArray(path);
    let paths = hasPaths ? path : [];
    // Workaround for matchPath not working for optional path segments
    // https://github.com/remix-run/react-router/discussions/9862
    if (!hasPaths && /:?\w+\?/.test(path)) {
      paths.push(path.replace(/(:\w+)\?/g, '$1'));
      paths.push(path.replace(/\/?:\w+\?/g, ''));
    }
    let matched = false;
    if (paths.length) {
      matched = paths.some((p) => matchPath(p, currentLocation));
    } else if (path) {
      matched = matchPath(path, currentLocation);
    }
    console.debug('setTitle', { title, path, currentLocation, paths, matched });
    if (matched) {
      document.title = title ? `${title} / ${CLIENT_NAME}` : CLIENT_NAME;
    }
  }

  useLayoutEffect(() => {
    const unsub = subscribeKey(states, 'currentLocation', setTitle);
    setTitle();
    return unsub;
  }, [title, path]);
}
