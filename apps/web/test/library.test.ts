import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { readZip } from '@afterlife/core';
import type { InputFile } from '../src/worker/protocol';
import { Session, type Shelf, type ShelfFile } from '../src/worker/session';

// The library: what the session keeps between visits, takes out, and saves from Fill.
// Not written by Kiro (README, "What Kiro did not write").

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
const NOW = '2026-11-13T21:04:05+07:00';
const AMOUNT = '/my:expenseClaim[1]/my:expenses[1]/my:expense[1]/my:amount[1]';

/** A shelf in memory, as IndexedDB keeps it: one file per hash. */
function memoryShelf(broken = false): Shelf & { readonly files: Map<string, ShelfFile> } {
  const files = new Map<string, ShelfFile>();
  const fail = () => Promise.reject(new Error('no storage'));
  return {
    files,
    all: () => (broken ? fail() : Promise.resolve([...files.values()])),
    put: (list) => {
      if (broken) return fail();
      for (const f of list) files.set(f.hash, f);
      return Promise.resolve();
    },
    remove: (hashes) => {
      if (broken) return fail();
      for (const h of hashes) files.delete(h);
      return Promise.resolve();
    },
  };
}

const ALL = [
  input('02-expense-report.xsn'),
  input('03-travel-request.xsn'),
  input('02-expense-report-001.xml'),
  input('02-expense-report-002.xml'),
];
const names = (r: { templates: readonly { fileName: string }[] }) =>
  r.templates.map((t) => t.fileName);

describe('the library is kept between visits', () => {
  test('files opened in one session come back in the next, matched as before', async () => {
    const shelf = memoryShelf();
    const first = await new Session(shelf).open(ALL);
    expect(first.kept).toBe(true);
    expect(shelf.files.size).toBe(4);

    const again = await new Session(shelf).restore();
    expect(again.kept).toBe(true);
    expect(names(again)).toEqual(names(first));
    expect(again.records.map((r) => [r.fileName, r.match.kind])).toEqual(
      first.records.map((r) => [r.fileName, r.match.kind]),
    );
    expect(again.triage.totals.forms).toBe(2);
    expect(again.templates.every((t) => typeof t.at === 'number')).toBe(true);
    // The page keeps ids: a Worker started again reads the same files under the same ids.
    const ids = (r: typeof first) => [
      ...r.templates.map((t) => [t.fileName, t.templateId]),
      ...r.records.map((x) => [x.fileName, x.recordId]),
    ];
    expect(ids(again)).toEqual(ids(first));
    expect(new Set(ids(first).map(([, id]) => id)).size).toBe(4);
  });

  test('a restore twice adds nothing, and a file dropped again is still a duplicate', async () => {
    const shelf = memoryShelf();
    await new Session(shelf).open(ALL);
    const s = new Session(shelf);
    await s.restore();
    expect((await s.restore()).templates).toHaveLength(2);
    const dropped = await s.open([input('02-expense-report.xsn', 'copy.xsn')]);
    expect(dropped.templates).toHaveLength(2);
    expect(dropped.duplicates.map((d) => d.fileName)).toEqual(['copy.xsn']);
    expect(shelf.files.size).toBe(4);
  });

  test('a file that does not read is not kept', async () => {
    const shelf = memoryShelf();
    const res = await new Session(shelf).open([
      { name: 'broken.xsn', bytes: new TextEncoder().encode('not a cabinet').buffer },
      input('03-travel-request.xsn'),
    ]);
    expect(res.failures.map((f) => f.fileName)).toEqual(['broken.xsn']);
    expect([...shelf.files.values()].map((f) => f.name)).toEqual(['03-travel-request.xsn']);
  });

  test('a kept file that no longer reads is named, and the rest come back', async () => {
    const shelf = memoryShelf();
    await new Session(shelf).open(ALL);
    shelf.files.set('bad', {
      hash: 'bad',
      id: 'tbad',
      name: 'old.xsn',
      bytes: new Uint8Array(4),
      at: 0,
    });
    const res = await new Session(shelf).restore();
    expect(res.failures.map((f) => f.fileName)).toEqual(['old.xsn']);
    expect(res.templates).toHaveLength(2);
  });

  test('without storage the session works and says it is not kept', async () => {
    const res = await new Session(memoryShelf(true)).open(ALL);
    expect(res.kept).toBe(false);
    expect(res.templates).toHaveLength(2);
    expect((await new Session().open(ALL)).kept).toBe(false);
    expect((await new Session(memoryShelf(true)).restore()).kept).toBe(false);
  });

  test('a bundled sample is still one after a restore', async () => {
    const shelf = memoryShelf();
    const first = await new Session(shelf).open([
      { ...input('02-expense-report.xsn'), sample: 'expense-report' },
    ]);
    const again = await new Session(shelf).restore();
    expect([first.templates[0]!.sample, again.templates[0]!.sample]).toEqual([true, true]);
    expect(again.triage.rows).toEqual(first.triage.rows);
  });
});

describe('forms and records leave the library', () => {
  test('a form leaves with its records; the other form stays', async () => {
    const shelf = memoryShelf();
    const s = new Session(shelf);
    const res = await s.open(ALL);
    const expense = res.templates.find((t) => t.fileName === '02-expense-report.xsn')!;
    const after = await s.remove([expense.templateId], []);
    expect(names(after)).toEqual(['03-travel-request.xsn']);
    expect(after.records).toEqual([]);
    expect(after.triage.totals.forms).toBe(1);
    expect([...shelf.files.values()].map((f) => f.name)).toEqual(['03-travel-request.xsn']);
    expect(names(await new Session(shelf).restore())).toEqual(['03-travel-request.xsn']);
  });

  test('one record leaves; a form taken out can be added again', async () => {
    const shelf = memoryShelf();
    const s = new Session(shelf);
    const res = await s.open(ALL);
    const one = res.records.find((r) => r.fileName === '02-expense-report-001.xml')!;
    const after = await s.remove([], [one.recordId]);
    expect(after.records.map((r) => r.fileName)).toEqual(['02-expense-report-002.xml']);
    expect(after.templates).toHaveLength(2);

    await s.remove(
      after.templates.map((t) => t.templateId),
      [],
    );
    expect(shelf.files.size).toBe(0);
    const back = await s.open([input('03-travel-request.xsn')]);
    expect(back.duplicates).toEqual([]);
    expect(names(back)).toEqual(['03-travel-request.xsn']);
  });

  test('a form taken out while it is being filled in ends the fill', async () => {
    const s = new Session(memoryShelf());
    const res = await s.open([input('02-expense-report.xsn')]);
    const t = res.templates[0]!;
    const view = t.ir.views[0]!.name;
    await s.fillOpen(t.templateId, undefined, view, NOW);
    await s.remove([t.templateId], []);
    await expect(s.fill({ kind: 'render' }, view, NOW)).rejects.toMatchObject({
      code: 'FILL_STATE',
    });
  });
});

describe('Fill saves into the library', () => {
  test('the empty form becomes a new record, named for the form and the time', async () => {
    const shelf = memoryShelf();
    const s = new Session(shelf);
    const res = await s.open([input('02-expense-report.xsn')]);
    const t = res.templates[0]!;
    const view = t.ir.views[0]!.name;
    await s.fillOpen(t.templateId, undefined, view, NOW);
    await s.fill({ kind: 'edit', path: AMOUNT, value: '12.5' }, view, NOW);
    const saved = await s.fillSave(NOW);
    expect(saved).toMatchObject({
      type: 'saved',
      added: true,
      fileName: '02-expense-report-2026-11-13-210405.xml',
    });
    expect(saved.session.records).toEqual([
      expect.objectContaining({
        recordId: saved.recordId,
        fileName: saved.fileName,
        match: { kind: 'exact', templateId: t.templateId },
      }),
    ]);
    expect((await s.fill({ kind: 'render' }, view, NOW)).dirty).toBe(false);

    // Saved again unchanged: the same record. Changed again: the same record, new contents.
    expect(await s.fillSave(NOW)).toMatchObject({ added: false, recordId: saved.recordId });
    await s.fill({ kind: 'edit', path: AMOUNT, value: '40' }, view, NOW);
    const second = await s.fillSave(NOW);
    expect(second).toMatchObject({ added: false, recordId: saved.recordId });
    expect(second.session.records).toHaveLength(1);
    expect(shelf.files.size).toBe(2);

    const next = await new Session(shelf).restore();
    expect(next.records.map((r) => [r.fileName, r.recordId])).toEqual([
      [saved.fileName, saved.recordId],
    ]);
    const kept = [...shelf.files.values()].find((f) => f.name === saved.fileName)!;
    expect(new TextDecoder().decode(kept.bytes)).toMatch(/<my:amount[^>]*>40</);
  });

  test('two new records in the same second get different names', async () => {
    const s = new Session(memoryShelf());
    const res = await s.open([input('02-expense-report.xsn')]);
    const t = res.templates[0]!;
    const view = t.ir.views[0]!.name;
    const fill = async (amount: string) => {
      await s.fillOpen(t.templateId, undefined, view, NOW);
      await s.fill({ kind: 'edit', path: AMOUNT, value: amount }, view, NOW);
      return s.fillSave(NOW);
    };
    const [a, b] = [await fill('1'), await fill('2')];
    expect([a.fileName, b.fileName]).toEqual([
      '02-expense-report-2026-11-13-210405.xml',
      '02-expense-report-2026-11-13-210405-2.xml',
    ]);
    expect(b.session.records).toHaveLength(2);
  });

  test('a record opened and changed is saved over itself, and its list row follows', async () => {
    const shelf = memoryShelf();
    const s = new Session(shelf);
    const res = await s.open([input('02-expense-report.xsn'), input('02-expense-report-001.xml')]);
    const t = res.templates[0]!;
    const r = res.records[0]!;
    const view = t.ir.views[0]!.name;
    const before = JSON.stringify(s.recordList(t.templateId, NOW).rows);
    await s.fillOpen(t.templateId, r.recordId, view, NOW);
    await s.fill({ kind: 'edit', path: AMOUNT, value: '987.65' }, view, NOW);
    const saved = await s.fillSave(NOW);
    expect(saved).toMatchObject({ added: false, recordId: r.recordId, fileName: r.fileName });
    expect(saved.session.records).toHaveLength(1);
    const after = JSON.stringify(s.recordList(t.templateId, NOW).rows);
    expect(after).not.toBe(before);
    expect(after).toContain('987.65');
    expect(shelf.files.size).toBe(2);
    expect(
      new TextDecoder().decode([...shelf.files.values()].find((f) => f.name === r.fileName)!.bytes),
    ).toContain('987.65');
  });

  test('saving with no fill open is FILL_STATE', async () => {
    await expect(new Session().fillSave(NOW)).rejects.toMatchObject({ code: 'FILL_STATE' });
  });
});

describe('the library as one file', () => {
  test('a folder per form; opened in an empty session it is the same library', async () => {
    const s = new Session();
    const res = await s.open(ALL);
    const zip = await s.backup(NOW);
    expect(zip).toMatchObject({
      type: 'exported',
      fileName: 'infopath-afterlife-library-2026-11-13.zip',
      files: 2,
      records: 2,
    });
    expect(
      readZip(new Uint8Array(zip.bytes))
        .map((e) => e.name)
        .sort(),
    ).toEqual([
      '02-expense-report/02-expense-report-001.xml',
      '02-expense-report/02-expense-report-002.xml',
      '02-expense-report/02-expense-report.xsn',
      '03-travel-request/03-travel-request.xsn',
    ]);
    const back = await new Session().open([{ name: zip.fileName, bytes: zip.bytes }]);
    expect(names(back)).toEqual(names(res));
    expect(back.records.map((r) => [r.fileName, r.match.kind])).toEqual(
      res.records.map((r) => [r.fileName, r.match.kind]),
    );
  });

  test('a record no form made, and two files of one name, each get their own place', async () => {
    const s = new Session();
    await s.open([
      input('02-expense-report-001.xml'),
      input('03-travel-request.xsn'),
      input('02-expense-report-002.xml', '02-expense-report-001.xml'),
    ]);
    const zip = await s.backup(NOW);
    expect(
      readZip(new Uint8Array(zip.bytes))
        .map((e) => e.name)
        .sort(),
    ).toEqual([
      '03-travel-request/03-travel-request.xsn',
      'records-without-a-form/02-expense-report-001-2.xml',
      'records-without-a-form/02-expense-report-001.xml',
    ]);
  });
});
