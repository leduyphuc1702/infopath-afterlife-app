import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { triageFiles, type TriageRow } from '../../src/index';
import { readSample, repoRoot, sampleCabinets } from '../helpers/samples';

// Spec 12 R3.1–R3.4, R6.1 on forms 01–08 and their records; a golden reviewed once.
const OWN = `${repoRoot}samples/own/`;
const xsn = (slug: string) => ({ name: `${slug}.xsn`, bytes: readSample(`${OWN}xsn/${slug}.xsn`) });
const recordsOf = (slug: string) =>
  readdirSync(`${OWN}records/${slug}/`)
    .filter((f) => !f.endsWith('-000-empty.xml'))
    .map((f) => ({ name: f, bytes: new Uint8Array(readFileSync(`${OWN}records/${slug}/${f}`)) }));
const OWN_08 = sampleCabinets()
  .map((c) => c.slug)
  .filter((s) => /^0[1-8]-/.test(s));

/** What the golden fixes: no evidence locations (the causes tests own those). */
const brief = (r: TriageRow) => ({
  file: r.fileName,
  name: r.name,
  wave: r.wave,
  coverage: Object.values(r.coverage).join(' '),
  nativePercent: r.nativePercent ?? null,
  records: r.records ?? null,
  counts: Object.values(r.counts).join(' '),
  causes: r.causes.map((c) => c.id).join(' '),
});

test('R3.1, R3.3, R3.4: forms 01–08 with their 153 records', async () => {
  const res = await triageFiles([...OWN_08.map(xsn), ...OWN_08.flatMap(recordsOf)]);
  expect(res.totals).toMatchObject({ forms: 8, errors: 0 });
  const rows = res.rows as TriageRow[];
  expect(rows.reduce((n, r) => n + (r.records ?? 0), 0)).toBe(153);
  await expect(`${JSON.stringify(rows.map(brief), null, 2)}\n`).toMatchFileSnapshot(
    '../golden/triage/forms-01-08.json',
  );
  // Order: wave, then records descending, then name.
  for (let i = 1; i < rows.length; i++) {
    const [a, b] = [rows[i - 1]!, rows[i]!];
    expect(a.wave <= b.wave, `${a.name} / ${b.name}`).toBe(true);
    if (a.wave === b.wave) expect(a.records! >= b.records!, `${a.name} / ${b.name}`).toBe(true);
  }
});

test('R6.1: without records the count is unknown, not 0; with any record, unmatched forms get 0', async () => {
  const none = await triageFiles(['01-leave-request', '05-new-hire-onboarding'].map(xsn));
  expect((none.rows as TriageRow[]).map((r) => r.records)).toEqual([undefined, undefined]);
  const some = await triageFiles([
    ...['01-leave-request', '05-new-hire-onboarding'].map(xsn),
    ...recordsOf('05-new-hire-onboarding').slice(0, 2),
  ]);
  expect(Object.fromEntries((some.rows as TriageRow[]).map((r) => [r.name, r.records]))).toEqual({
    'Leave Request': 0,
    'New Hire Onboarding': 2,
  });
});

test('R3.2: a truncated template is an error row with its code, after the forms; the batch continues', async () => {
  const whole = xsn('02-expense-report');
  const res = await triageFiles([
    xsn('01-leave-request'),
    { name: '02-truncated.xsn', bytes: whole.bytes.subarray(0, 300) },
    xsn('03-travel-request'),
  ]);
  expect(res.rows.map((r) => r.kind)).toEqual(['form', 'form', 'error']);
  expect(res.rows[2]).toEqual({ kind: 'error', fileName: '02-truncated.xsn', code: 'CORRUPT_CAB' });
  expect(res.totals).toMatchObject({ forms: 2, errors: 1 });
});

test('R3.4: unknown record counts sort last within a wave; ties by name, then file name', async () => {
  const a = xsn('06-safety-incident');
  const res = await triageFiles([
    { name: 'b-copy.xsn', bytes: a.bytes },
    { name: 'a-copy.xsn', bytes: a.bytes },
    { name: 'a-copy.xsn', bytes: a.bytes },
  ]);
  expect((res.rows as TriageRow[]).map((r) => [r.fileName, r.templateId])).toEqual([
    ['a-copy.xsn', 'a-copy.xsn'],
    ['a-copy.xsn', 'a-copy.xsn#2'],
    ['b-copy.xsn', 'b-copy.xsn'],
  ]);
});

test('Native % is rounded down and counts are of the main data source', async () => {
  const res = await triageFiles([xsn('04-purchase-request')]);
  const r = res.rows[0] as TriageRow;
  const total = Object.values(r.coverage).reduce((n, x) => n + x, 0);
  expect(r.nativePercent).toBe(Math.floor((r.coverage.native * 100) / total));
  expect(r.counts.connections).toBe(2);
});
