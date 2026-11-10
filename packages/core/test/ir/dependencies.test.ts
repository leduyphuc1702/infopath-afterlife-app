import { describe, expect, test } from 'vitest';
import { viewIR } from '../helpers/view-package';

// Spec 02 R11.2, design §7.2: a rule run by a button resolves from the button's scan context.

const rules = `<xsf:ruleSets>
<xsf:ruleSet name="pickRow"><xsf:rule caption="Remember the row"><xsf:assignmentAction targetField="../my:selectedRow" expression="my:qty"/></xsf:rule></xsf:ruleSet>
<xsf:ruleSet name="stamp"><xsf:rule caption="Stamp the title"><xsf:assignmentAction targetField="my:orderTitle" expression="&quot;picked&quot;"/></xsf:rule></xsf:ruleSet>
</xsf:ruleSets>`;
const buttons = `<xsf:unboundControls><xsf:button name="CTRL7"><xsf:ruleSetAction ruleSet="pickRow"/></xsf:button><xsf:button name="CTRL99"><xsf:ruleSetAction ruleSet="stamp"/></xsf:button></xsf:unboundControls>`;

describe('button triggers (fixtures/synthetic/views/button-row.xsl)', () => {
  const { ir, issues } = viewIR(
    [{ name: 'V', file: 'button-row.xsl', inner: buttons }],
    undefined,
    {
      manifest: rules,
    },
  );
  const refs = (ruleSet: string) => {
    const r = ir.rules.find((x) => x.ruleSet === ruleSet)!;
    const ids = new Set(r.actions.map((a) => a.id));
    return ir.dependencies.references
      .filter((x) => ids.has(x.elementId))
      .map((x) => [x.role, x.text, x.targetId]);
  };

  test('a button in a repeating row: ../x and x resolve from the row', () => {
    expect(issues).toEqual([]);
    expect(refs('pickRow')).toEqual([
      ['actionExpression', 'my:qty', 'f:main:/my:order/my:lines/my:line/my:qty'],
      ['assignmentTarget', '../my:selectedRow', 'f:main:/my:order/my:lines/my:selectedRow'],
    ]);
    const selected = ir.fields.find((f) => f.name === 'selectedRow')!;
    expect(selected.dependencies.writtenBy.map((d) => d.role)).toEqual(['assignmentTarget']);
  });

  test('a button whose name matches no view element: the main root', () => {
    expect(refs('stamp')).toEqual([
      ['assignmentTarget', 'my:orderTitle', 'f:main:/my:order/my:orderTitle'],
    ]);
  });

  test('the row control is inRepeat (its context my:line repeats)', () => {
    expect(ir.views[0]!.controls.map((c) => [c.binding, c.inRepeat])).toEqual([['my:item', true]]);
  });
});
