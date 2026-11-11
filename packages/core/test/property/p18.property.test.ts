import fc from 'fast-check';
import { expect, test } from 'vitest';
import { fill, recordNames, slugs } from '../runtime/fill';

// Spec 04 R11.2, P18 (testing.md): for any form and record, recalculating twice with no input
// change changes nothing: the session's open has recalculated once (R1.2), so a second
// recalculation gives no change and the same XML.

const cases = slugs().flatMap((slug) => [
  [slug, undefined] as const,
  ...recordNames(slug).map((r) => [slug, r] as const),
]);

test('P18: a second recalculation changes no node', async () => {
  const withCalcs = new Set<string>();
  await fc.assert(
    fc.asyncProperty(fc.constantFrom(...cases), async ([slug, record]) => {
      const { s, ir } = await fill(slug, record);
      if (ir.calculations.length > 0) withCalcs.add(slug);
      const before = s.xml();
      const a = s.recalculate();
      expect(a.changes).toEqual([]);
      expect(s.xml()).toBe(before);
    }),
    { numRuns: 100 },
  );
  console.log(
    `P18: ${cases.length} cases (forms and records), 100 runs, ${withCalcs.size} forms with calculations drawn`,
  );
});
