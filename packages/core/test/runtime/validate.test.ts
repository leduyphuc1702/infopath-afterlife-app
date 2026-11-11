import { describe, expect, test } from 'vitest';
import { typeProblem } from '../../src/index';
import { fill } from './fill';

// Spec 04 task 4: R5.1, design D16. One case per source of an error, then the type table.

const A47 = '/my:assetCheckoutScript[1]';
const AMOUNT = '/my:expenseClaim[1]/my:expenses[1]/my:expense[1]/my:amount[1]';

const only = (inv: readonly { path: string; kind: string; short: string }[], path: string) =>
  inv.filter((i) => i.path === path).map((i) => [i.kind, i.short]);

describe('the four sources (R5.1)', () => {
  test('required and empty: the Required chip rule (blank check), "Cannot be blank"', async () => {
    const { s } = await fill('02-expense-report', '02-expense-report-001.xml');
    const p = '/my:expenseClaim[1]/my:claimant[1]/my:claimantName[1]';
    expect(only(s.edit(p, '').invalid, p)).toEqual([['required', 'Cannot be blank']]);
  });
  test('schema type: text in a number field', async () => {
    const { s } = await fill('02-expense-report', '02-expense-report-001.xml');
    expect(only(s.edit(AMOUNT, '12,50').invalid, AMOUNT)).toEqual([
      ['type', 'Only numbers allowed'],
    ]);
  });
  test("errorCondition: the form's own message", async () => {
    const { s } = await fill('02-expense-report', '02-expense-report-001.xml');
    expect(only(s.edit(AMOUNT, '-5').invalid, AMOUNT)).toEqual([['errorCondition', 'Must be > 0']]);
  });
  test.each([
    [`${A47}/my:assetCondition[1]`, 'Broken', 'Only New, Good, Worn allowed'],
    [`${A47}/my:assetTag[1]`, 'cam-1', 'Not in the expected format'],
    [`${A47}/my:checkoutDate[1]`, '2026-02-30', 'Only dates allowed'],
  ])('facet or type on form 47: %s = %s', async (path, value, short) => {
    const { s } = await fill('47-asset-checkout-script', '47-asset-checkout-script-001.xml');
    expect(only(s.invalid(), path)).toEqual([]);
    expect(only(s.edit(path, value).invalid, path).map(([, m]) => m)).toEqual([short]);
  });
});

test('the trace says when a field becomes invalid and valid again', async () => {
  const { s } = await fill('02-expense-report', '02-expense-report-001.xml');
  const on = s.edit(AMOUNT, '-5').trace.filter((t) => t.kind === 'validation');
  expect(on.map((t) => [t.trigger, t.caption, t.condition])).toEqual([
    [AMOUNT, 'Must be > 0', true],
  ]);
  const off = s.edit(AMOUNT, '5').trace.filter((t) => t.kind === 'validation');
  expect(off.map((t) => [t.trigger, t.condition])).toEqual([[AMOUNT, false]]);
});

test('an emptied nillable date gets xsi:nil back, and is valid', async () => {
  const { s } = await fill('47-asset-checkout-script', '47-asset-checkout-script-001.xml');
  const p = `${A47}/my:checkoutDate[1]`;
  expect(only(s.edit(p, '').invalid, p)).toEqual([]);
  expect(s.xml()).toContain('<my:checkoutDate xsi:nil="true"/>');
  s.edit(p, '2026-05-20');
  expect(s.xml()).toContain('<my:checkoutDate>2026-05-20</my:checkoutDate>');
});

test.each([
  ['xsd:double', '1.5e3', undefined],
  ['xsd:double', '1,5', 'Only numbers allowed'],
  ['xsd:decimal', '1e3', 'Only numbers allowed'],
  ['xsd:integer', ' 42 ', undefined],
  ['xsd:integer', '4.2', 'Only whole numbers allowed'],
  ['xsd:nonNegativeInteger', '-1', 'Only whole numbers allowed'],
  ['xsd:boolean', 'yes', 'Only true or false allowed'],
  ['xsd:boolean', '1', undefined],
  ['xsd:date', '2024-02-29', undefined],
  ['xsd:date', '2025-02-29', 'Only dates allowed'],
  ['xsd:date', '11/11/2026', 'Only dates allowed'],
  ['xsd:time', '23:59:59', undefined],
  ['xsd:time', '24:00:00', 'Only times allowed'],
  ['xsd:dateTime', '2026-11-11T09:00:00+07:00', undefined],
  ['xsd:dateTime', '2026-11-11', 'Only dates and times allowed'],
  ['xsd:string', 'anything', undefined],
])('%s %j: %s', (type, text, problem) => {
  expect(typeProblem(type, text)).toBe(problem);
});
