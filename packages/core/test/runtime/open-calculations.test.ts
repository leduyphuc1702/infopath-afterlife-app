import { expect, test } from 'vitest';
import { fill, recordNames } from './fill';

// Spec 14 B4: opening a record recalculates every calculated field (D13), but a stored value
// equal to the new number at the precision it was stored with stays as stored, untraced.

test('form 04 record 1: nothing is worked out again and the XML is the stored one', async () => {
  const r = recordNames('04-purchase-request')[0];
  const { s } = await fill('04-purchase-request', r);
  const { s: raw } = await fill('04-purchase-request', r, false);
  expect(s.opened.trace.filter((e) => e.kind === 'calc')).toEqual([]);
  expect(s.xml()).toBe(raw.xml());
});

test('form 02 record 1: Total 350.30 stays 350.30', async () => {
  const { s } = await fill('02-expense-report', recordNames('02-expense-report')[0]);
  expect(s.text('/my:expenseClaim[1]/my:totalAmount[1]')).toBe('350.30');
  expect(s.opened.trace.filter((e) => e.kind === 'calc')).toEqual([]);
});

test('an empty stored total is still worked out and traced (form 10 record 1)', async () => {
  const { s } = await fill('10-timesheet', recordNames('10-timesheet')[0]);
  const calc = s.opened.trace.filter((e) => e.kind === 'calc');
  expect(calc).toHaveLength(1);
  expect(calc[0]!.changes[0]).toMatchObject({ before: '', after: '776.01' });
});

test('a stored value that disagrees with its calculation is corrected and traced', async () => {
  const r = recordNames('04-purchase-request')[0];
  const { s } = await fill('04-purchase-request', r);
  const a = s.edit('/my:purchaseRequest[1]/my:lines[1]/my:line[1]/my:quantity[1]', '8');
  expect(a.trace.filter((e) => e.kind === 'calc').length).toBeGreaterThanOrEqual(4);
});
