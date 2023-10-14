import moize from 'moize';

export default function mem(fn, opts = {}) {
  return moize(fn, { ...opts, maxSize: 100 });
}
