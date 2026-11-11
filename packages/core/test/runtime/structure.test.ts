import { expect, test } from 'vitest';
import { FillCommandError } from '../../src/index';
import { fill, recordNames } from './fill';

// Spec 04 task 9 (R7.1–R7.3, D18, D19): rows and optional sections through FillSession.

const EXPENSE = 'g:main:/my:expenseClaim/my:expenses/my:expense';
const AMOUNT = 'f:main:/my:expenseClaim/my:expenses/my:expense/my:amount';
const TOTAL = 'f:main:/my:expenseClaim/my:totalAmount';

test('form 02: Insert item appends the fragment, Total follows the new row, remove restores', async () => {
  const { s } = await fill('02-expense-report', recordNames('02-expense-report')[0]);
  const start = s.xml();
  const rows = s.paths(EXPENSE);
  const a = s.insertRow(EXPENSE, { in: '/my:expenseClaim[1]' });
  expect(s.paths(EXPENSE)).toHaveLength(rows.length + 1);
  expect(a.focus).toBe(`/my:expenseClaim[1]/my:expenses[1]/my:expense[${rows.length + 1}]`);
  // The manifest's fragment: an empty, nil amount and type.
  expect(s.text(`${a.focus}/my:expenseType[1]`)).toBe('');
  expect(s.xml()).toContain('<my:amount xsi:nil="true"/>');
  const total = Number(s.values(TOTAL)[0]);
  s.edit(`${a.focus}/my:amount[1]`, '10');
  expect(Number(s.values(TOTAL)[0])).toBeCloseTo(total + 10, 6);
  const r = s.removeRow(a.focus!);
  expect(r.focus).toBe(rows[rows.length - 1]);
  expect(Number(s.values(TOTAL)[0])).toBeCloseTo(total, 6);
  // Spec 14 B4: the record keeps its stored "350.30" at open; the edit and the remove wrote the
  // Total again, as 350.3. Everything else is as it was.
  const total2 = (x: string) => x.replace(/<my:totalAmount>[^<]*</, '<my:totalAmount><');
  expect(total2(s.xml())).toBe(total2(start));
});

test('form 02: insert above and below a row; remove gives focus to the row that took its place', async () => {
  const { s } = await fill('02-expense-report', recordNames('02-expense-report')[0]);
  const [first] = s.paths(EXPENSE);
  s.edit(`${first}/my:amount[1]`, '5');
  const above = s.insertRow(EXPENSE, { row: first!, where: 'before' });
  expect(above.focus).toBe(first);
  expect(s.values(AMOUNT)[0]).toBe('');
  expect(s.values(AMOUNT)[1]).toBe('5');
  const below = s.insertRow(EXPENSE, { row: above.focus!, where: 'after' });
  expect(below.focus).toBe('/my:expenseClaim[1]/my:expenses[1]/my:expense[2]');
  const removed = s.removeRow(below.focus!);
  // The old first row moved up into position 2.
  expect(removed.focus).toBe('/my:expenseClaim[1]/my:expenses[1]/my:expense[2]');
  expect(s.text(`${removed.focus}/my:amount[1]`)).toBe('5');
});

test('form 02: every row removed, then Insert item brings one back', async () => {
  const { s } = await fill('02-expense-report');
  for (const p of s.paths(EXPENSE).reverse()) s.removeRow(p);
  expect(s.paths(EXPENSE)).toEqual([]);
  expect(s.values(TOTAL)[0]).toBe('0');
  const a = s.insertRow(EXPENSE, { in: '/my:expenseClaim[1]' });
  expect(a.focus).toBe('/my:expenseClaim[1]/my:expenses[1]/my:expense[1]');
});

test('form 05: the optional Relocation section inserts and removes', async () => {
  const G = 'g:main:/my:onboarding/my:relocation';
  const { s } = await fill('05-new-hire-onboarding');
  const start = s.xml();
  if (s.paths(G).length > 0) s.removeOptional(s.paths(G)[0]!);
  const without = s.xml();
  expect(s.paths(G)).toEqual([]);
  const a = s.insertOptional(G, '/my:onboarding[1]');
  expect(a.focus).toBe('/my:onboarding[1]/my:relocation[1]');
  expect(s.text('/my:onboarding[1]/my:relocation[1]/my:relocateFrom[1]')).toBe('');
  s.removeOptional(a.focus!);
  expect(s.xml()).toBe(without);
  if (start === without) expect(s.paths(G)).toEqual([]);
});

test('commands that name the wrong thing are FILL_PATH errors', async () => {
  const { s } = await fill('02-expense-report');
  const err = (f: () => unknown) => {
    try {
      f();
    } catch (e) {
      return e instanceof FillCommandError ? e.reason : 'other';
    }
    return 'none thrown';
  };
  expect(err(() => s.insertRow('g:main:/my:expenseClaim', { in: '/my:expenseClaim[1]' }))).toBe(
    'notGroup',
  );
  expect(err(() => s.removeRow('/my:expenseClaim[1]/my:totalAmount[1]'))).toBe('notGroup');
  expect(err(() => s.insertOptional(EXPENSE, '/my:expenseClaim[1]'))).toBe('notGroup');
  expect(err(() => s.removeRow('/my:expenseClaim[1]/my:expenses[1]/my:expense[9]'))).toBe('none');
});
