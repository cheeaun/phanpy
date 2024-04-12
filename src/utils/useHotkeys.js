import { useHotkeys } from 'react-hotkeys-hook';

// Patch useHotKeys to add additional option
// E.g. useHotkeys('!', callback, {useKey: true})

export default function (keys, callback, options, deps) {
  return useHotkeys(
    keys,
    callback,
    {
      useKey: true,
      ...options,
    },
    deps,
  );
}
