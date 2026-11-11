import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DOMParser } from '@xmldom/xmldom';
import { expect, test } from 'vitest';
import {
  ATTACHMENT_NOTE,
  embedded,
  exportRecords,
  readZip,
  recordTables,
  safeSegment,
  type Sheet,
} from '../../src/index';
import { irOf, recordsOf } from './records';

// Spec 09 R12.1–R12.4: record tables, attachments, the workbook and the zip of CSVs.
const col = (s: Sheet, path: string) => s.columns.indexOf(path);

test('form 02: one row per record, the expense sheet keyed by record and row, receipts as paths', async () => {
  const ir = await irOf('02-expense-report');
  const recs = recordsOf('02-expense-report');
  const t = recordTables(ir, recs);
  const [main, expense] = t.sheets;
  expect(t.sheets.map((s) => s.name)).toEqual(['Records', 'expense']);
  expect(main!.rows).toHaveLength(30);
  expect(main!.columns.slice(0, 3)).toEqual([
    'Record file',
    'Template version',
    '/my:expenseClaim/my:claimant/my:claimantName',
  ]);
  expect(expense!.columns.slice(0, 2)).toEqual(['Record file', 'Row']);
  const r3 = main!.rows.find((r) => r[0] === '02-expense-report-003.xml')!;
  expect(r3[1]).toBe('1.0.0.1');
  expect(r3[col(main!, '/my:expenseClaim/my:claimant/my:claimantName')]).toBe('Ivo Corvin');
  const first = expense!.rows.find((r) => r[0] === '02-expense-report-003.xml')!;
  expect(first[1]).toEqual({ number: '1' });
  expect(first[col(expense!, '/my:expenseClaim/my:expenses/my:expense/my:amount')]).toEqual({
    number: '107.12',
  });
  expect(first[col(expense!, '/my:expenseClaim/my:expenses/my:expense/my:expenseDate')]).toBe(
    '2025-09-20',
  );
  const receipt = first[col(expense!, '/my:expenseClaim/my:expenses/my:expense/my:receipt')];
  expect(receipt).toBe('attachments/02-expense-report-003/receipt/receipt-03-1.txt');
  const file = t.files.find((f) => f.path === receipt)!;
  expect(new TextDecoder().decode(file.bytes)).toMatch(/^RECEIPT\nMetro Rail\n/);
  expect(t.unread).toEqual([]);
});

test('form 06: nested follow-ups carry their person row; rich text is plain; the photo is a picture', async () => {
  const t = recordTables(await irOf('06-safety-incident'), recordsOf('06-safety-incident'));
  expect(t.sheets.map((s) => s.name)).toEqual(['Records', 'person', 'followUp']);
  expect(t.sheets[2]!.columns.slice(0, 3)).toEqual(['Record file', 'Row', 'Parent row']);
  const main = t.sheets[0]!;
  const r4 = main.rows.find((r) => r[0] === '06-safety-incident-004.xml')!;
  expect(r4[col(main, '/my:incidentReport/my:incidentDescription')]).toBe(
    'Incident at 08:32. Fictional test record.',
  );
  expect(r4[col(main, '/my:incidentReport/my:scenePhoto')]).toBe(
    'attachments/06-safety-incident-004/scenePhoto/picture-1.png',
  );
  const persons = t.sheets[1]!.rows.filter((r) => r[0] === '06-safety-incident-004.xml');
  const follow = t.sheets[2]!.rows.filter((r) => r[0] === '06-safety-incident-004.xml');
  for (const f of follow)
    expect(Number((f[2] as { number: string }).number)).toBeLessThanOrEqual(persons.length);
});

test('names are made safe; collisions get a suffix; non-base64 is not a file', () => {
  expect(safeSegment('../..\\etc/passwd')).toBe('_.._etc_passwd');
  expect(safeSegment('a\u0000b:c.txt')).toBe('a_b_c.txt');
  expect(safeSegment('CON.txt')).toBe('_CON.txt');
  expect(safeSegment(`${'x'.repeat(300)}.pdf`)).toHaveLength(100);
  expect(embedded('not base64!')).toBeUndefined();
  expect(embedded('')).toBeUndefined();
});

const xmlOf = (bytes: Uint8Array) => {
  const errors: string[] = [];
  const doc = new DOMParser({ onError: (_l, m) => errors.push(m) }).parseFromString(
    new TextDecoder().decode(bytes),
    'text/xml',
  );
  expect(errors).toEqual([]);
  return doc;
};

test('the workbook: well formed, rows × columns cells, shared strings resolve, the note', async () => {
  const ir = await irOf('02-expense-report');
  const recs = recordsOf('02-expense-report');
  const t = recordTables(ir, recs);
  const out = await exportRecords(ir, recs, { format: 'xlsx' });
  const parts = new Map<string, Uint8Array>();
  for (const e of readZip(out.bytes)) parts.set(e.name, await e.read());
  for (const [name, bytes] of parts)
    if (name.endsWith('.xml') || name.endsWith('.rels')) xmlOf(bytes);
  const strings = [...xmlOf(parts.get('xl/sharedStrings.xml')!).getElementsByTagName('si')].map(
    (si) => si.textContent ?? '',
  );
  const sheets = [...t.sheets, { columns: ['Note'], rows: [[ATTACHMENT_NOTE]] }];
  for (const [i, s] of sheets.entries()) {
    const doc = xmlOf(parts.get(`xl/worksheets/sheet${i + 1}.xml`)!);
    const cells = [...doc.getElementsByTagName('c')];
    expect(cells).toHaveLength((s.rows.length + 1) * s.columns.length);
    for (const c of cells)
      if (c.getAttribute('t') === 's') {
        const v = Number(c.getElementsByTagName('v')[0]!.textContent);
        expect(v).toBeLessThan(strings.length);
      }
  }
  expect(strings).toContain('attachments/02-expense-report-003/receipt/receipt-03-1.txt');
  expect(strings).toContain(ATTACHMENT_NOTE);
  expect(out.files).toBeGreaterThan(0);
});

test('the zip of CSVs: BOM, CRLF, one file per sheet and the attachments', async () => {
  const recs = recordsOf('02-expense-report');
  const out = await exportRecords(await irOf('02-expense-report'), recs, { format: 'csv' });
  const names = readZip(out.bytes).map((e) => e.name);
  expect(names.slice(0, 2)).toEqual(['Records.csv', 'expense.csv']);
  expect(names).toContain('attachments/02-expense-report-003/receipt/receipt-03-1.txt');
  const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(
    await readZip(out.bytes)[0]!.read(),
  );
  expect(text.startsWith('\ufeffRecord file,Template version,')).toBe(true);
  expect(text.split('\r\n')).toHaveLength(32);
});

test('the system unzip -t accepts both exports (skipped without unzip)', async (ctx) => {
  try {
    execFileSync('unzip', ['-v'], { stdio: 'ignore' });
  } catch {
    ctx.skip();
  }
  const dir = mkdtempSync(join(tmpdir(), 'afl-export-'));
  const ir = await irOf('06-safety-incident');
  for (const format of ['xlsx', 'csv'] as const) {
    const file = join(dir, `x.${format === 'csv' ? 'zip' : 'xlsx'}`);
    writeFileSync(
      file,
      (await exportRecords(ir, recordsOf('06-safety-incident'), { format })).bytes,
    );
    expect(execFileSync('unzip', ['-t', file]).toString()).toContain('No errors detected');
  }
});

test('a record that is not XML keeps its row, with the reason in a last column', async () => {
  const ir = await irOf('02-expense-report');
  const bad = { fileName: 'bad.xml', bytes: new TextEncoder().encode('<a') };
  const out = await exportRecords(ir, [...recordsOf('02-expense-report').slice(0, 1), bad], {
    format: 'csv',
  });
  expect(out.unread.map((u) => u.fileName)).toEqual(['bad.xml']);
  const text = new TextDecoder().decode(await readZip(out.bytes)[0]!.read());
  expect(text.split('\r\n')[0]).toMatch(/,Read error$/);
});

test('a damaged attachment header is kept as data; bytes with no known magic too', () => {
  const header = Uint8Array.from(atob('x0lGQRQAAAABAAAAAAAAAGIAAAARAAAA'), (c) => c.charCodeAt(0));
  const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
  expect(embedded(b64(header))?.kind).toBe('data');
  expect(embedded(b64(new Uint8Array([1, 2, 3, 4, 5, 6])))?.kind).toBe('data');
  expect(embedded(b64(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0])))).toMatchObject({
    kind: 'picture',
    ext: 'png',
  });
});
