import { expect, test } from 'vitest';
import { NEEDS_QUERY, NO_QUERIES, NOT_IN_VIEWER } from '../../src/runtime/rules';
import { fill, recordNames } from './fill';

// Spec 04 task 10 (R4.1–R4.4, D15): the rules in our forms, one by one.

const T = '/my:travelRequest[1]';
const P = '/my:purchaseRequest[1]';

test('form 03: changing the country clears the city (field rule, R4.1, R4.2)', async () => {
  const { s } = await fill('03-travel-request');
  s.edit(`${T}/my:destCity[1]`, 'Hanoi');
  const a = s.edit(`${T}/my:destCountry[1]`, 'VN');
  expect(s.text(`${T}/my:destCity[1]`)).toBe('');
  const rule = a.trace.find((e) => e.kind === 'rule')!;
  expect(rule).toMatchObject({
    caption: 'Clear city when country changes',
    trigger: `${T}/my:destCountry[1]`,
    condition: true,
    changes: [{ path: `${T}/my:destCity[1]`, before: 'Hanoi', after: '' }],
  });
});

test('form 04 "Check budget": the query and the assignments that need it are skipped', async () => {
  const { s } = await fill('04-purchase-request', recordNames('04-purchase-request')[0]);
  const before = s.xml();
  const a = s.press('CTRL900');
  // The stored budget stays: the query that would refresh it cannot run (R4.3).
  expect(s.xml()).toBe(before);
  expect(a.changes).toEqual([]);
  const skipped = a.trace.filter((e) => e.kind === 'skipped').map((e) => [e.caption, e.note]);
  expect(skipped).toEqual([
    ['GetDOM("BudgetService")', NO_QUERIES],
    [
      'Query budget service: assignmentAction',
      expect.stringContaining('selects no field') as unknown as string,
    ],
    ['Query budget service: queryAction', NO_QUERIES],
    ['Query budget service: assignmentAction', `${NEEDS_QUERY} (BudgetService)`],
  ]);
  expect(a.dialogs).toEqual([]);
  expect(a.notices).toEqual([]);
});

test('form 04 "Check approval": over 1000 sets the flag and opens a dialog; stopProcessing order kept', async () => {
  const { s } = await fill('04-purchase-request');
  const low = s.press('CTRL901');
  expect(low.dialogs).toEqual([]);
  expect(low.trace.filter((e) => e.kind === 'rule').map((e) => [e.caption, e.condition])).toEqual([
    ['Over 1000 needs accounting approval', false],
    ['1000 or less', true],
  ]);
  const { s: big } = await fill('04-purchase-request', recordNames('04-purchase-request')[0]);
  big.edit(`${P}/my:needsAccounting[1]`, 'false');
  const high = big.press('CTRL901');
  expect(high.dialogs).toEqual(['Total 1566.33 is over 1000: accounting must approve.']);
  expect(big.text(`${P}/my:needsAccounting[1]`)).toBe('true');
  expect(high.trace.filter((e) => e.kind === 'rule').map((e) => [e.caption, e.condition])).toEqual([
    ['Over 1000 needs accounting approval', true],
    ['1000 or less', false],
  ]);
});

test('form 05: the three buttons switch views and change no data (R4.2)', async () => {
  const { s } = await fill('05-new-hire-onboarding');
  const before = s.xml();
  expect(s.press('CTRL911').view).toBe('Manager');
  expect(s.press('CTRL910').view).toBe('IT');
  expect(s.press('CTRL912').view).toBe('HR');
  expect(s.xml()).toBe(before);
});

test('forms 01 and 07: the onLoad rule fills the request date on the empty form only', async () => {
  for (const slug of ['01-leave-request', '07-leave-request-v2']) {
    const { s } = await fill(slug);
    const rule = s.opened.trace.find((e) => e.kind === 'rule')!;
    expect(rule.caption).toBe('Default request date');
    expect(rule.condition).toBe(true);
    expect(rule.changes[0]?.after).toBe('2026-11-11');
    const { s: r } = await fill(slug, recordNames(slug)[0]);
    expect(r.opened.trace.find((e) => e.kind === 'rule')?.condition).toBe(false);
  }
});

test('a button with no rules does nothing, and submit wording is the one the spec gives', async () => {
  const { s } = await fill('05-new-hire-onboarding');
  const a = s.press('CTRL-none');
  expect(a.changes).toEqual([]);
  expect(a.trace).toEqual([]);
  expect(NOT_IN_VIEWER).toBe('Not available in the viewer. Download the XML instead.');
});
