import moize from 'moize';

export default function pmem(fn, opts = {}) {
  return moize(fn, { isPromise: true, ...opts, maxSize: Infinity });
}
