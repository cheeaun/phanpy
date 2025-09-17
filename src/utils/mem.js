import moize from 'moize';

// Only assign to window if in browser environment
if (typeof window !== 'undefined') {
  window._moize = moize;
}

export default function mem(fn, opts = {}) {
  return moize(fn, {
    ...opts,
    maxSize: 30,
    isDeepEqual: true,
  });
}
