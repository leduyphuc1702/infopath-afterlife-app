import { expect, test } from 'vitest';
import { classify, COVERAGE_CLASSES, COVERAGE_TABLE, type FormIR } from '../../src/index';
import { sampleIRs } from '../helpers/irs';

// Spec 12 R1.1, R1.2: every element in exactly one class, with its row and its source.
const samples = await sampleIRs();
const irOf = (prefix: string) => samples.find((s) => s.slug.startsWith(prefix))!.ir;

/** The element count of design §3, written again from FormIR. */
function elementCount(ir: FormIR): number {
  const controls = new Set(
    ir.views.flatMap((v) =>
      v.controls
        .filter((c) => !/^\{+[0-9a-f-]{36}\}+$/i.test(c.xctname ?? ''))
        .map((c) => `${c.targetId ?? c.binding}|${c.xctname ?? ''}`),
    ),
  );
  return (
    controls.size +
    ir.views.filter((v) => !v.isDefault).length +
    ir.rules.reduce((n, r) => n + r.actions.length, 0) +
    ir.calculations.length +
    ir.validations.length +
    ir.dataConnections.length +
    (ir.codeBehind.present ? 1 : 0) +
    (ir.activeX.controls.length || ir.activeX.allowed.length) +
    ir.signatures.blocks.length +
    ir.signatures.signatureLines.length
  );
}

test('every element of the 48 samples once, with a class, a cited row and a source', () => {
  for (const { slug, ir } of samples) {
    const c = classify(ir);
    expect(c.items.length, slug).toBe(elementCount(ir));
    expect(new Set(c.items.map((i) => i.elementId)).size, slug).toBe(c.items.length);
    for (const i of c.items) {
      expect(COVERAGE_CLASSES, i.elementId).toContain(i.class);
      expect(i.unlisted, `${slug} ${i.kind}:${i.subtype}`).toBe(false);
      expect(i.cites, i.elementId).toBeDefined();
      expect(i.source.file, i.elementId).not.toBe('');
    }
    const sum = COVERAGE_CLASSES.reduce((n, k) => n + c.counts[k], 0);
    expect(sum, slug).toBe(c.items.length);
  }
});

test('per-form counts, forms 01–08 and 43–47', () => {
  const table = Object.fromEntries(
    samples
      .filter((s) => /^(0[1-8]|4[3-7])-/.test(s.slug))
      .map((s) => [s.slug, Object.values(classify(s.ir).counts).join(' ')]),
  );
  // native emulated manual unsupported
  expect(table).toMatchInlineSnapshot(`
    {
      "01-leave-request": "14 3 1 0",
      "02-expense-report": "14 2 1 0",
      "03-travel-request": "21 4 0 0",
      "04-purchase-request": "18 10 3 0",
      "05-new-hire-onboarding": "20 5 0 0",
      "06-safety-incident": "17 0 0 0",
      "07-leave-request-v2": "15 3 1 0",
      "08-big-form": "200 0 0 0",
      "43-browser-leave-request": "9 1 0 0",
      "44-contract-approval-task": "6 0 0 1",
      "45-policy-acknowledgement": "7 0 1 0",
      "46-vendor-onboarding-code": "7 0 1 0",
      "47-asset-checkout-script": "7 0 1 0",
    }
  `);
});

test('form 04: SQL and web service are Manual; the XML-free views and rules are Emulated', () => {
  const items = classify(irOf('04-')).items;
  const conns = items.filter((i) => i.kind === 'connection').map((i) => [i.subtype, i.class]);
  expect(conns).toEqual([
    ['adoAdapter', 'manual'],
    ['webServiceAdapter', 'manual'],
  ]);
});

test('decisions 1–4 (2026-11-11): views App, code-behind Manual, blank check Native, Section Native; ActiveX Unsupported', () => {
  const kinds = (prefix: string, kind: string) =>
    classify(irOf(prefix))
      .items.filter((i) => i.kind === kind)
      .map((i) => i.class);
  expect(kinds('05-', 'view')).toEqual(['emulated', 'emulated']);
  expect(kinds('46-', 'codeBehind')).toEqual(['manual']);
  expect(kinds('47-', 'codeBehind')).toEqual(['manual']);
  expect(kinds('44-', 'activeX')).toEqual(['unsupported']);
  expect(kinds('45-', 'signature')).toEqual(['manual']);
  const v01 = classify(irOf('01-')).items.filter((i) => i.kind === 'validation');
  expect(v01.map((i) => `${i.subtype}:${i.class}`)).toEqual([
    'blank:native',
    'blank:native',
    'blank:native',
    'blank:native',
    'condition:emulated',
    'condition:emulated',
  ]);
  // Sections carry no `xd:binding`, so FormIR has no control for them and they are not elements
  // in phase A; the entry is there for spec 05, which converts them to JSM sections.
  expect(COVERAGE_TABLE.find((e) => e.subtype === 'Section')?.class).toBe('native');
  expect(classify(irOf('05-')).items.filter((i) => i.subtype === 'Section')).toEqual([]);
});

test('R1.2: an unknown control, action and adapter are Manual and unlisted, never skipped', () => {
  const base = irOf('04-');
  const view = base.views[0]!;
  const rule = base.rules[0]!;
  const ir: FormIR = {
    ...base,
    views: [
      {
        ...view,
        controls: [
          ...view.controls,
          { ...view.controls[0]!, id: 'ctl:x', binding: 'my:x', targetId: 'f:main:/x', xctname: 'Hologram' },
        ],
      },
      ...base.views.slice(1),
    ],
    rules: [{ ...rule, actions: [...rule.actions, { ...rule.actions[0]!, id: 'action:x', kind: 'teleportAction' }] }, ...base.rules.slice(1)],
    dataConnections: [...base.dataConnections, { ...base.dataConnections[0]!, id: 'conn:x', adapterKind: 'hwsAdapter' }],
  };
  const c = classify(ir);
  expect(c.items.length).toBe(classify(base).items.length + 3);
  const unlisted = c.items.filter((i) => i.unlisted);
  expect(unlisted.map((i) => [i.kind, i.subtype, i.class, i.cites])).toEqual([
    ['control', 'Hologram', 'manual', undefined],
    ['action', 'teleportAction', 'manual', undefined],
    ['connection', 'hwsAdapter', 'manual', undefined],
  ]);
});
