import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import type { InputFile } from '../src/worker/protocol';
import { readZip, writeZip } from '@afterlife/core';
import { Session } from '../src/worker/session';

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
