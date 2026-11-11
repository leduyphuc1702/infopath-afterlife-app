import { describe, expect, test } from 'vitest';
import { FillCommandError, runCycle, type Step } from '../../src/index';
import { fill, NOW } from './fill';

// Spec 04 task 2: R1.1, R1.2, R1.4, R2.1–R2.3, design D9–D14.

const AMOUNT = (n: number) => `/my:expenseClaim[1]/my:expenses[1]/my:expense[${n}]/my:amount[1]`;

describe('form 02: the total follows the amounts', () => {
  test('empty form: type an amount, the total is recalculated in the same command', async () => {
    const { s } = await fill('02-expense-report');
    const a = s.edit(AMOUNT(1), '12.5');
    expect(a.changes.map((c) => [c.path, c.after])).toEqual([
      [AMOUNT(1), '12.5'],
      ['/my:expenseClaim[1]/my:totalAmount[1]', '12.5'],
    ]);
    expect(a.passes).toBe(2);
    expect(a.trace.filter((t) => t.kind === 'calc').map((t) => t.caption)).toEqual([
      '/my:expenseClaim[1]/my:totalAmount[1]',
    ]);
  });

  test('a record: every row counts', async () => {
    const { s } = await fill('02-expense-report', '02-expense-report-003.xml');
    const rows = s.values('f:main:/my:expenseClaim/my:expenses/my:expense/my:amount');
    expect(rows.length).toBeGreaterThan(1);
    s.edit(AMOUNT(1), '1000');
    const total = rows.slice(1).reduce((t, v) => t + Number(v), 1000);
    expect(Number(s.values('f:main:/my:expenseClaim/my:totalAmount')[0])).toBeCloseTo(total, 9);
  });
});

test('form 04: the chain line total → subtotal → VAT → grand total settles in one command', async () => {
  const { s } = await fill('04-purchase-request', '04-purchase-request-001.xml');
  const line = '/my:purchaseRequest[1]/my:lines[1]/my:line[1]';
  s.edit(`${line}/my:quantity[1]`, '2');
  const a = s.edit(`${line}/my:unitPrice[1]`, '10');
  const v = (f: string) => s.values(`f:main:/my:purchaseRequest/${f}`);
  const lines = v('my:lines/my:line/my:lineTotal').map(Number);
  expect(lines[0]).toBe(20);
  const sub = lines.reduce((t, x) => t + x, 0);
  expect(Number(v('my:subtotal')[0])).toBeCloseTo(sub, 9);
  const vat = Math.round(sub * Number(v('my:vatRate')[0]) * 100) / 100;
  expect(Number(v('my:grandTotal')[0])).toBeCloseTo(sub + vat, 9);
  expect(
    a.trace.filter((t) => t.kind === 'calc').map((t) => t.caption.replace(/\[\d+\]/g, '')),
  ).toEqual([
    '/my:purchaseRequest/my:lines/my:line/my:lineTotal',
    '/my:purchaseRequest/my:subtotal',
    '/my:purchaseRequest/my:vatAmount',
    '/my:purchaseRequest/my:grandTotal',
  ]);
  expect(a.loop).toBeUndefined();
});

describe('onLoad (E3)', () => {
  test('form 01, empty: the request date defaults to today', async () => {
    const { s } = await fill('01-leave-request');
    expect(s.values('f:main:/my:leaveRequest/my:requestDate')).toEqual([NOW.slice(0, 10)]);
    expect(s.trace.find((t) => t.kind === 'rule')).toMatchObject({
      caption: 'Default request date',
      condition: true,
    });
  });
  test('form 01, a record: its own date is kept (the condition is false)', async () => {
    const { s } = await fill('01-leave-request', '01-leave-request-001.xml');
    expect(s.values('f:main:/my:leaveRequest/my:requestDate')[0]).not.toBe(NOW.slice(0, 10));
    expect(s.trace.find((t) => t.kind === 'rule')?.condition).toBe(false);
  });
});

test('form 03: a field-change rule clears the city when the country changes', async () => {
  const { s } = await fill('03-travel-request', '03-travel-request-001.xml');
  const city = s.values('f:main:/my:travelRequest/my:destCity');
  expect(city[0]).not.toBe('');
  const a = s.edit('/my:travelRequest[1]/my:destCountry[1]', 'XX');
  expect(s.values('f:main:/my:travelRequest/my:destCity')).toEqual(['']);
  expect(a.trace.find((t) => t.kind === 'rule')).toMatchObject({
    caption: 'Clear city when country changes',
    trigger: '/my:travelRequest[1]/my:destCountry[1]',
  });
});

describe('commands that name no editable node (R1.4)', () => {
  test.each([
    ['my:expenseClaim', 'syntax'],
    ['/my:expenseClaim[1]/../x[1]', 'syntax'],
    ['/my:expenseClaim[1]/my:nothing[1]', 'none'],
    [AMOUNT(9), 'none'],
    ['/my:expenseClaim[1]/my:expenses[1]', 'notField'],
    ['/my:expenseClaim[1]/my:totalAmount[1]', 'calculated'],
  ])('%s: %s, and nothing changes', async (path, reason) => {
    const { s } = await fill('02-expense-report');
    const before = s.xml();
    let err: unknown;
    try {
      s.edit(path, '1');
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(FillCommandError);
    expect((err as FillCommandError).reason).toBe(reason);
    expect(s.xml()).toBe(before);
  });
});

test('R2.2: an oscillating pair stops after 16 passes with the fields still changing', () => {
  const v = new Map([
    ['a', 0],
    ['b', 0],
  ]);
  const step = (id: string, from: string): Step<string> => ({
    id,
    reads: new Set([from]),
    run: () => {
      const before = v.get(id)!;
      const after = 1 - before;
      v.set(id, after);
      return [{ id, node: id, path: id, before: String(before), after: String(after) }];
    },
  });
  const r = runCycle([step('b', 'a'), step('a', 'b')], new Map([['a', ['a']]]));
  expect(r.passes).toBe(16);
  expect(r.loop).toEqual(['b', 'a']);
});

test('the empty form keeps processing instructions and nothing else is added', async () => {
  const { s } = await fill('02-expense-report');
  expect(s.xml()).toMatch(/<\?mso-infoPathSolution /);
});
