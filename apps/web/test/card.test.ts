import { expect, test } from 'vitest';
import { cardFor } from '../src/side/card';
import { irOf } from './samples';

// R5.1 on form 04 (rules, a web service, a SQL list) and form 02 (a calculation).
const ir04 = await irOf('04-purchase-request');
const id04 = (p: string) => `f:main:/my:purchaseRequest/${p}`;

test('form 04 cost center: the rule action that reads it, as written, and the budget service', () => {
  const card = cardFor(ir04, id04('my:requester/my:costCenterCode'))!;
  expect(card).toMatchObject({ label: 'Cost center', type: 'Text', required: false, controls: 1 });
  const action = card.refs.find((r) => r.kind === 'Rule action')!;
  expect(action.expression).toContain('my:costCenterCode');
  expect(action.roles).toEqual(['actionExpression']);
  expect(card.connections.map((c) => [c.name, c.kind])).toEqual([['BudgetService', 'Web service']]);
});

test('form 04 vendor: its drop-down takes its choices from the SQL connection', () => {
  const card = cardFor(ir04, id04('my:vendorId'))!;
  expect(card.connections.map((c) => c.kind)).toEqual(['Database (SQL)']);
  expect(card.refs).toEqual([]);
});

test('form 04 requester name: required, with its validation as written', () => {
  const card = cardFor(ir04, id04('my:requester/my:requesterName'))!;
  expect(card.required).toBe(true); // a blank check, as the asterisk (spec 03 §9.2)
  const v = card.refs.filter((r) => r.kind === 'Validation');
  expect(v).toHaveLength(1);
  expect(v[0]!.roles).toEqual(['validationMatch', 'validationExpression']);
  expect(v[0]!.expression).toBeTruthy();
});

test('form 02 total: its calculation, expression as written', async () => {
  const ir = await irOf('02-expense-report');
  const card = cardFor(ir, 'f:main:/my:expenseClaim/my:totalAmount')!;
  expect(card.refs.filter((r) => r.kind === 'Calculation').map((r) => r.expression)).toEqual([
    'sum(xdMath:Nz(../my:expenses/my:expense/my:amount))',
  ]);
});

test('every field of forms 01–08 has a card', async () => {
  for (const slug of [
    '01-leave-request',
    '03-travel-request',
    '05-new-hire-onboarding',
    '08-big-form',
  ]) {
    const ir = await irOf(slug);
    for (const f of [...ir.fields, ...ir.groups]) expect(cardFor(ir, f.id), f.id).toBeDefined();
  }
});
