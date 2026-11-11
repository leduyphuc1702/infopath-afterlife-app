import fc from 'fast-check';
import { expect, test } from 'vitest';
import type { ListKey } from '@afterlife/core';
import { findRows, searchText, walkStep } from '../src/records/find';

// Spec 17 P20, restated by spec 28: the rows shown are exactly the records whose shown values,
// or the stored values of their number and date columns, contain the Find text, in the sort
// column's value order (empty last, ties in input order), and Previous and Next
// visit them in that order.
const cell = fc.oneof(
  fc.constantFrom('', 'Kenji', 'kenji brask', 'June', '10', '9', '1.5'),
  fc.string({ maxLength: 6 }),
);
const rowsArb = fc.integer({ min: 1, max: 4 }).chain((w) =>
  fc
    .array(
      fc.record({
        cells: fc.array(cell, { minLength: w + 1, maxLength: w + 1 }),
        numeric: fc.array(fc.boolean(), { minLength: w + 1, maxLength: w + 1 }),
      }),
      { maxLength: 30 },
    )
    .map((rs) => ({ w, rs })),
);

test('P20: find, sort and walk', () => {
  fc.assert(
    fc.property(
      rowsArb,
      fc.constantFrom('', 'kenji', 'JUNE', '1', 'x', ' 9 '),
      fc.nat(),
      fc.boolean(),
      ({ w, rs }, query, col, descending) => {
        const column = col % (w + 1);
        // A column is numeric for every row or for none, as in a list from core.
        const numeric = rs[0]?.numeric[column] ?? false;
        const rows = rs.map((r) => ({
          cells: r.cells,
          keys: r.cells.map((c, i): ListKey =>
            c === '' ? null : i === column && numeric && Number.isFinite(Number(c)) ? Number(c) : c,
          ),
        }));
        // Spec 19 R3: the column Find skips (Failed checks) is now named, here the last.
        const kinds = rows[0]?.cells.map((_c, i) => (i === column && numeric ? 'number' : 'text'));
        const text = searchText(rows, w, kinds);
        const shown = findRows(rows, text, query, { column, descending });
        const q = query.trim().toLowerCase();
        const expected = rows
          .map((r, i) => i)
          .filter(
            (i) =>
              q === '' ||
              rows[i]!.cells.slice(0, -1).some((c) => c.toLowerCase().includes(q)) ||
              (numeric &&
                column !== w &&
                rows[i]!.keys[column] !== null &&
                String(rows[i]!.keys[column]).toLowerCase().includes(q)),
          );
        expect([...shown].sort((a, b) => a - b)).toEqual(expected);
        for (let k = 1; k < shown.length; k++) {
          const a = rows[shown[k - 1]!]!.keys[column]!;
          const b = rows[shown[k]!]!.keys[column]!;
          if (b === null) continue;
          expect(a).not.toBeNull();
          const c =
            typeof a === 'number' && typeof b === 'number'
              ? Math.sign(a - b)
              : typeof a === 'number'
                ? -1
                : typeof b === 'number'
                  ? 1
                  : new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare(
                      String(a),
                      String(b),
                    );
          const d = descending ? -c : c;
          expect(d).toBeLessThanOrEqual(0);
          if (d === 0) expect(shown[k - 1]!).toBeLessThan(shown[k]!);
        }
        // The walk: Next from the first visits each in turn; Previous from the last comes back.
        const forward = shown.slice(0, 1);
        for (let x = shown[0]; x !== undefined && (x = walkStep(shown, x, 1)) !== undefined;)
          forward.push(x);
        expect(forward).toEqual(shown);
        const back = shown.slice(-1);
        for (let x = shown.at(-1); x !== undefined && (x = walkStep(shown, x, -1)) !== undefined;)
          back.push(x);
        expect(back).toEqual([...shown].reverse());
      },
    ),
    { numRuns: 200 },
  );
});

// Spec 19 R2: Find looks inside repeating rows, and says where a match is off screen.
test('R2: a match in a repeating row is found, and its place is named', async () => {
  const { whereFound } = await import('../src/records/find');
  const rows = [
    { cells: ['a.xml', 'None', 'Kenji'], keys: ['a.xml', 0, 'Kenji'], more: ['Type: Lodging'] },
    { cells: ['b.xml', 'None', 'Lodge'], keys: ['b.xml', 0, 'Lodge'], more: [] },
  ];
  const text = searchText(rows, 1);
  expect(findRows(rows, text, 'lodging')).toEqual([0]);
  expect(findRows(rows, text, 'none')).toEqual([]);
  expect(whereFound(rows[0]!, 'lodging', 1)).toBe('Type: Lodging');
  expect(whereFound(rows[1]!, 'lodge', 1)).toBeUndefined();
});

// Spec 28 R1: a number or date column also matches on the value the record stores.
test('spec 28 R1: Find matches a number or a date as stored, text as shown', () => {
  const kinds = ['text', 'checks', 'number', 'date', 'text'] as const;
  const rows = [
    {
      cells: ['04-purchase-request-001.xml', 'None', '$1,423.94', '5/13/2026', 'Yes'],
      keys: ['04-purchase-request-001.xml', 0, 1423.94, '2026-05-13', 'true'] as ListKey[],
    },
  ];
  const text = searchText(rows, 1, kinds);
  const count = (q: string) => findRows(rows, text, q).length;
  for (const [q, n] of [
    ['$1,423.94', 1],
    ['1,423.94', 1],
    ['1423.94', 1],
    ['1423', 1],
    ['5/13/2026', 1],
    ['2026-05-13', 1],
    ['true', 0],
  ] as const)
    expect(count(q), q).toBe(n);
});
