import { expect, test } from 'vitest';
import { History, UNDO_CAP } from '../../src/index';
import { fill } from './fill';

// Spec 04 task 12 (R10.1, D26).

test('History: undo and redo, a new command clears redo, the cap drops the oldest', () => {
  const h = new History<number>();
  for (let i = 0; i < UNDO_CAP + 5; i++) h.record(i);
  expect(h.undoable).toBe(UNDO_CAP);
  expect(h.undo(105)).toBe(104);
  expect(h.redoable).toBe(1);
  expect(h.redo(104)).toBe(105);
  expect(h.undo(105)).toBe(104);
  h.record(104);
  expect(h.redoable).toBe(0);
  let oldest: number | undefined;
  for (let s = h.undo(0); s !== undefined; s = h.undo(0)) oldest = s;
  expect(oldest).toBe(5);
  expect(h.undo(0)).toBeUndefined();
  expect(h.redo(0)).toBe(0);
});

test('FillSession snapshot and restore: an edit and a row insert undo and redo exactly', async () => {
  const { s } = await fill('02-expense-report');
  const E = '/my:expenseClaim[1]/my:expenses[1]/my:expense';
  const start = s.snapshot();
  s.edit(`${E}[1]/my:amount[1]`, '30');
  const edited = s.snapshot();
  s.insertRow('g:main:/my:expenseClaim/my:expenses/my:expense', { in: '/my:expenseClaim[1]' });
  s.edit(`${E}[2]/my:amount[1]`, '12');
  expect(s.text('/my:expenseClaim[1]/my:totalAmount[1]')).toBe('42');
  const end = s.snapshot();
  const a = s.restore(edited);
  expect(a.trace).toEqual([]);
  expect(s.xml()).toBe(edited.main);
  expect(s.paths('g:main:/my:expenseClaim/my:expenses/my:expense')).toHaveLength(1);
  expect(s.text('/my:expenseClaim[1]/my:totalAmount[1]')).toBe('30');
  s.restore(end);
  expect(s.xml()).toBe(end.main);
  s.restore(start);
  expect(s.xml()).toBe(start.main);
  // The restored document is live: commands keep working on it.
  s.edit(`${E}[1]/my:amount[1]`, '5');
  expect(s.text('/my:expenseClaim[1]/my:totalAmount[1]')).toBe('5');
});
