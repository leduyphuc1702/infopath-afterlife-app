import { expect, test } from 'vitest';
import { goldenText, snapshot } from './snapshot';

test('keys sorted at every depth, arrays in their own order', async () => {
  const snap = await snapshot({ b: 1, a: { d: [3, 1, 2], c: null } });
  expect(goldenText(snap)).toBe(
    `${JSON.stringify({ a: { c: null, d: [3, 1, 2] }, b: 1 }, null, 2)}\n`,
  );
});

test('bytes become size and SHA-256', async () => {
  expect(await snapshot({ bytes: new TextEncoder().encode('abc') })).toEqual({
    bytes: {
      sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      size: 3,
    },
  });
});

test.each([
  ['Map', { x: new Map() }, '$.x'],
  ['Set', { x: [new Set()] }, '$.x[0]'],
  ['Date', { x: new Date(0) }, '$.x'],
  ['class instance', { x: new (class Thing {})() }, '$.x'],
  ['undefined', { x: undefined }, '$.x'],
  ['NaN', { x: NaN }, '$.x'],
  ['-0', { x: -0 }, '$.x'],
  ['function', { x: () => 1 }, '$.x'],
  ['bigint', { x: 1n }, '$.x'],
])('refuses %s, naming its path', async (_what, value, path) => {
  await expect(snapshot(value)).rejects.toThrow(` at ${path} `);
});
