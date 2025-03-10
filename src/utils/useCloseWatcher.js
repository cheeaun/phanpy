import { useEffect } from 'preact/hooks';

// NOTE: The order of initialized close watchers is important
// Last one will intercept first if there are multiple/nested close watchers
// So if this hook reruns, the previous close watcher will be destroyed, the new one will be created and the order will change
function useCloseWatcher(fn, deps = []) {
  if (!fn || typeof fn !== 'function') return;
  useEffect(() => {
    console.log('useCloseWatcher');
    const watcher = new CloseWatcher();
    watcher.addEventListener('close', fn);
    return () => {
      watcher.destroy();
    };
  }, deps);
}

export default window.CloseWatcher ? useCloseWatcher : () => {};
