import { test, expect } from '@playwright/test';

import setRef from '../src/utils/set-ref.js';

test.describe('setRef', () => {
  test('calls a callback ref with the node', () => {
    const node = { tagName: 'DIV' };
    const received = [];
    setRef((n) => received.push(n), node);
    expect(received).toEqual([node]);
  });

  test('sets current on an object ref', () => {
    const node = { tagName: 'DIV' };
    const ref = { current: undefined };
    setRef(ref, node);
    expect(ref.current).toBe(node);
  });

  test('clears both shapes when the node is null', () => {
    const node = { tagName: 'DIV' };
    const received = [];
    setRef((n) => received.push(n), node);
    setRef((n) => received.push(n), null);
    expect(received).toHaveLength(2);
    expect(received[1]).toBeNull();

    const ref = { current: node };
    setRef(ref, null);
    expect(ref.current).toBeNull();
  });

  test('ignores a missing ref instead of throwing', () => {
    expect(() => setRef(undefined, {})).not.toThrow();
    expect(() => setRef(null, null)).not.toThrow();
  });
});
