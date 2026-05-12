import mem, { type MemoizedFunction } from './mem';

type MemoizedAsyncFunction<Args extends readonly unknown[], Result> = ((
  ...args: Args
) => Promise<Result>) & {
  readonly cache: MemoizedFunction<Args, Result>['cache'];
};

export default function pmem<Args extends readonly unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  opts: Readonly<Record<string, unknown>> = {},
): MemoizedAsyncFunction<Args, Result> {
  return mem(fn, { async: true, ...opts }) as MemoizedAsyncFunction<
    Args,
    Result
  >;
}
