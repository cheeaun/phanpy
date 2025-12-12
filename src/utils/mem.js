import { memoize } from 'micro-memoize';

// Only assign to window if in browser environment
if (typeof window !== 'undefined') {
  window._memoize = memoize;
}

export default function mem(fn, opts = {}) {
  return memoize(fn, {
    ...opts,
    maxSize: 30,
    isKeyItemEqual: 'deep',
  });
}
