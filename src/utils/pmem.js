import mem from './mem';

export default function pmem(fn, opts = {}) {
  return mem(fn, { isPromise: true, ...opts });
}
