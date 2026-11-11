// Spec 04 R4.3 (spec 16 task): submit and close, pressed. No own form binds them to a button,
// so form 04's "Check approval" rules get them in place of their actions.
import { expect, test } from 'vitest';
import { FillSession, type FormIR } from '../../src/index';
import { NOT_IN_VIEWER } from '../../src/runtime/rules';
import { templateOf } from './fill';

test('R4.3: a button that submits or closes says "Not available in the viewer" and changes nothing', async () => {
  const { t, ir } = await templateOf('04-purchase-request');
  for (const kind of ['submitAction', 'closeDocumentAction']) {
    const changed: FormIR = {
      ...ir,
      rules: ir.rules.map((r) =>
        r.ruleSet === 'checkApproval'
          ? { ...r, condition: undefined, actions: [{ ...r.actions[0]!, kind, attrs: {} }] }
          : r,
      ),
    } as FormIR;
    const s = FillSession.open(t, changed, { now: '2026-11-11T09:00:00+07:00' });
    const before = s.xml();
    const a = s.press('CTRL901');
    expect(a.notices, kind).toEqual([NOT_IN_VIEWER]);
    expect(
      a.trace.filter((e) => e.kind === 'skipped').map((e) => e.note),
      kind,
    ).toContain(NOT_IN_VIEWER);
    expect(s.xml(), kind).toBe(before);
  }
});
