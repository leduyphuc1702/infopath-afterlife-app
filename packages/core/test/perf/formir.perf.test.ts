import { afterAll, expect, test } from 'vitest';
import { buildFormIR, parseXsn } from '../../src/index';
import { readSample, sampleCabinets } from '../helpers/samples';

// Spec 02 R15.1: each in-repo cabinet, 3 warm-up runs then 20 timed runs of parseXsn followed by
// buildFormIR (view XSL included); p95 under 300 ms, form 08 reported separately. Percentiles are nearest-rank over the 20 runs:
// p50 is the 10th fastest, p95 the 19th. Numbers count only on Node 22 (CI pins it).

const WARM_UP = 3;
const RUNS = 20;
const BUDGET_MS = 300;
const BIG = '08-big-form';

const cabinets = sampleCabinets();
const rows: { slug: string; p50: number; p95: number; max: number }[] = [];

const nearestRank = (sorted: number[], p: number) => sorted[Math.ceil(p * sorted.length) - 1]!;

test('runs on Node 22', () => {
  expect(process.version).toMatch(/^v22\./);
});

test('there are 48 cabinets', () => {
  expect(cabinets).toHaveLength(48);
});

test.each(cabinets.map((c) => [c.slug, c.path]))(
  `%s: p95 of ${RUNS} runs under ${BUDGET_MS} ms`,
  async (slug, path) => {
    const bytes = readSample(path);
    for (let i = 0; i < WARM_UP; i++) buildFormIR(await parseXsn(bytes));
    const times: number[] = [];
    for (let i = 0; i < RUNS; i++) {
      const t0 = performance.now();
      buildFormIR(await parseXsn(bytes));
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    const row = {
      slug,
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
  const width = Math.max(...rows.map((r) => r.slug.length));
  const lines = [
    `parseXsn + buildFormIR on ${process.version}: ${WARM_UP} warm-up + ${RUNS} timed runs per cabinet (ms)`,
    `${'form'.padEnd(width)}      p50      p95      max`,
    ...rows.map((r) => `${r.slug.padEnd(width)} ${ms(r.p50)} ${ms(r.p95)} ${ms(r.max)}`),
  ];
  const big = rows.find((r) => r.slug === BIG);
  if (big)
    lines.push('', `${BIG} (R15.1): p50 ${big.p50.toFixed(2)} ms, p95 ${big.p95.toFixed(2)} ms`);
  const worst = rows.reduce((a, b) => (b.p95 > a.p95 ? b : a), rows[0]!);
  if (worst)
    lines.push(`slowest p95: ${worst.slug} ${worst.p95.toFixed(2)} ms (budget ${BUDGET_MS} ms)`);
  console.log(lines.join('\n'));
});
