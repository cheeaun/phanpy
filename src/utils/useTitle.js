import { useEffect } from 'preact/hooks';
import { matchPath } from 'react-router-dom';
import { useSnapshot } from 'valtio';

import states from './states';

const { VITE_CLIENT_NAME: CLIENT_NAME } = import.meta.env;

export default function useTitle(title, path) {
  const snapStates = useSnapshot(states);
  useEffect(() => {
    if (path && !matchPath(path, snapStates.currentLocation)) return;
    document.title = title ? `${title} / ${CLIENT_NAME}` : CLIENT_NAME;
  }, [title, snapStates.currentLocation]);
}
