import { describe, expect, test } from 'vitest';
import { buildFormIR, type FormIR } from '../../src/index';
import { buildConnections } from '../../src/ir/connections';
import { buildDataTree } from '../../src/ir/data-tree';
import { IdRegistry } from '../../src/ir/ids';
import { scanViews, staticAvt } from '../../src/ir/views/scan';
import type { ParsedTemplate } from '../../src/xsn/parse';
import { sampleTemplates } from '../helpers/formir';
import { viewIR, viewPackage } from '../helpers/view-package';
import { readmeTable } from '../oracles/readme-table';

// Spec 02 R4 (views and bound controls), R15 (viewXmlBytes).

const samples = (await sampleTemplates()).map((s) => ({ ...s, ir: buildFormIR(s.t) }));
const form = (n: number) => samples.find((s) => s.form === n)!.ir;
const controls = (ir: FormIR) => ir.views.flatMap((v) => v.controls);
const byBinding = (ir: FormIR, binding: string) =>
  controls(ir).filter((c) => c.binding === binding);

/** Stage 5 alone, for the references the FormIR only shows after stage 7. */
const scanOf = (t: ParsedTemplate) => {
  const ids = new IdRegistry();
  const tree = buildDataTree(t, ids);
  return scanViews({ t, tree, ids, connections: buildConnections(t, ids).connections });
};

describe('R4.1 views', () => {
  test('README Views column, every row', () => {
    for (const row of readmeTable()) {
      const s = samples.find((x) => x.slug === row.slug)!;
      expect(s.ir.views.length, row.slug).toBe(row.counts.Views);
    }
  });

  test('53 views in the 48 samples, every one scanned', () => {
    const views = samples.flatMap((s) => s.ir.views);
    expect(views).toHaveLength(53);
    expect(views.every((v) => v.scanned)).toBe(true);
  });

  test('form 05: 3 views, HR the default', () => {
    const v = form(5).views;
    expect(v).toHaveLength(3);
    expect(v.filter((x) => x.isDefault).map((x) => x.name)).toEqual(['HR']);
    expect(v.every((x) => !x.isPrint && x.xslFile !== undefined)).toBe(true);
  });
});

describe('R4.2 bound controls in the samples', () => {
  test('707 of 707 bindings resolve; 0 FormIR issues', () => {
    const all = samples.flatMap((s) => controls(s.ir));
    expect(all).toHaveLength(707);
    expect(all.filter((c) => c.targetId === undefined)).toEqual([]);
    for (const s of samples) expect(s.ir.issues, s.slug).toEqual(s.t.issues);
  });

  test('form 02: my:amount in the repeating row resolves through the moded template', () => {
    const [amount] = byBinding(form(2), 'my:amount');
    expect(amount).toMatchObject({
      targetId: 'f:main:/my:expenseClaim/my:expenses/my:expense/my:amount',
      xctname: 'PlainText',
      ctrlId: 'CTRL10',
      title: 'Amount',
      inRepeat: true,
      readOnly: false,
    });
    expect(amount!.id).toMatch(/^ctl:view1\.xsl:\/xsl:template\[3\]\//);
    // The claimant section is called from a layout cell: not a repeating row.
    expect(byBinding(form(2), 'my:claimantName')[0]!.inRepeat).toBe(false);
  });

  test('a date picker: the bound inner part is the control, with the DTPicker ScreenTip', () => {
    expect(byBinding(form(2), 'my:expenseDate')[0]).toMatchObject({
      xctname: 'DTPicker_DTText',
      title: 'Date',
    });
  });

  test('form 01: three option buttons bind leaveType, each with its choice', () => {
    expect(byBinding(form(1), 'my:leaveType').map((c) => c.choice)).toEqual([
      { label: 'Annual', value: 'Annual' },
      { label: 'Sick', value: 'Sick' },
      { label: 'Unpaid', value: 'Unpaid' },
    ]);
  });
});

describe('R4.4 choicesFrom', () => {
  test('form 03: destCountry from Locations; destCity filtered by destCountry', () => {
    const ir = form(3);
    const conn = ir.dataConnections.find((c) => c.dataSource === 'Locations')!.id;
    const [country] = byBinding(ir, 'my:destCountry');
    const [city] = byBinding(ir, 'my:destCity');
    expect(country!.choicesFrom).toEqual({
      dataSource: 'Locations',
      connectionId: conn,
      select: 'xdXDocument:GetDOM("Locations")/locations/country',
      filterIds: [],
    });
    expect(city!.choicesFrom).toEqual({
      dataSource: 'Locations',
      connectionId: conn,
      select:
        'xdXDocument:GetDOM("Locations")/locations/country[@code = current()/my:destCountry]/city',
      filterIds: [
        'f:Locations:/locations/country/@code',
        'f:main:/my:travelRequest/my:destCountry',
      ],
    });
  });

  test('form 04: vendorId from Vendors, the ADO connection', () => {
    const ir = form(4);
    const ado = ir.dataConnections.find((c) => c.adapterKind === 'adoAdapter')!;
    const [vendor] = controls(ir).filter((c) => c.binding.endsWith('vendorId'));
    expect(vendor!.choicesFrom).toMatchObject({ dataSource: 'Vendors', connectionId: ado.id });
  });
});

describe('R4.5 ActiveX', () => {
  test('form 44: one control bound to the approvers group; no allowedControl in any sample', () => {
    const ir = form(44);
    const group = ir.groups.find((g) => g.name === 'approvers')!;
    expect(ir.activeX.controls).toHaveLength(1);
    const ax = ir.activeX.controls[0]!;
    expect(ax.id).toMatch(/^ax:view1\.xsl:/);
    expect(ax).toMatchObject({
      view: ir.views[0]!.name,
      classid: 'clsid:61e40d31-993d-4777-8fa0-19ca59b6d0bb',
      binding: 'my:approvers',
      targetId: group.id,
      server: {
        attribute: 'xd:server',
        host: 'intranet.contoso-fictional.example',
        liveness: 'unknown',
        reason: 'public',
      },
      source: { file: 'view1.xsl' },
    });
    const bound = byBinding(ir, 'my:approvers')[0]!;
    expect(bound).toMatchObject({
      targetId: group.id,
      xctname: '{61e40d31-993d-4777-8fa0-19ca59b6d0bb}',
    });
    expect(bound).not.toHaveProperty('title');
    expect(samples.filter((s) => s.ir.activeX.controls.length).map((s) => s.form)).toEqual([44]);
    expect(samples.flatMap((s) => s.ir.activeX.allowed)).toEqual([]);
  });
});

describe('attribute value templates', () => {
  test.each([
    ['plain', 'plain'],
    ['{{x}}', '{x}'],
    ['a}}b', 'a}b'],
    ['{my:x}', undefined],
    ['Code {{A}} {my:x}', undefined],
  ])('%s', (input, out) => {
    expect(staticAvt(input)).toBe(out);
  });
});

describe('R4.3 synthetic views (test/fixtures/synthetic/views/)', () => {
  const reasons = (issues: FormIR['issues']) =>
    issues.map((i) => [i.code, i.details?.binding, i.details?.reason]);

  test('a mode called from two places: kept, resolved at each, one issue per failure', () => {
    const { ir, issues } = viewIR([{ name: 'V', file: 'mode-twice.xsl' }]);
    const [c] = controls(ir);
    expect(c).toMatchObject({ binding: 'my:item', xctname: 'PlainText', inRepeat: true });
    expect(c).not.toHaveProperty('targetId');
    expect(reasons(issues)).toEqual([
      ['UNRESOLVED_BINDING', 'my:item', 'notInTree'],
      ['UNRESOLVED_BINDING', 'my:item', 'modeCallSites'],
    ]);
    expect(issues[1]!.details).toMatchObject({ view: 'V', mode: '_1', callSites: 2 });
    // The call site that resolves still gives its reference.
    expect(scanOf(viewPackage([{ name: 'V', file: 'mode-twice.xsl' }])).controls[0]!.refs).toEqual([
      { targetId: 'f:main:/my:order/my:lines/my:line/my:item', text: 'my:item' },
    ]);
  });

  test('a mode never called, and a named template', () => {
    const never = viewIR([{ name: 'V', file: 'mode-never.xsl' }]);
    expect(controls(never.ir).map((c) => [c.binding, c.targetId])).toEqual([
      ['my:orderTitle', 'f:main:/my:order/my:orderTitle'],
      ['my:item', undefined],
    ]);
    expect(reasons(never.issues)).toEqual([['UNRESOLVED_BINDING', 'my:item', 'modeNotCalled']]);
    const named = viewIR([{ name: 'V', file: 'call-template.xsl' }]);
    expect(controls(named.ir).map((c) => c.binding)).toEqual(['my:status']);
    expect(reasons(named.issues)).toEqual([['UNRESOLVED_BINDING', 'my:status', 'namedTemplate']]);
    expect(named.issues[0]).toMatchObject({ file: 'call-template.xsl', line: 6 });
  });

  test('a missing view and a broken one are not scanned; the others are', () => {
    const { t, ir, issues } = viewIR([
      { name: 'Missing', file: 'missing.xsl', missing: true },
      { name: 'Broken', file: 'broken.xsl' },
      { name: 'Good', file: 'dropdown-case.xsl' },
    ]);
    expect(ir.views.map((v) => [v.name, v.scanned, v.controls.length])).toEqual([
      ['Missing', false, 0],
      ['Broken', false, 0],
      ['Good', true, 2],
    ]);
    // The missing file is spec 01's issue, passed through; the broken view is this spec's.
    expect(t.issues.map((i) => [i.code, i.details?.name ?? i.file])).toContainEqual([
      'MISSING_FILE',
      'missing.xsl',
    ]);
    expect(issues.map((i) => [i.code, i.file, i.details?.view])).toEqual([
      ['INVALID_XML', 'broken.xsl', 'Broken'],
    ]);
  });

  test('an unbound object is an ActiveX control and not a bound control', () => {
    const { ir, issues } = viewIR([{ name: 'V', file: 'unbound-object.xsl' }]);
    expect(controls(ir)).toEqual([]);
    expect(ir.activeX.controls.map((a) => [a.view, a.classid, a.binding])).toEqual([
      ['V', 'clsid:00000000-0000-0000-0000-00000000c0de', undefined],
    ]);
    expect(issues).toEqual([]);
  });

  test('ExpressionBox: read-only; a repeating average reads one field; a literal reads none', () => {
    const t = viewPackage([{ name: 'V', file: 'expression-box.xsl' }]);
    const { ir, issues } = viewIR([{ name: 'V', file: 'expression-box.xsl' }]);
    expect(issues).toEqual([]);
    expect(controls(ir).map((c) => [c.readOnly, c.targetId, c.title])).toEqual([
      [true, undefined, 'Average quantity'],
      [true, undefined, undefined],
    ]);
    expect(scanOf(t).controls.map((c) => c.refs)).toEqual([
      [{ targetId: 'f:main:/my:order/my:lines/my:line/my:qty', text: 'my:lines/my:line/my:qty' }],
      [],
    ]);
  });

  test('a text box bound into a secondary source with GetDOM; a filtered list from it', () => {
    const { ir, issues } = viewIR([{ name: 'V', file: 'getdom-text.xsl' }]);
    expect(issues).toEqual([]);
    const [depot, region] = controls(ir);
    expect(depot!.targetId).toBe('f:Depots:/{#RowsetSchema}row/@ows_Depot');
    expect(region!.choicesFrom).toEqual({
      dataSource: 'Depots',
      connectionId: ir.dataConnections[0]!.id,
      select: 'xdXDocument:GetDOM("Depots")/z:row[@ows_Region = current()/my:orderTitle]',
      filterIds: ['f:Depots:/{#RowsetSchema}row/@ows_Region', 'f:main:/my:order/my:orderTitle'],
    });
  });

  test('DropDown and dropdown are both kept as written', () => {
    const { ir } = viewIR([{ name: 'V', file: 'dropdown-case.xsl' }]);
    expect(controls(ir).map((c) => [c.xctname, c.targetId])).toEqual([
      ['DropDown', 'f:main:/my:order/my:status'],
      ['dropdown', 'f:main:/my:order/my:orderTitle'],
    ]);
  });

  test('ActiveX with {{…}}, bound to a group, xd:server internal/singleLabel', () => {
    const { ir, issues } = viewIR([{ name: 'V', file: 'activex.xsl' }]);
    expect(issues).toEqual([]);
    expect(controls(ir)[0]).toMatchObject({
      xctname: '{00000000-0000-0000-0000-0000000beef0}',
      targetId: 'g:main:/my:order/my:reviewers',
    });
    expect(ir.activeX.controls[0]).toMatchObject({
      targetId: 'g:main:/my:order/my:reviewers',
      server: {
        value: 'http://peoplehub:8080',
        host: 'peoplehub',
        liveness: 'internal',
        reason: 'singleLabel',
      },
    });
  });

  test('a dynamic ScreenTip is absent and named in dynamicAttrs; {{ }} is decoded', () => {
    const { ir } = viewIR([{ name: 'V', file: 'dynamic-title.xsl' }]);
    const [dyn, escaped] = controls(ir);
    expect(dyn).not.toHaveProperty('title');
    expect(dyn!.dynamicAttrs).toEqual(['title']);
    expect(escaped).toMatchObject({ title: 'Code {A}' });
    expect(escaped).not.toHaveProperty('dynamicAttrs');
  });
});

describe('R15 viewXmlBytes', () => {
  test('an overrun is one issue and skips the remaining views', () => {
    const views = [
      { name: 'A', file: 'dropdown-case.xsl' },
      { name: 'B', file: 'activex.xsl' },
      { name: 'C', file: 'dynamic-title.xsl' },
    ];
    const { ir, issues } = viewIR(views, { viewXmlBytes: 1200 });
    expect(ir.views.map((v) => v.scanned)).toEqual([true, false, false]);
    expect(issues.map((i) => [i.code, i.details?.limit, i.details?.view])).toEqual([
      ['LIMIT_EXCEEDED', 'xmlBytes', 'B'],
    ]);
    expect(viewIR(views).ir.views.every((v) => v.scanned)).toBe(true);
  });
});
