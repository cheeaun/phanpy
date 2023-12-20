import { useEffect } from 'preact/hooks';

function useCloseWatcher(fn, deps = []) {
  if (!fn || typeof fn !== 'function') return;
  useEffect(() => {
    const watcher = new CloseWatcher();
    watcher.addEventListener('close', fn);
    return () => {
      watcher.destroy();
    };
  }, deps);
}

export default window.CloseWatcher ? useCloseWatcher : () => {};
