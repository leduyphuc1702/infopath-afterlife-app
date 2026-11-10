import fc from 'fast-check';
import { expect, test } from 'vitest';
import { classify, COVERAGE_CLASSES, type FormIR } from '../../src/index';
import { sampleIRs } from '../helpers/irs';

// Property P11 (spec 12 R1.4): for FormIR of the in-repo samples with elements removed or
// duplicated (under new ids), every element is classified exactly once: the item count follows
// the change, and the four counts sum to it.
const RUNS = 200;
const samples = await sampleIRs();

type Edit = {
  list: 'rules' | 'calculations' | 'validations' | 'dataConnections';
  i: number;
  op: 'drop' | 'dup';
};

function apply(ir: FormIR, edits: readonly Edit[]): { ir: FormIR; delta: number } {
  let out = ir;
  let delta = 0;
  for (const [n, e] of edits.entries()) {
    const list = out[e.list] as readonly { id: string; actions?: readonly unknown[] }[];
    if (list.length === 0) continue;
    const item = list[e.i % list.length]!;
    const weight = e.list === 'rules' ? (item.actions?.length ?? 0) : 1;
    if (e.op === 'drop') {
      out = { ...out, [e.list]: list.filter((x) => x !== item) };
      delta -= weight;
    } else {
      const copy =
        e.list === 'rules'
          ? {
              ...item,
              id: `${item.id}#${n}`,
              actions: (item.actions as { id: string }[]).map((a) => ({
                ...a,
                id: `${a.id}#${n}`,
              })),
            }
          : { ...item, id: `${item.id}#${n}` };
      out = { ...out, [e.list]: [...list, copy] };
      delta += weight;
    }
  }
  return { ir: out, delta };
}

test(`${RUNS} runs: each element classified once, counts sum to the items`, () => {
  const t0 = Date.now();
  fc.assert(
    fc.property(
      fc.nat(samples.length - 1),
      fc.array(
        fc.record({
          list: fc.constantFrom('rules', 'calculations', 'validations', 'dataConnections'),
          i: fc.nat(50),
          op: fc.constantFrom('drop', 'dup'),
        }),
        { maxLength: 6 },
      ),
      (s, edits) => {
        const base = samples[s]!.ir;
        const { ir, delta } = apply(base, edits);
        const c = classify(ir);
        expect(c.items.length).toBe(classify(base).items.length + delta);
        expect(new Set(c.items.map((i) => i.elementId)).size).toBe(c.items.length);
        expect(COVERAGE_CLASSES.reduce((n, k) => n + c.counts[k], 0)).toBe(c.items.length);
      },
    ),
    { numRuns: RUNS },
  );
  expect(Date.now() - t0).toBeLessThan(2000);
});
