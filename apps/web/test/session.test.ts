import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import type { InputFile } from '../src/worker/protocol';
import { Session } from '../src/worker/session';

// Spec 13 B3, P12: a file whose bytes are already open is not added again, templates and
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

test('P12: any files with repeats, in any order and batches: each distinct file once', async () => {
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
