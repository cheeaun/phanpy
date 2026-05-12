import { memoize } from 'micro-memoize';

// Only assign to window if in browser environment
if (typeof window !== 'undefined') {
  window._memoize = memoize as unknown;
}

export type MemoizedFunction<Args extends readonly unknown[], Result> = ((
  ...args: Args
) => Result) & {
  readonly cache: {
    clear(): void;
  };
};

export default function mem<Args extends readonly unknown[], Result>(
  fn: (...args: Args) => Result,
  opts: Readonly<Record<string, unknown>> = {},
): MemoizedFunction<Args, Result> {
  return memoize(fn, {
    ...opts,
    isKeyItemEqual: 'deep',
    maxSize: 30,
  }) as MemoizedFunction<Args, Result>;
}
