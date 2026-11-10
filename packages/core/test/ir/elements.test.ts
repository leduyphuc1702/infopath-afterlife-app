import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { buildFormIR, parsePackage, type FormIR } from '../../src/index';
import { buildElements } from '../../src/ir/elements';
import { IdRegistry } from '../../src/ir/ids';
import { sampleTemplates } from '../helpers/formir';
import { packageFile } from '../helpers/package';
import { manifestXml } from '../helpers/synthetic-manifest';
import { readmeTable } from '../oracles/readme-table';

// Spec 02 R6, R7, R9 (and the manifest half of R4.5).

const samples = (await sampleTemplates()).map((s) => ({ ...s, ir: buildFormIR(s.t) }));
const form = (n: number) => samples.find((s) => s.form === n)!.ir;
const synthetic = (inner: string): FormIR =>
  buildFormIR(parsePackage([packageFile('manifest.xsf', manifestXml(inner))]));

describe('README Rules, Calcs and Checks', () => {
  test.each(readmeTable().map((r) => [r.slug, r] as const))('%s', (slug, row) => {
    const ir = samples.find((s) => s.slug === slug)!.ir;
    expect({
      rules: ir.rules.length,
      calcs: ir.calculations.length,
      checks: ir.validations.filter((v) => v.kind === 'errorCondition').length,
    }).toEqual({ rules: row.counts.Rules, calcs: row.counts.Calcs, checks: row.counts.Checks });
  });

  test('the public sample: 0 rules, 1 calculation, 0 checks', () => {
    const ir = samples.find((s) => s.form === undefined)!.ir;
    expect([ir.rules.length, ir.calculations.length, ir.validations.length]).toEqual([0, 1, 0]);
    expect(ir.calculations[0]).toMatchObject({
      target: '/my:myFields/my:Date',
      expression: 'xdDate:Today()',
      refresh: 'onChange',
    });
  });
});

describe('R6 rules and triggers', () => {
  test('8 trigger links over 9 rules: 2 onLoad, 1 fieldChange, 5 buttons', () => {
    const triggers = samples.flatMap((s) =>
      s.ir.rules
        .filter((r, i, all) => all.findIndex((x) => x.ruleSet === r.ruleSet) === i)
        .flatMap((r) => r.triggers.map((t) => [s.form, t.kind] as const)),
    );
    expect(triggers.length).toBe(8);
    expect(triggers.filter(([, k]) => k === 'onLoad').map(([f]) => f)).toEqual([1, 7]);
    expect(triggers.filter(([, k]) => k === 'button').map(([f]) => f)).toEqual([4, 4, 5, 5, 5]);
    const change = form(3).rules[0]!.triggers[0]!;
    expect(change).toMatchObject({
      kind: 'fieldChange',
      match: '/my:travelRequest/my:destCountry',
    });
  });

  test('form 04: actions in order with every attribute and the dialog text verbatim', () => {
    const r = form(4).rules[0]!;
    expect(r).toMatchObject({
      id: 'rule:/xsf:ruleSets[1]/xsf:ruleSet[1]/xsf:rule[1]',
      ruleSet: 'checkBudget',
      caption: 'Query budget service',
      enabled: true,
      stopProcessing: false,
    });
    expect(r.actions.map((a) => a.kind)).toEqual([
      'assignmentAction',
      'queryAction',
      'assignmentAction',
    ]);
    expect(r.actions[1]).toMatchObject({
      id: 'action:/xsf:ruleSets[1]/xsf:ruleSet[1]/xsf:rule[1]/xsf:queryAction[1]',
      attrs: { adapter: 'BudgetService' },
    });
    const dialog = form(4)
      .rules.flatMap((x) => x.actions)
      .find((a) => a.kind === 'dialogBoxExpressionAction');
    expect(dialog!.text).toBe(
      'concat("Total ", /my:purchaseRequest/my:grandTotal, " is over 1000: accounting must approve.")',
    );
  });

  test('isEnabled="no" and exitRuleSet; a rule set nothing runs has no triggers', () => {
    const ir = synthetic(
      '<xsf:ruleSets><xsf:ruleSet name="s"><xsf:rule caption="c" condition="my:a = 1" isEnabled="no"><xsf:assignmentAction targetField="my:b" expression="1"/><xsf:exitRuleSet/></xsf:rule></xsf:ruleSet></xsf:ruleSets>',
    );
    expect(ir.rules[0]).toMatchObject({ enabled: false, stopProcessing: true, triggers: [] });
  });
});

describe('R7.2 validations', () => {
  test('form 01 endDate has two, with messages kept', () => {
    const v = form(1).validations.filter((x) => x.match === '/my:leaveRequest/my:endDate');
    expect(v.map((x) => x.expression)).toEqual([
      '. = ""',
      'msxsl:string-compare(., ../my:startDate) < 0',
    ]);
    expect(v[0]!.message).toMatchObject({ type: 'modeless', text: expect.any(String) as string });
  });

  test('xsf3:errorBlank becomes kind blank, after the error conditions', () => {
    const ir = synthetic(
      '<xsf:customValidation><xsf:errorCondition match="/my:a" expressionContext="." expression=". = 1"><xsf:errorMessage type="modal" shortMessage="s">Long</xsf:errorMessage></xsf:errorCondition></xsf:customValidation><xsf:extensions><xsf:extension name="x"><xsf3:solutionDefinition><xsf3:customValidation><xsf3:errorBlank match="/my:b" expressionContext="." expression="."/></xsf3:customValidation></xsf3:solutionDefinition></xsf:extension></xsf:extensions>',
    );
    expect(ir.validations.map((v) => [v.kind, v.match])).toEqual([
      ['errorCondition', '/my:a'],
      ['blank', '/my:b'],
    ]);
    expect(ir.validations[0]!.message).toEqual({ type: 'modal', shortMessage: 's', text: 'Long' });
    expect(ir.validations[1]).not.toHaveProperty('message');
  });
});

describe('R9 code-behind and signatures', () => {
  test('form 46: managed code, CSharp, no files', () => {
    expect(form(46).codeBehind).toEqual({
      present: true,
      languages: ['CSharp'],
      files: [],
      handlers: [],
    });
  });

  test('form 47: jscript as written, script.js once, two handlers', () => {
    const c = form(47).codeBehind;
    expect(c).toMatchObject({ present: true, languages: ['jscript'], files: ['script.js'] });
    expect(c.handlers.map((h) => h.match)).toEqual([
      '/my:assetCheckoutScript/my:assetTag',
      '/my:assetCheckoutScript/my:returnDue',
    ]);
  });

  test('the other 46 samples have no code-behind', () => {
    expect(samples.filter((s) => s.ir.codeBehind.present).map((s) => s.form)).toEqual([46, 47]);
  });

  test('form 45: one countersigned block over the root group, with its message', () => {
    expect(form(45).signatures.blocks).toEqual([
      expect.objectContaining({ mode: 'countersign', data: '/my:policyAcknowledgement' }),
    ]);
    expect(form(45).signatures.blocks[0]!.message).toEqual(expect.any(String));
  });

  test('signature lines: one per xsf3:signatureLine, with its view', () => {
    const t = parsePackage([
      packageFile(
        'manifest.xsf',
        readFileSync(new URL('../fixtures/synthetic/signature-lines.xsf', import.meta.url)),
      ),
    ]);
    const lines = t.manifest.views.flatMap((v) =>
      v.extensions.flatMap((e) => (e.key === 'xsf3:viewExtension' ? e.signatureLines : [])),
    );
    const ir = buildFormIR(t);
    expect(ir.signatures.signatureLines).toHaveLength(lines.length);
    expect(lines.length).toBeGreaterThan(0);
    expect(ir.signatures.signatureLines[0]!.view).toBe(t.manifest.views[0]!.attrs.name);
  });

  test('allowed ActiveX controls from the manifest', () => {
    const t = parsePackage([
      packageFile(
        'manifest.xsf',
        readFileSync(new URL('../fixtures/synthetic/allowed-control.xsf', import.meta.url)),
      ),
    ]);
    const ir = buildFormIR(t);
    expect(ir.activeX.allowed.map((a) => a.clsid)).toEqual(
      t.manifest.allowedControls.map((a) => a.attrs.clsid),
    );
    expect(ir.activeX.allowed.length).toBeGreaterThan(0);
  });
});

test('expressions wait for stage 7 with their context (form 04)', () => {
  const s = samples.find((x) => x.form === 4)!;
  const p = buildElements(s.t, new IdRegistry()).pending;
  expect(p.filter((x) => x.role === 'condition').map((x) => x.text)).toEqual([
    '/my:purchaseRequest/my:grandTotal > 1000',
    '/my:purchaseRequest/my:grandTotal <= 1000',
  ]);
  expect(p.find((x) => x.role === 'calcExpression')!.context).toEqual({
    kind: 'node',
    path: '/my:purchaseRequest/my:lines/my:line/my:lineTotal',
  });
});
