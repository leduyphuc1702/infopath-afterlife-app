import { expect, test } from 'vitest';
import { markersOf } from '../src/side/markers';
import { irOf } from './samples';

// R4.2 on forms 01–04.
const marked = async (slug: string, key: 'rule' | 'calculated' | 'validated' | 'connection') =>
  [...markersOf(await irOf(slug))]
    .filter(([, m]) => m[key])
    .map(([id]) => id.replace(/^f:[^:]*:/, ''));

test('form 02: the total is the one calculated field', async () => {
  expect(await marked('02-expense-report', 'calculated')).toEqual([
    '/my:expenseClaim/my:totalAmount',
  ]);
});

test("validated fields are the validations' targets (forms 01–04)", async () => {
  for (const slug of [
    '01-leave-request',
    '02-expense-report',
    '03-travel-request',
    '04-purchase-request',
  ]) {
    const ir = await irOf(slug);
    const want = [...new Set(ir.validations.flatMap((v) => (v.matchId ? [v.matchId] : [])))].sort();
    const got = [...markersOf(ir)]
      .filter(([, m]) => m.validated)
      .map(([id]) => id)
      .sort();
    expect(got, slug).toEqual(want);
    expect(got.length, slug).toBeGreaterThan(0);
  }
});

test('form 04: rules and data connections', async () => {
  expect(await marked('04-purchase-request', 'rule')).toMatchSnapshot();
  expect(await marked('04-purchase-request', 'connection')).toMatchSnapshot();
});

test('form 03: the city and country lists come from locations.xml', async () => {
  expect(await marked('03-travel-request', 'connection')).toMatchSnapshot();
});
