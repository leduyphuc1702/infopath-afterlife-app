import { describe, expect, test } from 'vitest';
import { buildFormIR } from '../../src/index';
import { buildConnections } from '../../src/ir/connections';
import { buildDataTree } from '../../src/ir/data-tree';
import { IdRegistry } from '../../src/ir/ids';
import { inView } from '../../src/ir/views/labels';
import { scanViews } from '../../src/ir/views/scan';
import { sampleTemplates } from '../helpers/formir';

// Spec 02 R5.1–R5.3 over the 48 samples.

const samples = (await sampleTemplates()).map((s) => ({ ...s, ir: buildFormIR(s.t) }));
/** The main trees: 606 fields (requirements Evidence "Fields"). */
const fields = samples.flatMap((s) => s.ir.fields.filter((f) => f.dataSource === 'main'));

describe('R5.1 labelSource counts over the 606 main-tree fields', () => {
  test('title 585, leftCell 2, otherView 14, name 5', () => {
    const counts: Record<string, number> = {};
    for (const f of fields) counts[f.labelSource] = (counts[f.labelSource] ?? 0) + 1;
    expect(fields).toHaveLength(606);
    expect(counts).toEqual({ title: 585, leftCell: 2, otherView: 14, name: 5 });
  });

  test('the 14 otherView fields are in forms 03, 05, 41, 42, each labelled by a title', () => {
    const other = samples.flatMap((s) =>
      s.ir.fields.filter((f) => f.labelSource === 'otherView').map((f) => [s.form, f]),
    );
    expect([...new Set(other.map(([n]) => n))]).toEqual([3, 5, 41, 42]);
    expect(
      other.every(([, f]) => typeof f === 'object' && f.labelEvidence.viewStep === 'title'),
    ).toBe(true);
  });

  test('the 5 name fields: form 44 Person children, public field1 and field2', () => {
    const named = samples.flatMap((s) =>
      s.ir.fields
        .filter((f) => f.dataSource === 'main' && f.labelSource === 'name')
        .map((f) => `${s.form ?? 'public'}:${f.name}`),
    );
    expect(named).toEqual([
      '44:DisplayName',
      '44:AccountId',
      '44:AccountType',
      'public:field1',
      'public:field2',
    ]);
  });

  test('secondary-source fields with no control are labelled by name (forms 03, 04: 9)', () => {
    const secondary = samples.flatMap((s) => s.ir.fields.filter((f) => f.dataSource !== 'main'));
    expect(secondary).toHaveLength(9);
    expect(secondary.every((f) => f.labelSource === 'name')).toBe(true);
  });

  test('groups always use step 8', () => {
    const groups = samples.flatMap((s) => s.ir.groups);
    expect(groups.every((g) => g.labelSource === 'name' && g.labelEvidence.step === 'name')).toBe(
      true,
    );
  });
});

describe('forms 01–08, default views', () => {
  const firstEight = samples.filter((s) => s.form !== undefined && s.form <= 8);

  test('290 fields with a bound control; each label is its ScreenTip, with the evidence', () => {
    let n = 0;
    for (const s of firstEight) {
      const def = s.ir.views.find((v) => v.isDefault)!;
      for (const f of s.ir.fields) {
        const c = def.controls.find((x) => x.targetId === f.id);
        if (c === undefined) continue;
        n++;
        expect(f.labelSource, `${s.slug} ${f.path}`).toBe('title');
        expect(f.label).toBe(c.title);
        expect(f.labelEvidence).toMatchObject({
          step: 'title',
          view: def.name,
          at: { file: def.xslFile },
        });
      }
    }
    expect(n).toBe(290);
  });

  test('cross-check: steps 2–5 alone give the same 290 labels', () => {
    const mismatches: string[] = [];
    for (const s of firstEight) {
      const ids = new IdRegistry();
      const tree = buildDataTree(s.t, ids);
      const scan = scanViews({
        t: s.t,
        tree,
        ids,
        connections: buildConnections(s.t, ids).connections,
      });
      const def = scan.views.find((v) => v.isDefault)!;
      const seen = new Set<string>();
      for (const c of scan.controls) {
        const id = c.control.targetId;
        if (c.view !== def.name || id === undefined || seen.has(id)) continue;
        seen.add(id);
        const alt = inView(c, true);
        if (alt?.label !== c.control.title)
          mismatches.push(`${s.slug} ${id}: ${alt?.step} ${alt?.label}`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});

describe('public sample', () => {
  test('Date and Weight from the left cell, trailing colon removed (R5.2)', () => {
    const ir = samples.find((s) => s.form === undefined)!.ir;
    const left = ir.fields.filter((f) => f.labelSource === 'leftCell');
    expect(left.map((f) => f.label)).toEqual(['Date', 'Weight']);
    expect(left.every((f) => f.labelEvidence.at?.file !== undefined)).toBe(true);
  });
});
