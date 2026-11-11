// P22 (spec 20 R12): for any records, group column and number column, the group counts add up to
// the number of units, the group sums add up to the total exactly, and the result does not depend
// on the order of the records.
import fc from 'fast-check';
import { expect, test } from 'vitest';
import { summarize, type ListKey, type RecordList } from '../../src/index';
import { HEAVY_MS } from '../helpers/time';

const RUNS = 200;
const amount = fc.oneof(
  fc.integer({ min: -1e6, max: 1e6 }).map((n) => n / 100),
  fc.double({ min: -1e9, max: 1e9, noNaN: true, noDefaultInfinity: true }),
  fc.constant(null),
);
const record = fc.record({
  group: fc.constantFrom('', 'Sales', 'Finance', 'IT', '=1+1', '<b>x</b>'),
  date: fc.constantFrom('2024-01-05', '2024-03-30', '2025-03-01', ''),
  total: amount,
  rows: fc.array(fc.record({ type: fc.constantFrom('Travel', 'Meals', ''), amount }), {
    maxLength: 4,
  }),
});

type Gen = {
  group: string;
  date: string;
  total: number | null;
  rows: { type: string; amount: number | null }[];
};

function listOf(rs: readonly Gen[]): RecordList {
  const k = (v: number | null): ListKey => v;
  const s = (v: number | null) => (v === null ? '' : String(v));
  return {
    columns: [
      { label: 'File name', kind: 'text' },
      { label: 'Group', kind: 'text' },
      { label: 'Date', kind: 'date' },
      { label: 'Total', kind: 'number' },
    ],
    rows: rs.map((r, i) => ({
      fileName: `r${i}.xml`,
      cells: [`r${i}.xml`, r.group, r.date, s(r.total)],
      keys: [`r${i}.xml`, r.group || null, r.date || null, k(r.total)],
      more: [],
    })),
    parts: [
      {
        label: 'Item',
        columns: [
          { label: 'Type', kind: 'text' },
          { label: 'Amount', kind: 'number' },
        ],
        rows: rs.flatMap((r, i) =>
          r.rows.map((x) => ({
            record: i,
            cells: [x.type, s(x.amount)],
            keys: [x.type || null, k(x.amount)],
          })),
        ),
      },
    ],
  };
}

// Exact decimal sum of decimal texts, for the check (independent of the code's own sum).
const exact = (xs: readonly string[]) => {
  let scale = 0;
  for (const x of xs) scale = Math.max(scale, (x.split('.')[1] ?? '').length);
  const n = xs.reduce((a, x) => {
    const [i, f = ''] = x.replace('-', '').split('.');
    const v = BigInt(i! + f.padEnd(scale, '0'));
    return a + (x.startsWith('-') ? -v : v);
  }, 0n);
  return { n, scale };
};
const equal = (x: { n: bigint; scale: number }, y: { n: bigint; scale: number }) => {
  const s = Math.max(x.scale, y.scale);
  return x.n * 10n ** BigInt(s - x.scale) === y.n * 10n ** BigInt(s - y.scale);
};

const QUERIES = [
  { unit: -1, by: 1, total: 3 },
  { unit: -1, by: 2, dates: 'month' as const, total: 3 },
  { unit: 0, by: 4, total: 5 },
  { unit: 0, by: 1, total: 5 },
];

test(
  'P22: counts add up to the units, sums to the total, and order does not matter',
  () => {
    fc.assert(
      fc.property(
        fc.array(record, { maxLength: 30 }),
        fc.integer({ min: 0, max: QUERIES.length - 1 }),
        fc.boolean(),
        fc.infiniteStream(fc.nat()),
        (rs, q, some, stream) => {
          const query = QUERIES[q]!;
          const list = listOf(rs);
          const found = list.rows.map((_, i) => i).filter((i) => !some || i % 2 === 0);
          const s = summarize(list, query, found);
          const units =
            query.unit < 0
              ? found.length
              : list.parts[0]!.rows.filter((r) => found.includes(r.record)).length;
          expect(s.all.count).toBe(units);
          expect(s.lines.reduce((n, l) => n + l.count, 0)).toBe(units);
          expect(equal(exact(s.lines.map((l) => l.sumRaw!)), exact([s.all.sumRaw!]))).toBe(true);
          // Shuffle the records (and so the parts' rows); the summary is the same, line for line.
          const order = rs.map((_, i) => i);
          const it = stream[Symbol.iterator]();
          for (let i = order.length - 1; i > 0; i--) {
            const j = it.next().value! % (i + 1);
            [order[i], order[j]] = [order[j]!, order[i]!];
          }
          const moved = listOf(order.map((i) => rs[i]!));
          const back = order.map((i) => i); // moved row k is old row order[k]
          const movedFound = back.flatMap((old, k) => (found.includes(old) ? [k] : []));
          const t = summarize(moved, query, movedFound);
          const strip = (x: typeof s) =>
            x.lines.map(({ records, ...l }) => ({ ...l, records: records.length }));
          expect(strip(t)).toEqual(strip(s));
          expect(t.all).toEqual(s.all);
          expect(t.csv).toBe(s.csv);
        },
      ),
      { numRuns: RUNS },
    );
  },
  HEAVY_MS,
);
