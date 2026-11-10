import { describe, expect, test } from 'vitest';
import { buildFormIR, type FormIR } from '../../src/index';
import { buildDataTree } from '../../src/ir/data-tree';
import { IdRegistry } from '../../src/ir/ids';
import type { DepRole } from '../../src/ir/types';
import { manifestScope, resolveExpression } from '../../src/ir/xpath/resolve';
import type { ParsedTemplate } from '../../src/xsn/parse';
import { sampleTemplates } from '../helpers/formir';

// Spec 02 R11.3, R11.5: every reference in the 48 samples resolves (requirements Evidence,
// "Dependency extraction").

const samples = (await sampleTemplates()).map((s) => ({ ...s, ir: buildFormIR(s.t) }));
const form = (n: number) => samples.find((s) => s.form === n)!.ir;
const refs = (roles: readonly DepRole[]) =>
  samples.flatMap((s) => s.ir.dependencies.references.filter((r) => roles.includes(r.role)));
const nonEmpty = (xs: readonly (string | undefined)[]) =>
  xs.filter((x) => x !== undefined && x.trim() !== '').length;
/** The expression strings of each Evidence row, counted on the FormIR elements that hold them. */
const stringCounts = (ir: FormIR) => ({
  calculations: nonEmpty(ir.calculations.flatMap((c) => [c.target, c.expression])),
  validations: nonEmpty(ir.validations.flatMap((v) => [v.match, v.expression])),
  rules: nonEmpty(
    ir.rules.flatMap((r) => [
      r.condition,
      ...r.actions.flatMap((a) => [
        a.attrs.expression,
        a.attrs.targetField,
        a.kind === 'dialogBoxExpressionAction' ? a.text : undefined,
      ]),
    ]),
  ),
  submit: nonEmpty(
    ir.dataConnections.flatMap((c) =>
      c.children.map((ch) => (ch.attrs.valueType === 'expression' ? ch.attrs.value : undefined)),
    ),
  ),
  bindings: ir.views.flatMap((v) => v.controls).length,
  choices: ir.views.flatMap((v) => v.controls).filter((c) => c.choicesFrom).length,
});
const strings = (row: keyof ReturnType<typeof stringCounts>) =>
  samples.reduce((a, s) => a + stringCounts(s.ir)[row], 0);

/**
 * The absolute-path row of the Evidence table: strings FormIR keeps as elements
 * (`domEventHandler/@match`, `signedDataBlock/@data`) and strings it does not
 * (`xmlToEdit` `item`/`container`, promoted field `node`, `signedDataBlock/@signatureLocation`),
 * all resolved from the document node. The row's label omits `signatureLocation`; with it the row
 * is 684 (656 item, 21 container, 3 match, 1 data, 1 signatureLocation, and the public sample's
 * item and node), without it 683.
 */
function absolutePaths(t: ParsedTemplate): { strings: number; resolved: number; refs: number } {
  const m = t.manifest;
  const texts = [
    ...m.views.flatMap((v) => v.xmlToEdit.flatMap((x) => [x.attrs.item, x.attrs.container])),
    ...m.domEventHandlers.map((h) => h.attrs.match),
    ...m.promotedFields.map((f) => f.attrs.node),
    ...(m.signatures?.blocks ?? []).flatMap((b) => [b.attrs.data, b.attrs.signatureLocation]),
  ].filter((x): x is string => x !== undefined && x.trim() !== '');
  const tree = buildDataTree(t, new IdRegistry());
  const env = { index: tree.index, parentOf: tree.parentOf };
  let resolved = 0;
  let n = 0;
  for (const text of texts) {
    const r = resolveExpression(text, { ds: 'main', node: null }, manifestScope(m.namespaces), env);
    n += r.refs.length + r.unresolved.length;
    resolved += r.refs.length;
  }
  return { strings: texts.length, resolved, refs: n };
}

describe('R11.5 1,566 of 1,566 references resolve', () => {
  test('per Evidence row', () => {
    const abs = samples.map((s) => absolutePaths(s.t));
    const sum = (k: 'strings' | 'resolved' | 'refs') => abs.reduce((a, x) => a + x[k], 0);
    const rows = {
      calculations: [strings('calculations'), refs(['calcTarget', 'calcExpression']).length],
      validations: [
        strings('validations'),
        refs(['validationMatch', 'validationExpression']).length,
      ],
      rules: [
        strings('rules'),
        refs(['condition', 'actionExpression', 'assignmentTarget', 'dialogText']).length,
      ],
      submit: [strings('submit'), refs(['submitValue']).length],
      bindings: [strings('bindings'), refs(['binding']).length],
      choices: [strings('choices'), refs(['choicesFilter']).length],
      absolute: [sum('strings'), sum('resolved')],
    };
    expect(rows).toEqual({
      calculations: [40, 49],
      validations: [88, 98],
      rules: [19, 14],
      submit: [4, 5],
      bindings: [707, 707],
      choices: [5, 9],
      absolute: [684, 684],
    });
    expect(sum('refs')).toBe(684);
    const total = Object.values(rows).reduce((a, [, r]) => a + r!, 0);
    expect(total).toBe(1566);
  });

  test('0 unresolved references and 0 FormIR issues in every sample', () => {
    for (const s of samples) {
      const ir = s.ir;
      const unresolved = [
        ...ir.rules,
        ...ir.calculations,
        ...ir.validations,
        ...ir.dataConnections,
      ].flatMap((e) => e.unresolvedRefs);
      expect(unresolved, s.slug).toEqual([]);
      expect(ir.issues, s.slug).toEqual([]);
    }
  });
});

describe('R11.3 oracles', () => {
  const node = (ir: FormIR, id: string) => [...ir.fields, ...ir.groups].find((n) => n.id === id)!;
  const kindOf = (ir: FormIR, elementId: string) => {
    if (ir.views.some((v) => v.controls.some((c) => c.id === elementId))) {
      return `view ${ir.views.find((v) => v.controls.some((c) => c.id === elementId))!.name}`;
    }
    return elementId.slice(0, elementId.indexOf(':'));
  };

  test('form 04 grandTotal: written by one calculation (and its control), read by 2 conditions, 1 dialog and view Request', () => {
    const ir = form(4);
    const n = node(ir, 'f:main:/my:purchaseRequest/my:grandTotal');
    expect(n.dependencies.writtenBy.map((d) => [d.role, kindOf(ir, d.elementId)])).toEqual([
      ['calcTarget', 'calc'],
      ['binding', 'view Request'],
    ]);
    expect(n.dependencies.readBy.map((d) => [d.role, kindOf(ir, d.elementId)])).toEqual([
      ['condition', 'rule'],
      ['condition', 'rule'],
      ['dialogText', 'action'],
      ['binding', 'view Request'],
    ]);
  });

  test('form 03 destCountry: a validation, the destCity predicate, the clearCity trigger, both views', () => {
    const ir = form(3);
    const n = node(ir, 'f:main:/my:travelRequest/my:destCountry');
    const city = ir.views[0]!.controls.find((c) => c.binding === 'my:destCity')!;
    const read = n.dependencies.readBy;
    expect(
      read.filter((d) => d.role.startsWith('validation')).map((d) => kindOf(ir, d.elementId)),
    ).toEqual(expect.arrayContaining(['val']) as string[]);
    expect(read).toContainEqual({ elementId: city.id, role: 'choicesFilter' });
    const trigger = read.filter((d) => d.role === 'trigger');
    expect(trigger).toHaveLength(1);
    expect(ir.rules.find((r) => r.id === trigger[0]!.elementId)!.ruleSet).toBe('clearCity');
    expect([
      ...new Set(read.filter((d) => d.role === 'binding').map((d) => kindOf(ir, d.elementId))),
    ]).toEqual(ir.views.map((v) => `view ${v.name}`));
  });

  test('form 03: ../my:destCity resolves from the destCountry trigger context', () => {
    const ir = form(3);
    expect(ir.dependencies.references).toContainEqual(
      expect.objectContaining({
        targetId: 'f:main:/my:travelRequest/my:destCity',
        text: '../my:destCity',
      }),
    );
  });

  test('form 04: the BudgetService tree is reached through GetDOM; lineage lists it', () => {
    const ir = form(4);
    const budget = ir.dataConnections.find((c) => c.dataSource === 'BudgetService')!;
    expect(budget.lineage.fieldIds.some((id) => id.endsWith('/tns:costCenter'))).toBe(true);
    expect(budget.lineage.usedBy.length).toBeGreaterThan(0);
    const vendors = ir.dataConnections.find((c) => c.dataSource === 'Vendors')!;
    const vendor = ir.views.flatMap((v) => v.controls).find((c) => c.binding.endsWith('vendorId'))!;
    expect(vendors.lineage.usedBy).toContain(vendor.id);
  });

  test('…Id properties are filled', () => {
    const all = samples.map((s) => s.ir);
    expect(all.flatMap((ir) => ir.calculations).every((c) => c.targetId !== undefined)).toBe(true);
    expect(all.flatMap((ir) => ir.validations).every((v) => v.matchId !== undefined)).toBe(true);
    const field = all
      .flatMap((ir) => ir.rules.flatMap((r) => r.triggers))
      .filter((t) => t.kind === 'fieldChange');
    expect(field.map((t) => t.targetId)).toEqual(['f:main:/my:travelRequest/my:destCountry']);
    expect(form(47).codeBehind.handlers.map((h) => h.targetId)).toEqual([
      expect.stringMatching(/assetTag$/) as string,
      expect.stringMatching(/returnDue$/) as string,
    ]);
    expect(form(45).signatures.blocks.map((b) => b.dataId)).toEqual([form(45).groups[0]!.id]);
  });
});
