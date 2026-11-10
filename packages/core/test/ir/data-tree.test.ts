import { describe, expect, test } from 'vitest';
import { buildFormIR } from '../../src/index';
import { titleCase } from '../../src/ir/views/labels';
import { sampleTemplates } from '../helpers/formir';
import { readmeTable } from '../oracles/readme-table';

// Spec 02 R3.

const samples = (await sampleTemplates()).map((s) => ({ ...s, ir: buildFormIR(s.t) }));
const form = (n: number) => samples.find((s) => s.form === n)!.ir;
const nodes = (ir: (typeof samples)[number]['ir']) => [...ir.groups, ...ir.fields];
const byId = (n: number, id: string) => nodes(form(n)).find((x) => x.id === id)!;

describe('R3.1 fields and groups', () => {
  test('form 01 reason: not required (spec 01 R14.8 values reappear)', () => {
    expect(byId(1, 'f:main:/my:leaveRequest/my:reason')).toMatchObject({
      kind: 'field',
      required: false,
      groupId: 'g:main:/my:leaveRequest',
      label: 'Reason',
      labelSource: 'name',
    });
  });

  test('form 04 line: a repeating group; its children point to it', () => {
    const line = 'g:main:/my:purchaseRequest/my:lines/my:line';
    expect(byId(4, line)).toMatchObject({ kind: 'group', repeating: true, optional: true });
    expect(byId(4, `f:main:/my:purchaseRequest/my:lines/my:line/my:lineTotal`).groupId).toBe(line);
  });

  test('a root has no groupId', () => {
    expect(byId(1, 'g:main:/my:leaveRequest')).not.toHaveProperty('groupId');
  });

  test('form 03 Locations: attributes with no namespace', () => {
    expect(byId(3, 'f:Locations:/locations/country/@code')).toMatchObject({
      nodeType: 'attribute',
      namespace: null,
      dataSource: 'Locations',
    });
  });
});

describe('R3.2 data paths and ids', () => {
  test("form 04's two secondary dfs:myFields roots get different ids", () => {
    const roots = form(4)
      .groups.filter((g) => !g.groupId)
      .map((g) => g.id);
    expect(roots).toEqual([
      'g:main:/my:purchaseRequest',
      'g:BudgetService:/dfs:myFields',
      'g:Vendors:/dfs:myFields',
    ]);
  });

  test('ids are unique in every sample, and no DUPLICATE_ID issue is raised', () => {
    for (const s of samples) {
      const ids = nodes(s.ir).map((x) => x.id);
      expect(new Set(ids).size, s.slug).toBe(ids.length);
      expect(
        s.ir.issues.filter((i) => i.code === 'DUPLICATE_ID'),
        s.slug,
      ).toEqual([]);
    }
  });
});

describe('R3.3 README counts', () => {
  const count = (ir: (typeof samples)[number]['ir']) => {
    const main = nodes(ir).filter((x) => x.dataSource === 'main' && x.nodeType === 'element');
    return { fields: main.length, repOpt: main.filter((x) => x.repeating || x.optional).length };
  };
  test.each(readmeTable().map((r) => [r.slug, r] as const))('%s', (slug, row) => {
    const ir = samples.find((s) => s.slug === slug)!.ir;
    expect(count(ir)).toEqual({
      fields: row.counts.Fields,
      repOpt: row.counts['Repeating/optional'],
    });
  });
  test('the public sample: Fields 5, Repeating/optional 4', () => {
    expect(count(samples.find((s) => s.form === undefined)!.ir)).toEqual({ fields: 5, repOpt: 4 });
  });
});

test.each([
  ['employeeName', 'Employee Name'],
  ['DisplayName', 'Display Name'],
  ['field1', 'Field1'],
  ['ows_Title', 'Ows Title'],
  ['cost-center.code', 'Cost Center Code'],
  ['VATRate', 'VATRate'],
])('R5.1 step 8: titleCase(%s) = %s', (name, label) => {
  expect(titleCase(name)).toBe(label);
});
