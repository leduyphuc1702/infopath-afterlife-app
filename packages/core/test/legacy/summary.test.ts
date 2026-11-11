import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { buildFormIR, parseXsn, recordList, summarize, summaryColumns } from '../../src/index';
import type { Summary } from '../../src/index';
import { recordsOf } from './records';

// Spec 20: form 02's 30 records, the two questions of the brief.
const OWN = new URL('../../../../samples/own/', import.meta.url);
const NOW = '2026-11-11T09:00:00';
const list02 = async () => {
  const t = await parseXsn(readFileSync(new URL('xsn/02-expense-report.xsn', OWN)));
  return recordList(t, buildFormIR(t), recordsOf('02-expense-report'), NOW);
};
const table = (s: Summary) => [
  ...s.lines.map((l) => [l.label, l.count, l.sum, l.average]),
  ['All', s.all.count, s.all.sum, s.all.average],
];
const at = (cols: readonly { label: string }[], label: string) => {
  const i = cols.findIndex((c) => c.label === label);
  expect(i, label).toBeGreaterThanOrEqual(0);
  return i;
};

test('R2, R4, R6: Total by Department, records counted, in the view’s currency format', async () => {
  const list = await list02();
  const cols = summaryColumns(list, -1);
  const all = list.rows.map((_, i) => i);
  const s = summarize(
    list,
    { unit: -1, by: at(cols, 'Department'), total: at(cols, 'Total') },
    all,
  );
  expect(s.counted).toBe('30 records');
  console.log(JSON.stringify(table(s)));
  expect(s.lines.reduce((n, l) => n + l.count, 0)).toBe(30);
  expect(s.lines.map((l) => l.label)).toContain('Sales');
  expect(s.all.sum).toMatch(/^\$[\d,]+\.\d\d$/);
  expect(s.csv.split('\r\n')[0]).toBe('Department,Count (records),Sum of Total,Average of Total');
});

test('R5: Amount by Expense type counts every expense row of the records found', async () => {
  const list = await list02();
  const unit = list.parts.findIndex((p) => p.label === 'Expense');
  expect(unit).toBeGreaterThanOrEqual(0);
  const cols = summaryColumns(list, unit);
  const all = list.rows.map((_, i) => i);
  const s = summarize(list, { unit, by: at(cols, 'Type'), total: at(cols, 'Amount') }, all);
  console.log(s.counted, JSON.stringify(table(s)));
  expect(s.counted).toMatch(/^\d+ Expense rows in 30 records$/);
  expect(s.lines.map((l) => l.label)).toContain('Lodging');
  const lodging = s.lines.find((l) => l.label === 'Lodging')!;
  expect(lodging.records.length).toBe(15); // the reviewer's Find "lodging": 15 of 30
  // R8: sorted by sum, largest first.
  const bySum = summarize(
    list,
    {
      unit,
      by: at(cols, 'Type'),
      total: at(cols, 'Amount'),
      sort: { column: 'sum', descending: true },
    },
    all,
  );
  expect(bySum.lines[0]!.bar).toBe(1);
  expect(bySum.csv.split('\r\n')[1]!.startsWith(bySum.lines[0]!.label + ',')).toBe(true);
});

test('R2, R3: dates by year and month; more than 50 values says so', async () => {
  const list = await list02();
  const unit = list.parts.findIndex((p) => p.label === 'Expense');
  const cols = summaryColumns(list, unit);
  const all = list.rows.map((_, i) => i);
  const date = at(cols, 'Date');
  const y = summarize(list, { unit, by: date, dates: 'year' }, all);
  expect(y.lines.every((l) => /^\d{4}$/.test(l.label))).toBe(true);
  const m = summarize(list, { unit, by: date, dates: 'month' }, all);
  expect(m.lines.every((l) => /^[A-Z][a-z]+ \d{4}$/.test(l.label))).toBe(true);
  // Form 02 has no column with more than 50 values; 51 made-up records do.
  const many = {
    columns: [{ label: 'File name', kind: 'text' as const }],
    rows: Array.from({ length: 51 }, (_, i) => ({
      fileName: `${i}`,
      cells: [`${i}`],
      keys: [`${i}`],
      more: [],
    })),
    parts: [],
  };
  const desc = summarize(
    many,
    { unit: -1, by: 0 },
    many.rows.map((_, i) => i),
  );
  expect(desc.tooMany).toBe(51);
  expect(desc.lines).toEqual([]);
  expect(
    summarize(
      many,
      { unit: -1, by: 0 },
      many.rows.slice(1).map((_, i) => i),
    ).lines,
  ).toHaveLength(50);
});

test('R9: a group label that looks like a formula is guarded in the CSV', () => {
  const list = {
    columns: [
      { label: 'File name', kind: 'text' as const },
      { label: 'Note', kind: 'text' as const },
    ],
    rows: [
      {
        fileName: 'a.xml',
        cells: ['a.xml', '=HYPERLINK("x")'],
        keys: ['a.xml', '=HYPERLINK("x")'],
        more: [],
      },
    ],
    parts: [],
  };
  const s = summarize(list, { unit: -1, by: 1 }, [0]);
  expect(s.csv.split('\r\n')[1]).toBe(`"'=HYPERLINK(""x"")",1`);
});

test('spec 22 S3: what is counted carries thousands separators; the CSV keeps raw numbers', () => {
  const rows = Array.from({ length: 1234 }, (_, i) => ({
    fileName: `${i}`,
    cells: [`${i}`, 'A'],
    keys: [`${i}`, 'A'],
    more: [],
  }));
  const list = {
    columns: [
      { label: 'File name', kind: 'text' as const },
      { label: 'Kind', kind: 'text' as const },
    ],
    rows,
    parts: [],
  };
  const s = summarize(
    list,
    { unit: -1, by: 1 },
    rows.map((_, i) => i),
  );
  expect(s.counted).toBe('1,234 records');
  expect(s.csv.split('\r\n')[1]).toBe('A,1234');
});
