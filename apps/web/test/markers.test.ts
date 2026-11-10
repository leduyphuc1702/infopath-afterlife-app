import { expect, test } from 'vitest';
import { markersOf } from '../src/side/markers';
import { irOf, OWN_08 } from './samples';

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

// `Changed at review:` "Required" follows the asterisk (spec 03 §9.2): FormIR `required`, or a
// blank check. Form 01's four required fields are all blank checks; none is `required` in FormIR.
test('form 01: Employee name, Employee ID, First day and Last day of leave are Required', async () => {
  const ir = await irOf('01-leave-request');
  const m = markersOf(ir);
  const labels = ir.fields.filter((f) => m.get(f.id)?.required).map((f) => f.label);
  expect(labels).toEqual([
    'Employee name',
    'Employee ID',
    'First day of leave',
    'Last day of leave',
  ]);
  // "Validated" is what is left: Last day of leave (after the first day) and Days requested.
  expect(await marked('01-leave-request', 'validated')).toEqual([
    '/my:leaveRequest/my:endDate',
    '/my:leaveRequest/my:daysRequested',
  ]);
});

test('Required is FormIR required or a blank check (forms 01–08)', async () => {
  for (const slug of OWN_08) {
    const ir = await irOf(slug);
    const blank = ir.validations.filter(
      (v) => v.expressionContext === '.' && v.expression?.replace(/\s+/g, '') === '.=""',
    );
    const want = new Set([
      ...ir.fields.filter((f) => f.required).map((f) => f.id),
      ...blank.flatMap((v) => (v.matchId ? [v.matchId] : [])),
    ]);
    const got = [...markersOf(ir)].filter(([, x]) => x.required).map(([id]) => id);
    expect(new Set(got), slug).toEqual(want);
  }
});

test('validated fields are the targets of validations other than the blank check (forms 01–04)', async () => {
  for (const slug of [
    '01-leave-request',
    '02-expense-report',
    '03-travel-request',
    '04-purchase-request',
  ]) {
    const ir = await irOf(slug);
    const want = [
      ...new Set(
        ir.validations.flatMap((v) =>
          v.matchId && v.expression?.replace(/\s+/g, '') !== '.=""' ? [v.matchId] : [],
        ),
      ),
    ].sort();
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
