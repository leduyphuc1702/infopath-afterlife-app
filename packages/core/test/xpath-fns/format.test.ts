import { expect, test } from 'vitest';
import {
  formatOptions,
  formatString,
  parseDateTime,
  parseDecimal,
  roundDecimal,
} from '../../src/xpath-fns/format';

// Spec 03 R4.3 (task 2): the five formatString patterns of the 53 views, en-US. Values from
// docs/infopath-ux.md §3–4 ([seen]): a date shows as 11/3/2026, a total as $350.30.

const DATE = 'dateFormat:Short Date;';
const DATETIME = 'dateFormat:Short Date;timeFormat:h:mm:ss tt;';
const CURRENCY = 'numDigits:2;negativeOrder:0;positiveOrder:0;currencyLocale:1033;';
const INT = 'numDigits:0;negativeOrder:0;grouping:1;';
const DEC2 = 'numDigits:2;negativeOrder:0;grouping:1;';

test.each([
  // date + Short Date
  ['2026-11-03', 'date', DATE, '11/3/2026'],
  ['2025-07-28', 'date', DATE, '7/28/2025'],
  ['2024-02-29', 'date', DATE, '2/29/2024'],
  ['2026-11-03T09:30:00', 'date', DATE, '11/3/2026'],
  ['2026-11-03+07:00', 'date', DATE, '11/3/2026'],
  // datetime + h:mm:ss tt, as written (no time-zone conversion)
  ['2026-11-03T14:05:09', 'datetime', DATETIME, '11/3/2026 2:05:09 PM'],
  ['2026-11-03T00:00:00', 'datetime', DATETIME, '11/3/2026 12:00:00 AM'],
  ['2026-11-03T12:30:00Z', 'datetime', DATETIME, '11/3/2026 12:30:00 PM'],
  ['2026-11-03T09:07:01.250-08:00', 'datetime', DATETIME, '11/3/2026 9:07:01 AM'],
  ['2026-11-03', 'datetime', DATETIME, '11/3/2026'],
  // currency, 1033, numDigits:2, orders 0
  ['350.3', 'currency', CURRENCY, '$350.30'],
  ['350.30', 'currency', CURRENCY, '$350.30'],
  ['1234567.891', 'currency', CURRENCY, '$1,234,567.89'],
  ['0.005', 'currency', CURRENCY, '$0.01'],
  ['-0.004', 'currency', CURRENCY, '$0.00'],
  ['-12.5', 'currency', CURRENCY, '($12.50)'],
  ['.5', 'currency', CURRENCY, '$0.50'],
  ['  42  ', 'currency', CURRENCY, '$42.00'],
  ['999.995', 'currency', CURRENCY, '$1,000.00'],
  // number, numDigits:0, grouping:1
  ['1234', 'number', INT, '1,234'],
  ['1234.5', 'number', INT, '1,235'],
  ['2.5', 'number', INT, '3'],
  ['-2.5', 'number', INT, '(3)'],
  ['0', 'number', INT, '0'],
  ['007', 'number', INT, '7'],
  // number, numDigits:2, grouping:1
  ['1234.5', 'number', DEC2, '1,234.50'],
  ['0.125', 'number', DEC2, '0.13'],
  ['12345678901234567890.125', 'number', DEC2, '12,345,678,901,234,567,890.13'],
])('%s as %s (%s) → %s', (value, type, options, expected) => {
  expect(formatString(value, type, options)).toBe(expected);
});

test.each([
  ['empty', '', 'date', DATE, ''],
  ['not a date', 'tomorrow', 'date', DATE, 'tomorrow'],
  ['13th month', '2026-13-01', 'date', DATE, '2026-13-01'],
  ['30 February', '2026-02-30', 'date', DATE, '2026-02-30'],
  ['29 February, not a leap year', '2100-02-29', 'date', DATE, '2100-02-29'],
  ['hour 24', '2026-11-03T24:00:00', 'datetime', DATETIME, '2026-11-03T24:00:00'],
  ['not a number', 'abc', 'currency', CURRENCY, 'abc'],
  ['exponent (not XPath 1.0)', '1e3', 'number', INT, '1e3'],
  ['plus sign (not XPath 1.0)', '+5', 'number', INT, '+5'],
  ['a lone point', '.', 'number', INT, '.'],
  ['two points', '1.2.3', 'number', INT, '1.2.3'],
  ['another currency locale (task 7)', '5', 'currency', 'numDigits:2;currencyLocale:1036;', '5'],
  ['an unknown type (task 7)', '5', 'percentage', 'numDigits:0;', '5'],
  ['an unknown date format (task 7)', '2026-11-03', 'date', 'dateFormat:Long Date;', '2026-11-03'],
  ['numDigits:auto (task 7)', '5.25', 'number', 'numDigits:auto;', '5.25'],
])('%s is returned unchanged', (_name, value, type, options, expected) => {
  expect(formatString(value, type, options)).toBe(expected);
});

test('negative orders follow the Windows en-US tables', () => {
  const n = (order: number) =>
    formatString('-1234.5', 'number', `numDigits:1;negativeOrder:${order};grouping:1;`);
  expect([0, 1, 2, 3, 4].map(n)).toEqual([
    '(1,234.5)',
    '-1,234.5',
    '- 1,234.5',
    '1,234.5-',
    '1,234.5 -',
  ]);
  const c = (order: number) =>
    formatString('-1.5', 'currency', `numDigits:2;negativeOrder:${order};`);
  expect([0, 1, 2, 3].map(c)).toEqual(['($1.50)', '-$1.50', '$-1.50', '$1.50-']);
  const p = (order: number) =>
    formatString('1.5', 'currency', `numDigits:2;positiveOrder:${order};`);
  expect([0, 1, 2, 3].map(p)).toEqual(['$1.50', '1.50$', '$ 1.50', '1.50 $']);
});

test('options parse as key:value pairs; a value may hold spaces and colons', () => {
  expect([...formatOptions(DATETIME)]).toEqual([
    ['dateFormat', 'Short Date'],
    ['timeFormat', 'h:mm:ss tt'],
  ]);
});

test('rounding works on the decimal digits, half away from zero', () => {
  // 1.005 is 1.00499999… as a double; on its digits it rounds up.
  expect(roundDecimal(parseDecimal('1.005')!, 2)).toEqual({
    negative: false,
    int: '1',
    frac: '01',
  });
  expect(roundDecimal(parseDecimal('-0.5')!, 0)).toEqual({ negative: true, int: '1', frac: '' });
  expect(roundDecimal(parseDecimal('9.99')!, 1)).toEqual({ negative: false, int: '10', frac: '0' });
  expect(parseDateTime('2026-11-03T14:05:09')).toEqual({
    year: 2026,
    month: 11,
    day: 3,
    time: { hour: 14, minute: '05', second: '09' },
  });
});
