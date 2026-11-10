import { expect, test } from 'vitest';
import { buildFormIR, parseFormIR, serialiseFormIR, type FormIR } from '../../src/index';
import { sampleTemplates } from '../helpers/formir';

// Spec 02 R1.2, R1.3, R13.2, R13.3: one golden FormIR file per sample
// (test/golden/formir/<slug>.json). A changed golden file is a reviewed diff (`vitest -u`).

const samples = await sampleTemplates();

test('48 samples', () => {
  expect(samples).toHaveLength(48);
});

test.each(samples.map((s) => [s.slug, s] as const))(
  '%s matches its golden FormIR',
  async (slug, s) => {
    const json = serialiseFormIR(buildFormIR(s.t));
    // R13.2: built twice from the same input, the same bytes.
    expect(serialiseFormIR(buildFormIR(s.t))).toBe(json);
    // A valid FormIR (the full round trip is P6, task 10).
    expect(serialiseFormIR(parseFormIR(json))).toBe(json);
    await expect(json).toMatchFileSnapshot(`../golden/formir/${slug}.json`);
  },
);

/** Every id in a FormIR, in part order. */
function allIds(ir: FormIR): string[] {
  return [
    ...ir.fields.map((f) => f.id),
    ...ir.groups.map((g) => g.id),
    ...ir.views.flatMap((v) => [v.id, ...v.controls.map((c) => c.id)]),
    ...ir.rules.flatMap((r) => [r.id, ...r.actions.map((a) => a.id)]),
    ...ir.calculations.map((c) => c.id),
    ...ir.validations.map((v) => v.id),
    ...ir.dataConnections.map((c) => c.id),
    ...ir.codeBehind.handlers.map((h) => h.id),
    ...ir.signatures.blocks.map((b) => b.id),
    ...ir.signatures.signatureLines.map((l) => l.id),
    ...ir.activeX.controls.map((a) => a.id),
    ...ir.activeX.allowed.map((a) => a.id),
  ];
}

test('R13.2 ids are unique in every sample; no DUPLICATE_ID', () => {
  for (const s of samples) {
    const ids = allIds(buildFormIR(s.t));
    expect(new Set(ids).size, s.slug).toBe(ids.length);
  }
});

test('R13.2 forms 01 and 07 share the ids of their common fields', () => {
  const ir = (n: number) => buildFormIR(samples.find((s) => s.form === n)!.t);
  const v1 = ir(1).fields.map((f) => f.id);
  const v2 = new Set(ir(7).fields.map((f) => f.id));
  expect(v1.length).toBeGreaterThan(0);
  expect(v1.filter((id) => !v2.has(id))).toEqual([]);
  expect(v2.size).toBe(v1.length + 1);
});

test('R1.2 every expression string equals its spec 01 source', () => {
  for (const s of samples) {
    const m = s.t.manifest;
    const ir = buildFormIR(s.t);
    const rules = m.ruleSets.flatMap((rs) => rs.rules);
    expect(
      ir.rules.map((r) => r.condition),
      s.slug,
    ).toEqual(rules.map((r) => r.attrs.condition));
    expect(
      ir.rules.flatMap((r) => r.actions.map((a) => [a.attrs, a.text])),
      s.slug,
    ).toEqual(rules.flatMap((r) => r.actions.map((a) => [{ ...a.attrs }, a.text])));
    expect(ir.calculations.map((c) => [c.target, c.expression])).toEqual(
      m.calculations.map((c) => [c.attrs.target, c.attrs.expression]),
    );
    expect(ir.validations.map((v) => [v.match, v.expressionContext, v.expression])).toEqual(
      [...m.validations, ...m.blankChecks].map((v) => [
        v.attrs.match,
        v.attrs.expressionContext,
        v.attrs.expression,
      ]),
    );
    expect(ir.codeBehind.handlers.map((h) => h.match)).toEqual(
      m.domEventHandlers.filter((h) => h.attrs.handlerObject).map((h) => h.attrs.match),
    );
    expect(ir.signatures.blocks.map((b) => b.data)).toEqual(
      (m.signatures?.blocks ?? []).map((b) => b.attrs.data),
    );
    const submitValues = (cs: FormIR['dataConnections']) =>
      cs.flatMap((c) =>
        c.children.filter((x) => x.attrs.valueType === 'expression').map((x) => x.attrs.value),
      );
    const adapters = [
      ...(m.mainQuery ? [m.mainQuery] : []),
      ...m.dataObjects.flatMap((d) => (d.query ? [d.query] : [])),
      ...(m.submit?.adapters ?? []),
      ...m.dataAdapters,
    ].sort((x, y) => x.line - y.line || x.column - y.column);
    expect(submitValues(ir.dataConnections)).toEqual(
      adapters.flatMap((a) =>
        a.children
          .filter((c) => (c.attrs as Record<string, string>).valueType === 'expression')
          .map((c) => (c.attrs as Record<string, string>).value),
      ),
    );
  }
});

test('R1.3 every sample has zero FormIR issues', () => {
  for (const s of samples) expect(buildFormIR(s.t).issues, s.slug).toEqual([]);
});
