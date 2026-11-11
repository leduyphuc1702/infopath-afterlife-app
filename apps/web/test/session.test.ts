import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import type { InputFile } from '../src/worker/protocol';
import { readZip, writeZip } from '@afterlife/core';
import { Session, toWireError } from '../src/worker/session';

// Spec 13 B3, P16: a file whose bytes are already open is not added again, templates and
// records alike; the answer names it, with the template it already is.

const OWN = new URL('../../../samples/own/', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, OWN));
const FILES = {
  '02-expense-report.xsn': read('xsn/02-expense-report.xsn'),
  '03-travel-request.xsn': read('xsn/03-travel-request.xsn'),
  '02-expense-report-001.xml': read('records/02-expense-report/02-expense-report-001.xml'),
  '02-expense-report-002.xml': read('records/02-expense-report/02-expense-report-002.xml'),
};
type Name = keyof typeof FILES;
const input = (name: Name, as: string = name): InputFile => {
  const b = FILES[name];
  return { name: as, bytes: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) };
};

describe('B3: the same bytes twice', () => {
  test('one template, and the second open names it as already open', async () => {
    const s = new Session();
    const first = await s.open([input('02-expense-report.xsn')]);
    const again = await s.open([input('02-expense-report.xsn')]);
    expect(again.templates).toHaveLength(1);
    expect(again.duplicates).toEqual([
      { fileName: '02-expense-report.xsn', templateId: first.templates[0]!.templateId },
    ]);
  });

  test('a record under another name is still the same file', async () => {
    const s = new Session();
    await s.open([input('02-expense-report-001.xml')]);
    const again = await s.open([input('02-expense-report-001.xml', 'copy of 001.xml')]);
    expect(again.records).toHaveLength(1);
    expect(again.duplicates).toEqual([{ fileName: 'copy of 001.xml' }]);
  });
});

test('P16: any files with repeats, in any order and batches: each distinct file once', async () => {
  const names = Object.keys(FILES) as Name[];
  await fc.assert(
    fc.asyncProperty(
      fc.array(fc.constantFrom(...names), { minLength: 1, maxLength: 8 }),
      fc.array(fc.nat(7), { maxLength: 3 }),
      async (list, cuts) => {
        const s = new Session();
        const at = [...new Set(cuts.map((c) => c % list.length))].sort((a, b) => a - b);
        const batches = [0, ...at, list.length]
          .slice(0, -1)
          .map((from, i, a) => list.slice(from, a[i + 1] ?? list.length));
        let last = await s.open([]);
        let dups = 0;
        for (const b of batches) {
          last = await s.open(b.map((n) => input(n)));
          dups += last.duplicates.length;
        }
        const distinct = [...new Set(list)].sort();
        expect(last.templates.map((t) => t.fileName).sort()).toEqual(
          distinct.filter((n) => n.endsWith('.xsn')),
        );
        expect(last.records.map((r) => r.fileName).sort()).toEqual(
          distinct.filter((n) => n.endsWith('.xml')),
        );
        expect(dups).toBe(list.length - distinct.length);
      },
    ),
    { numRuns: 25 },
  );
});

describe('spec 09 R12.8: a .zip opens as if its .xsn and .xml files were dropped', () => {
  const zipOf = async (entries: { name: string; bytes: Uint8Array }[], name = 'lib.zip') => {
    const z = await writeZip(entries);
    return { name, bytes: z.buffer };
  };
  const b = (n: Name) => new Uint8Array(FILES[n]);

  test('folders walked; other entries and nested zips listed; copies inside are duplicates', async () => {
    const s = new Session();
    const res = await s.open([
      await zipOf([
        { name: 'Forms/02-expense-report.xsn', bytes: b('02-expense-report.xsn') },
        { name: 'Claims/2025/02-expense-report-001.xml', bytes: b('02-expense-report-001.xml') },
        { name: 'Claims/again.xml', bytes: b('02-expense-report-001.xml') },
        { name: 'notes.txt', bytes: new Uint8Array([1]) },
        { name: 'inner.zip', bytes: new Uint8Array([1]) },
      ]),
    ]);
    expect(res.templates.map((t) => t.fileName)).toEqual(['02-expense-report.xsn']);
    expect(res.records.map((r) => [r.fileName, r.match.kind])).toEqual([
      ['02-expense-report-001.xml', 'exact'],
    ]);
    expect(res.duplicates.map((d) => d.fileName)).toEqual(['again.xml']);
    expect(res.ignored).toEqual(['lib.zip › notes.txt', 'lib.zip › inner.zip']);
  });

  test('a damaged zip is one failure under its name; the other files still open', async () => {
    const s = new Session();
    const res = await s.open([
      { name: 'broken.zip', bytes: new TextEncoder().encode('PK no').buffer },
      input('03-travel-request.xsn'),
    ]);
    expect(res.templates).toHaveLength(1);
    expect(res.failures.map((f) => [f.fileName, f.error.code])).toEqual([
      ['broken.zip', 'CORRUPT_ZIP'],
    ]);
  });

  test('exportRecords: the open template matched records, named after the template', async () => {
    const s = new Session();
    const res = await s.open([
      input('02-expense-report.xsn'),
      input('02-expense-report-001.xml'),
      input('02-expense-report-002.xml'),
    ]);
    const steps: number[] = [];
    const out = await s.exportRecords(res.templates[0]!.templateId, 'csv', (p) =>
      steps.push(p.index),
    );
    expect([out.fileName, out.records, out.unread]).toEqual([
      '02-expense-report-records.zip',
      2,
      0,
    ]);
    expect(steps).toEqual([1, 2]);
    const records = readZip(new Uint8Array(out.bytes)).find((e) => e.name === 'Records.csv')!;
    expect(new TextDecoder().decode(await records.read()).split('\r\n')).toHaveLength(4);
  });
});

describe('spec 04 task 5: fill through the Worker session', () => {
  const NOW = '2026-11-11T09:00:00+07:00';
  const AMOUNT = '/my:expenseClaim[1]/my:expenses[1]/my:expense[1]/my:amount[1]';
  const TOTAL = '/my:expenseClaim[1]/my:totalAmount[1]';

  test('empty form: edit, the total and the render follow; download matches the template', async () => {
    const s = new Session();
    const res = await s.open([input('02-expense-report.xsn')]);
    const id = res.templates[0]!.templateId;
    const view = res.templates[0]!.ir.views[0]!.name;
    const opened = await s.fillOpen(id, undefined, view, NOW);
    expect([opened.dirty, opened.workedOut]).toEqual([false, 0]);
    expect(opened.calculated).toEqual([TOTAL]);
    expect(opened.invalid.map((i) => i.short)).toContain('Cannot be blank');
    const a = await s.fill({ kind: 'edit', path: AMOUNT, value: '12.5' }, view, NOW);
    expect([a.values[AMOUNT], a.values[TOTAL], a.dirty]).toEqual(['12.5', '12.5', true]);
    expect(a.html).toContain('$12.50');
    expect(a.ms).toBeGreaterThan(0);
    const d = s.fillDownload();
    expect(d.fileName).toBe('02-expense-report-new.xml');
    const xml = new TextDecoder().decode(d.bytes);
    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<\?mso-infoPathSolution /);
    const back = await s.open([{ name: d.fileName, bytes: d.bytes }]);
    expect(back.records.find((r) => r.fileName === d.fileName)?.match).toEqual({
      kind: 'exact',
      templateId: id,
    });
    expect((await s.fill({ kind: 'render' }, view, NOW)).dirty).toBe(false);
  });

  test('a bad path is FILL_PATH; no session or another version is FILL_STATE', async () => {
    const s = new Session();
    const res = await s.open([input('02-expense-report.xsn'), input('02-expense-report-001.xml')]);
    const id = res.templates[0]!.templateId;
    const view = res.templates[0]!.ir.views[0]!.name;
    await expect(s.fill({ kind: 'render' }, view, NOW)).rejects.toMatchObject({
      code: 'FILL_STATE',
    });
    await s.fillOpen(id, res.records[0]!.recordId, view, NOW);
    const err = await s
      .fill({ kind: 'edit', path: TOTAL, value: '1' }, view, NOW)
      .catch((e: unknown) => e);
    expect(toWireError(err)).toEqual({
      code: 'FILL_PATH',
      details: { path: TOTAL, reason: 'calculated' },
    });
    await expect(s.fillOpen(id, 'nope', view, NOW)).rejects.toMatchObject({ code: 'FILL_STATE' });
  });
});

describe('spec 15: documentation through the Worker session', () => {
  test('one dossier, and a zip with index.md and one Markdown file per form', async () => {
    const s = new Session();
    const res = await s.open([
      input('02-expense-report.xsn'),
      input('03-travel-request.xsn'),
      input('02-expense-report-001.xml'),
    ]);
    const [a, b] = res.templates.map((t) => t.templateId);
    const d = s.documentation(a!);
    expect(d.fileName).toBe('02-expense-report-documentation.md');
    expect(d.markdown.split('\n')[0]).toBe('# Expense Report: form documentation');
    expect(d.dossier.about.find((x) => x.label === 'Records loaded')?.value).toBe('1');
    const zip = await s.documentationZip([a!, b!]);
    const entries = readZip(new Uint8Array(zip.bytes));
    expect(entries.map((e) => e.name)).toEqual([
      'index.md',
      '02-expense-report-documentation.md',
      '03-travel-request-documentation.md',
    ]);
    const index = new TextDecoder().decode(await entries[0]!.read());
    expect(index).toContain('- Expense Report: `02-expense-report-documentation.md`');
  });
});
