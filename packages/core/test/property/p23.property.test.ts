// P23 (spec 24): for any own template and any sequence of edits the runtime accepts (set a value,
// insert a row, remove a row), undoing all of them gives the first record back, redoing all of
// them gives the last, and the downloaded XML parsed again gives the same values.
import fc from 'fast-check';
import { expect, test } from 'vitest';
import {
  FillCommandError,
  FillSession,
  History,
  type FillAnswer,
  type Snapshot,
} from '../../src/index';
import { NOW, slugs, templateOf } from '../runtime/fill';

const RUNS = 94;
const VALUES = ['', 'Zeta', '12', '-3.5', '2026-12-24', 'true', '<b>&amp;', 'x'.repeat(40)];
const action = fc.oneof(
  fc.record({ kind: fc.constant('set' as const), at: fc.nat(), value: fc.constantFrom(...VALUES) }),
  fc.record({ kind: fc.constant('insert' as const), at: fc.nat(), item: fc.nat() }),
  fc.record({ kind: fc.constant('remove' as const), at: fc.nat(), item: fc.nat() }),
);
const same = (a: Snapshot, b: Snapshot) => JSON.stringify(a) === JSON.stringify(b);

test('P23: undo all gives the first record, redo all the last, the XML reads back the same', async () => {
  const all = slugs();
  const opened = new Map(
    await Promise.all(all.map(async (s) => [s, await templateOf(s)] as const)),
  );
  fc.assert(
    fc.property(
      fc.constantFrom(...all),
      fc.array(action, { minLength: 1, maxLength: 8 }),
      (slug, actions) => {
        const { t, ir } = opened.get(slug)!;
        const s = FillSession.open(t, ir, { now: NOW });
        const h = new History<Snapshot>();
        const fields = ir.fields.filter(
          (f) => f.dataSource === ir.fields[0]!.dataSource && !s.calculated(f.id),
        );
        const rows = ir.groups.filter((g) => g.insert?.component === 'xCollection');
        const first = s.snapshot();
        const run = (f: () => FillAnswer) => {
          const before = s.snapshot();
          try {
            f();
          } catch (e) {
            if (e instanceof FillCommandError) return;
            throw e;
          }
          if (!same(before, s.snapshot())) h.record(before);
        };
        for (const a of actions) {
          if (a.kind === 'set' && fields.length > 0) {
            const f = fields[a.at % fields.length]!;
            const paths = s.paths(f.id);
            if (paths.length > 0) run(() => s.edit(paths[a.at % paths.length]!, a.value));
          } else if (a.kind !== 'set' && rows.length > 0) {
            const g = rows[a.at % rows.length]!;
            const items = s.paths(g.id);
            if (items.length === 0) continue;
            const item = items[a.item % items.length]!;
            run(() =>
              a.kind === 'insert'
                ? s.insertRow(g.id, { row: item, where: 'after' })
                : s.removeRow(item),
            );
          }
        }
        const last = s.snapshot();
        // The downloaded XML, opened again as it is, gives the same values.
        const again = FillSession.open(t, ir, {
          now: NOW,
          record: new TextEncoder().encode(s.xml()),
          initial: false,
        });
        for (const f of ir.fields)
          expect(again.values(f.id), `${slug} ${f.id}`).toEqual(s.values(f.id));
        let back: Snapshot | undefined;
        while ((back = h.undo(s.snapshot()))) s.restore(back);
        expect(same(s.snapshot(), first), `${slug}: undo all`).toBe(true);
        while ((back = h.redo(s.snapshot()))) s.restore(back);
        expect(same(s.snapshot(), last), `${slug}: redo all`).toBe(true);
      },
    ),
    { numRuns: RUNS },
  );
}, 180_000);
