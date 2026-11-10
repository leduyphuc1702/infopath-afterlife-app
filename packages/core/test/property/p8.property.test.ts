import fc from 'fast-check';
import { expect, test } from 'vitest';
import { waveOf } from '../../src/index';

// Property P8 (spec 12 R3.5): the wave depends on the four counts alone, follows the brief's
// rules, and adding a Manual or Unsupported item never gives an earlier wave.
const counts = fc.record({
  native: fc.nat(500),
  emulated: fc.nat(50),
  manual: fc.nat(5),
  unsupported: fc.nat(5),
});

test('1,000 runs: rules, and monotone in Manual and Unsupported', () => {
  fc.assert(
    fc.property(
      counts,
      fc.constantFrom('manual', 'unsupported'),
      fc.integer({ min: 1, max: 9 }),
      (c, k, n) => {
        const w = waveOf(c);
        expect(w).toBe(c.manual + c.unsupported > 0 ? 3 : c.emulated > 0 ? 2 : 1);
        expect(waveOf({ ...c })).toBe(w);
        expect(waveOf({ ...c, [k]: c[k] + n })).toBeGreaterThanOrEqual(w);
        expect(waveOf({ ...c, [k]: c[k] + n })).toBe(3);
      },
    ),
    { numRuns: 1_000 },
  );
});
