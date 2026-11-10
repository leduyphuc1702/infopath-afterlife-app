import { afterAll, expect, test } from 'vitest';
import { buildFormIR, prepareView, renderView, type PreparedView } from '../../src/index';
import { GOLDEN_INPUT } from '../helpers/render-golden';
import { viewCases } from '../helpers/render-cases';

// Spec 03 R9.1 (design §10): each of the 53 views with its empty and first records, 2 warm-up
// renders then 20 timed renderView calls (the view prepared once, before timing); p95 under
// 100 ms. Percentiles are nearest-rank over the 20 runs: p50 is the 10th fastest, p95 the 19th.
// Form 08 is reported on its own line. Numbers count only on Node 22 (CI pins it).

const WARM_UP = 2;
const RUNS = 20;
const BUDGET_MS = 100;
const BIG = '08-big-form';

const cases = await viewCases();
const rows: { id: string; slug: string; p50: number; p95: number; max: number }[] = [];
const nearestRank = (sorted: number[], p: number) => sorted[Math.ceil(p * sorted.length) - 1]!;

test('runs on Node 22, over 53 views', () => {
  expect(process.version).toMatch(/^v22\./);
  expect(cases).toHaveLength(53);
});

test.each(
  cases.flatMap((c) => (['empty', 'first'] as const).map((r) => [`${c.id} ${r}`, c, r] as const)),
)(
  `%s: p95 of ${RUNS} renders under ${BUDGET_MS} ms`,
  async (id, c, record) => {
    const prepared: PreparedView = await prepareView(c.t, buildFormIR(c.t), { view: c.view });
    const input = { ...GOLDEN_INPUT, record: c.records[record] };
    for (let i = 0; i < WARM_UP; i++) renderView(prepared, input);
    const times: number[] = [];
    for (let i = 0; i < RUNS; i++) {
      const t0 = performance.now();
      renderView(prepared, input);
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    const row = {
      id,
      slug: c.slug,
      p50: nearestRank(times, 0.5),
      p95: nearestRank(times, 0.95),
      max: times.at(-1)!,
    };
    rows.push(row);
    expect(row.p95).toBeLessThan(BUDGET_MS);
  },
  30_000,
);

afterAll(() => {
  const ms = (n: number) => n.toFixed(2).padStart(8);
  const width = Math.max(...rows.map((r) => r.id.length));
  const sorted = [...rows].sort((a, b) => b.p95 - a.p95);
  const lines = [
    `renderView on ${process.version}: ${WARM_UP} warm-up + ${RUNS} timed renders per view and record (ms), slowest 10 by p95`,
    `${'view and record'.padEnd(width)}      p50      p95      max`,
    ...sorted
      .slice(0, 10)
      .map((r) => `${r.id.padEnd(width)} ${ms(r.p50)} ${ms(r.p95)} ${ms(r.max)}`),
  ];
  for (const r of rows.filter((x) => x.slug === BIG))
    lines.push(`${BIG} (R9.1): ${r.id} p50 ${r.p50.toFixed(2)} ms, p95 ${r.p95.toFixed(2)} ms`);
  const worst = sorted.find((r) => r.slug !== BIG);
  if (worst)
    lines.push(
      `slowest p95 other than form 08: ${worst.id} ${worst.p95.toFixed(2)} ms (budget ${BUDGET_MS} ms)`,
    );
  console.log(lines.join('\n'));
});
