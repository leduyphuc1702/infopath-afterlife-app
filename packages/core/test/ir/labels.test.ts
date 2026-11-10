import { describe, expect, test } from 'vitest';
import type { FormIR, IrField } from '../../src/index';
import { cleanLabel } from '../../src/ir/views/labels';
import { viewIR, type FixtureView } from '../helpers/view-package';

// Spec 02 R5.4: one synthetic view per layout (test/fixtures/synthetic/views/labels/), our own
// wording. Each fixture is the default view of its own package.

const build = (views: readonly FixtureView[]): FormIR => {
  const { ir, issues } = viewIR(views, undefined, { dir: 'labels/' });
  expect(issues).toEqual([]);
  return ir;
};
const one = (file: string) => build([{ name: 'Main', file }]);
const field = (ir: FormIR, name: string): IrField => ir.fields.find((f) => f.name === name)!;
const label = (ir: FormIR, name: string) => {
  const f = field(ir, name);
  return [f.label, f.labelSource];
};

describe('R5.4 layouts', () => {
  test('a ScreenTip that differs from the cell text', () => {
    const ir = one('tip-differs.xsl');
    expect(label(ir, 'tipDiffers')).toEqual(['Customer reference number', 'title']);
    expect(field(ir, 'tipDiffers').labelEvidence).toEqual({
      step: 'title',
      view: 'Main',
      at: {
        file: 'tip-differs.xsl',
        path: expect.stringMatching(/\/@title$/) as string,
        line: 5,
        column: expect.any(Number) as number,
      },
    });
  });

  test('inline text before the control (whitespace collapsed, colon removed)', () => {
    const ir = one('inline-before.xsl');
    expect(label(ir, 'inlineBefore')).toEqual(['Delivery note', 'cell']);
    expect(field(ir, 'inlineBefore').labelEvidence).toMatchObject({
      step: 'cell',
      view: 'Main',
      at: { file: 'inline-before.xsl', line: 4 },
    });
  });

  test('a block above the control in the same cell, xsl:text included', () => {
    expect(label(one('block-above.xsl'), 'blockAbove')).toEqual(['Site address', 'cell']);
  });

  test('the left cell', () => {
    const ir = one('left-cell.xsl');
    expect(label(ir, 'leftCellField')).toEqual(['Contact phone', 'leftCell']);
    expect(field(ir, 'leftCellField').labelEvidence.at).toMatchObject({ line: 4 });
  });

  test('no visible text, only a ScreenTip', () => {
    expect(label(one('tip-only.xsl'), 'tipOnly')).toEqual(['Internal memo', 'title']);
  });

  test('two checkboxes in one cell, with and without ScreenTips', () => {
    const ir = one('checkboxes.xsl');
    expect(['urgent', 'fragile', 'sealed', 'insured'].map((n) => label(ir, n))).toEqual([
      ['Urgent handling', 'title'],
      ['Fragile goods', 'title'],
      ['Sealed', 'checkboxText'],
      // The text after the first checkbox is its own, not the label of the second.
      ['Insured', 'checkboxText'],
    ]);
    expect(field(ir, 'insured').labelEvidence.at).toMatchObject({ line: 6 });
  });

  test('a repeating table by moded template', () => {
    const ir = one('moded-repeat.xsl');
    expect([label(ir, 'rowItem'), label(ir, 'rowQty')]).toEqual([
      ['Part', 'columnHeader'],
      ['Count', 'columnHeader'],
    ]);
    expect(field(ir, 'rowQty').labelEvidence.at).toMatchObject({ line: 4 });
  });

  test('a repeating table by xsl:for-each in tbody xd:xctname="repeatingtable"', () => {
    const ir = one('foreach-repeat.xsl');
    expect([label(ir, 'entryDate'), label(ir, 'entryNote')]).toEqual([
      ['Visit date', 'columnHeader'],
      ['Remarks', 'columnHeader'],
    ]);
  });

  test('a field with only ma:displayName', () => {
    const ir = one('display-name.xsl');
    expect(label(ir, 'listTitle')).toEqual(['List heading', 'schemaDisplayName']);
    expect(field(ir, 'listTitle').labelEvidence).toMatchObject({
      step: 'schemaDisplayName',
      at: { file: 'myschema.xsd' },
    });
  });

  test('a field shown only in a second view', () => {
    const ir = build([
      { name: 'Main', file: 'tip-only.xsl' },
      { name: 'Approval', file: 'second-b.xsl' },
    ]);
    expect(label(ir, 'secondViewOnly')).toEqual(['Approver comment', 'otherView']);
    expect(field(ir, 'secondViewOnly').labelEvidence).toMatchObject({
      step: 'otherView',
      viewStep: 'leftCell',
      view: 'Approval',
      at: { file: 'second-b.xsl', line: 4 },
    });
  });

  test('a field with no label anywhere: the name in Title Case, no evidence location', () => {
    const ir = one('no-label.xsl');
    expect(label(ir, 'noLabel')).toEqual(['No Label', 'name']);
    expect(field(ir, 'noLabel').labelEvidence).toEqual({ step: 'name' });
  });

  test('two option-button groups: field labels from the left cell and the first ScreenTip', () => {
    const ir = one('option-groups.xsl');
    expect([label(ir, 'priority'), label(ir, 'shipping')]).toEqual([
      ['Priority', 'leftCell'],
      ['Shipping method', 'title'],
    ]);
    const choices = ir.views[0]!.controls.map((c) => [c.binding, c.choice]);
    expect(choices).toEqual([
      ['my:priority', { label: 'High', value: 'high' }],
      ['my:priority', { label: 'Low', value: 'low' }],
      ['my:shipping', { label: 'Road', value: 'road' }],
      ['my:shipping', { label: 'Air', value: 'air' }],
    ]);
  });
});

describe('R5.2 cleanLabel', () => {
  test.each([
    ['  Date: ', 'Date'],
    ['Weight :', 'Weight'],
    ['Ratio::', 'Ratio:'],
    ['a\n\t b', 'a b'],
    ['', ''],
  ])('%j', (input, out) => {
    expect(cleanLabel(input)).toBe(out);
  });
});
