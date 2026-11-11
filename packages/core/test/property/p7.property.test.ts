import fc from 'fast-check';
import { expect, test } from 'vitest';
import { MAX_PASSES, runCycle, type Step } from '../../src/index';

// Spec 04 R11.1, P7 (testing.md): for any generated graph of rules and calculations over up to 30
// fields, cycles included, the cycle ends within 16 passes; when it reports no loop the values
// are a fixpoint (running every step once more changes nothing), and an acyclic graph never
// loops. A fixpoint is checked where each field has one writer, as calculated fields do.

interface G {
  readonly fields: number;
  readonly steps: readonly { target: number; reads: readonly number[]; k: number; mod: number }[];
}

const graph = fc.integer({ min: 1, max: 30 }).chain((fields) =>
  fc.record({
    fields: fc.constant(fields),
    steps: fc.array(
      fc.record({
        target: fc.nat({ max: fields - 1 }),
        reads: fc.uniqueArray(fc.nat({ max: fields - 1 }), { minLength: 1, maxLength: 4 }),
        k: fc.integer({ min: 0, max: 5 }),
        mod: fc.integer({ min: 1, max: 7 }),
      }),
      { maxLength: 40 },
    ),
  }),
);

function build(g: G, values: number[]): Step<number>[] {
  return g.steps.map((s, i) => ({
    id: `s${i}`,
    reads: new Set(s.reads.map((r) => `f${r}`)),
    run: () => {
      const after = (s.reads.reduce((t, r) => t + values[r]!, 0) + s.k) % s.mod;
      const before = values[s.target]!;
      if (after === before) return [];
      values[s.target] = after;
      return [
        {
          id: `f${s.target}`,
          node: s.target,
          path: `f${s.target}`,
          before: `${before}`,
          after: `${after}`,
        },
      ];
    },
  }));
}

const acyclic = (g: G) => g.steps.every((s) => s.reads.every((r) => r < s.target));

test('P7: the cycle ends within 16 passes for any graph; no loop means a fixpoint', () => {
  let loops = 0;
  let acyclicRuns = 0;
  fc.assert(
    fc.property(graph, fc.nat({ max: 29 }), (g, seed) => {
      const values = Array.from({ length: g.fields }, () => 0);
      const steps = build(g, values);
      const t0 = performance.now();
      const r = runCycle(steps, new Map([[`f${seed % g.fields}`, [seed % g.fields]]]));
      expect(performance.now() - t0).toBeLessThan(1000);
      expect(r.passes).toBeLessThanOrEqual(MAX_PASSES);
      if (r.loop) {
        loops++;
        expect(r.passes).toBe(MAX_PASSES);
        expect(r.loop.length).toBeGreaterThan(0);
      } else if (new Set(g.steps.map((x) => x.target)).size === g.steps.length) {
        // One writer per field, as for calculated fields (two writers of one field are rules
        // that fire on change, and the last one to fire wins).
        const after = [...values];
        // Every step whose reads were touched has had its say: nothing reachable changes.
        const again = runCycle(steps, new Map(r.changes.map((c) => [c.id, [c.node]])));
        if (r.changes.length > 0)
          expect(again.changes.filter((c) => c.before !== c.after)).toEqual([]);
        expect(values).toEqual(after);
      }
      if (acyclic(g) && !r.loop) acyclicRuns++;
      if (acyclic(g)) expect(r.loop).toBeUndefined();
    }),
    { numRuns: 300 },
  );
  console.log(`P7: 300 graphs, ${loops} stopped by the cap, ${acyclicRuns} acyclic`);
});
