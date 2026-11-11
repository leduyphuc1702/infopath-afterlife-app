import fc from 'fast-check';
import { expect, test } from 'vitest';
import { fill, recordNames, slugs } from '../runtime/fill';

// Spec 04 R7.4, P3: for any form with a repeating group and any N ≤ 20, inserting N rows at
// generated positions and removing them again gives the same XML. Each insert's answer names the
// new row (`focus`); removing in reverse order addresses each row where it was inserted.

const forms = await Promise.all(
  slugs().map(async (slug) => {
    const { ir } = await fill(slug);
    const groups = ir.groups.filter((g) => g.insert?.component === 'xCollection');
    return { slug, groups };
  }),
).then((all) => all.filter((f) => f.groups.length > 0));

const atFirst = (absolute: string) =>
  absolute
    .split('/')
    .slice(1)
    .map((s) => `/${s}[1]`)
    .join('');

test('P3: N inserts at generated positions, then N removes, give the start XML', async () => {
  // 17 forms carry fragments; form 05 has only xOptional and xReplace.
  expect(forms.length).toBe(16);
  const cases = forms.flatMap((f) =>
    [undefined, ...recordNames(f.slug).slice(0, 2)].map((r) => ({ ...f, record: r })),
  );
  let inserted = 0;
  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom(...cases),
      fc.array(fc.tuple(fc.nat(), fc.constantFrom('in', 'before', 'after'), fc.nat()), {
        maxLength: 20,
      }),
      async (c, ops) => {
        const { s } = await fill(c.slug, c.record);
        const start = s.xml();
        const done: string[] = [];
        for (const [gi, where, ri] of ops) {
          const g = c.groups[gi % c.groups.length]!;
          const rows = s.paths(g.id);
          const container = atFirst(g.insert!.container ?? g.path.replace(/\/[^/]+\/[^/]+$/, ''));
          if (where === 'in' || rows.length === 0) {
            if (s.text(container) === undefined && s.paths(g.groupId!).length === 0) continue;
            try {
              done.push(s.insertRow(g.id, { in: container }).focus!);
            } catch {
              continue; // the container is not in this record (a nested group's parent row)
            }
          } else {
            const row = rows[ri % rows.length]!;
            done.push(s.insertRow(g.id, { row, where }).focus!);
          }
        }
        inserted += done.length;
        for (const p of done.reverse()) s.removeRow(p);
        expect(s.xml()).toBe(start);
      },
    ),
    { numRuns: 200 },
  );
  console.log(
    `P3: ${cases.length} cases on ${forms.length} forms, 200 runs, ${inserted} rows inserted`,
  );
});
