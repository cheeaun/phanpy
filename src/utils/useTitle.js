import { useEffect } from 'preact/hooks';
import { matchPath } from 'react-router-dom';
import { useSnapshot } from 'valtio';

import states from './states';

const { VITE_CLIENT_NAME: CLIENT_NAME } = import.meta.env;

export default function useTitle(title, path) {
  const snapStates = useSnapshot(states);
  const { currentLocation } = snapStates;
  let paths = [];
  // Workaround for matchPath not working for optional path segments
  // https://github.com/remix-run/react-router/discussions/9862
  if (/:?\w+\?/.test(path)) {
    paths.push(path.replace(/(:\w+)\?/g, '$1'));
    paths.push(path.replace(/\/?:\w+\?/g, ''));
  }
  let matched = false;
  if (paths.length) {
    matched = paths.some((p) => matchPath(p, currentLocation));
  } else if (path) {
    matched = matchPath(path, currentLocation);
  }
  console.debug({ paths, matched, currentLocation });
  useEffect(() => {
    if (path && !matched) return;
    document.title = title ? `${title} / ${CLIENT_NAME}` : CLIENT_NAME;
  }, [title, snapStates.currentLocation]);
}
