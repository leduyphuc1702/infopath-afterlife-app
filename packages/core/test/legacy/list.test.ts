import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { buildFormIR, parseXsn, recordList, recordTables } from '../../src/index';
import { recordsOf, slugsWithRecords } from './records';

// Spec 17 R2–R4, R12: the records list.
const OWN = new URL('../../../../samples/own/', import.meta.url);
const open = async (slug: string) => {
  const t = await parseXsn(readFileSync(new URL(`xsn/${slug}.xsn`, OWN)));
  return { t, ir: buildFormIR(t) };
};
const NOW = '2026-11-11T09:00:00';

test('R2, R3: form 02 has the Records sheet columns, a count of expenses, formatted values', async () => {
  const { t, ir } = await open('02-expense-report');
  const recs = recordsOf('02-expense-report');
  const list = recordList(t, ir, recs, NOW);
  const sheet = recordTables(ir, recs).sheets[0]!;
  expect(list.columns.slice(2, sheet.columns.length).map((c) => c.path)).toEqual(
    sheet.columns.slice(2),
  );
  expect(list.columns.slice(0, 2).map((c) => c.label)).toEqual(['File name', 'Template version']);
  expect(list.columns.at(-1)).toEqual({ label: 'Failed checks', kind: 'checks' });
  expect(list.columns.filter((c) => c.kind === 'count').map((c) => c.label)).toEqual([
    'Expense (rows)',
  ]);
  expect(list.rows).toHaveLength(30);
  const total = list.columns.findIndex((c) => c.path?.endsWith('my:totalAmount'));
  const r = list.rows[0]!;
  expect(r.cells[total]).toMatch(/^\$[\d,]+\.\d\d$/);
  expect(typeof r.keys[total]).toBe('number');
  const leave = await open('01-leave-request');
  const l = recordList(leave.t, leave.ir, recordsOf('01-leave-request'), NOW);
  const date = l.columns.findIndex((c) => c.kind === 'date');
  expect(l.rows[0]!.cells[date]).toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
  expect(l.rows[0]!.keys[date]).toMatch(/^\d{4}-\d\d-\d\d/);
  console.log('R2 form 02 columns:', list.columns.map((c) => c.label).join(' | '));
  console.log('R2 form 02 row 1:', r.cells.join(' | '));
});

test('R4: failed checks match what Fill shows; form 10 record 1 has some', async () => {
  const { t, ir } = await open('10-timesheet');
  const list = recordList(t, ir, recordsOf('10-timesheet'), NOW);
  const checks = list.rows.map((r) => r.keys.at(-1));
  expect(checks[0]).toBeGreaterThan(0);
  expect(list.rows[0]!.cells.at(-1)).toBe(String(checks[0]));
});

test('R2, R12: every form with records gives one row per record, text cells, keys in step', async () => {
  for (const slug of slugsWithRecords()) {
    const { t, ir } = await open(slug);
    const recs = recordsOf(slug);
    const list = recordList(t, ir, recs, NOW);
    expect(
      list.rows.map((r) => r.fileName),
      slug,
    ).toEqual(recs.map((r) => r.fileName));
    for (const r of list.rows) {
      expect(r.cells).toHaveLength(list.columns.length);
      expect(r.keys).toHaveLength(list.columns.length);
      for (const c of r.cells) expect(typeof c).toBe('string');
    }
  }
});
