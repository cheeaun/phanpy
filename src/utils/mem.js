import moize from 'moize';

window._moize = moize;

export default function mem(fn, opts = {}) {
  return moize(fn, {
    ...opts,
    maxSize: 30,
    isDeepEqual: true,
  });
}
