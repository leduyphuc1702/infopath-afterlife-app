import { expect, test } from 'vitest';
import {
  formatOptions,
  formatString,
  formatStringResult,
  parseDateTime,
  parseDecimal,
  roundDecimal,
} from '../../src/xpath-fns/format';

// Spec 03 R4.3: task 2 covered the five formatString patterns of the 53 views; task 7 adds every
// corpus pattern, the order tables and the issues (end of file). en-US. Values from
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
    time: { hour: 14, minute: 5, second: 9 },
  });
});

// --- Task 7: every corpus pattern, the order tables and the issues (design §7.1) ----------------

const NUM0 = 'numDigits:0;negativeOrder:1;';
const NUM2 = 'numDigits:2;negativeOrder:1;';
const AUTO = 'numDigits:auto;negativeOrder:1;';
const PCT = 'numDigits:0;negativeOrder:1;';

test.each([
  // The 14 type/options pairs of the corpus (docs/feature-coverage.md D), one case each.
  ['date Short Date', '2026-11-03', 'date', DATE, '11/3/2026'],
  ['datetime h:mm:ss tt', '2026-11-03T14:05:09', 'datetime', DATETIME, '11/3/2026 2:05:09 PM'],
  [
    'datetime timeFormat:none',
    '2026-11-03T14:05:09',
    'datetime',
    'dateFormat:Short Date;timeFormat:none;',
    '11/3/2026',
  ],
  [
    'datetime dd MMMM, yyyy',
    '2026-11-03T14:05:09',
    'datetime',
    'dateFormat:dd MMMM, yyyy;timeFormat:none;',
    '03 November, 2026',
  ],
  [
    'datetime dd-MMM-yy',
    '2026-01-09',
    'datetime',
    'dateFormat:dd-MMM-yy;timeFormat:none;',
    '09-Jan-26',
  ],
  ['time, no options', '09:30:00', 'time', '', '9:30:00 AM'],
  ['number 0, grouped', '12345.5', 'number', INT, '12,346'],
  ['number 2, grouped', '0.1', 'number', DEC2, '0.10'],
  ['number 0, not grouped', '12345.4', 'number', NUM0, '12345'],
  ['number 2, not grouped', '-1234.567', 'number', NUM2, '-1234.57'],
  ['number auto', '-1234.50', 'number', AUTO, '-1234.50'],
  ['currency 1033', '3021.6', 'currency', CURRENCY, '$3,021.60'],
  ['percentage', '0.256', 'percentage', PCT, '26%'],
  ['string plainMultiline', 'line 1\nline 2', 'string', 'plainMultiline', 'line 1\nline 2'],
])('%s', (_name, value, type, options, expected) => {
  expect(formatStringResult(value, type, options)).toEqual({ text: expected });
});

test.each([
  ['Long Date', '2026-11-03', 'date', 'dateFormat:Long Date;', 'Tuesday, November 3, 2026'],
  ['ddd d MMM', '2000-02-29', 'date', 'dateFormat:ddd d MMM yyyy;', 'Tue 29 Feb 2000'],
  ['quoted text', '2026-11-03', 'date', "dateFormat:'Day' d 'of' MMMM;", 'Day 3 of November'],
  ['y and yy', '2005-03-04', 'date', 'dateFormat:y/yy;', '5/05'],
  [
    'HH:mm',
    '2026-11-03T00:07:00',
    'datetime',
    'dateFormat:Short Date;timeFormat:HH:mm;',
    '11/3/2026 00:07',
  ],
  ['h at noon and midnight', '12:00:00', 'time', 'timeFormat:h tt;', '12 PM'],
  ['h at midnight', '00:00:00', 'time', 'timeFormat:h tt;', '12 AM'],
  ['t', '13:00:00', 'time', 'timeFormat:h t;', '1 P'],
  ['time of a dateTime', '2026-11-03T23:59:59Z', 'time', '', '11:59:59 PM'],
  ['datetime with a date only', '2026-11-03', 'datetime', DATETIME, '11/3/2026'],
  [
    'percentage, 2 digits, grouped',
    '123.45678',
    'percentage',
    'numDigits:2;grouping:1;',
    '12,345.68%',
  ],
  ['percentage, negative', '-0.5', 'percentage', PCT, '-50%'],
  ['percentage, positiveOrder 0', '0.5', 'percentage', 'numDigits:0;positiveOrder:0;', '50 %'],
  ['number auto, grouped', '1234567.125', 'number', 'numDigits:auto;grouping:1;', '1,234,567.125'],
  ['negative zero after rounding', '-0.004', 'number', NUM2, '0.00'],
])('%s', (_name, value, type, options, expected) => {
  expect(formatString(value, type, options)).toBe(expected);
});

test('currency negative orders follow LOCALE_INEGCURR 0–15, positive orders LOCALE_ICURRENCY 0–3', () => {
  const neg = (o: number) => formatString('-1234.5', 'currency', `numDigits:2;negativeOrder:${o};`);
  expect(Array.from({ length: 16 }, (_, o) => neg(o))).toEqual([
    ...['($1,234.50)', '-$1,234.50', '$-1,234.50', '$1,234.50-', '(1,234.50$)', '-1,234.50$'],
    ...['1,234.50-$', '1,234.50$-', '-1,234.50 $', '-$ 1,234.50', '1,234.50 $-', '$ 1,234.50-'],
    ...['$ -1,234.50', '1,234.50- $', '($ 1,234.50)', '(1,234.50 $)'],
  ]);
  const pos = (o: number) => formatString('1234.5', 'currency', `numDigits:2;positiveOrder:${o};`);
  expect([0, 1, 2, 3].map(pos)).toEqual(['$1,234.50', '1,234.50$', '$ 1,234.50', '1,234.50 $']);
});

test('percentage negative orders follow LOCALE_INEGATIVEPERCENT 0–11', () => {
  const neg = (o: number) => formatString('-0.25', 'percentage', `numDigits:0;negativeOrder:${o};`);
  expect(Array.from({ length: 12 }, (_, o) => neg(o))).toEqual([
    ...['-25 %', '-25%', '-%25', '%-25', '%25-', '25-%', '25%-', '-% 25', '25 %-', '% 25-'],
    ...['% -25', '25- %'],
  ]);
});

test.each([
  ['an unknown type', '5', 'fraction', 'numDigits:0;', 'type'],
  ['an unknown option', '5', 'number', 'numDigits:0;decimalSeparator:,;', 'decimalSeparator'],
  ['an unknown named date format', '2026-11-03', 'date', 'dateFormat:Medium Date;', 'dateFormat'],
  ['no dateFormat', '2026-11-03', 'date', '', 'dateFormat'],
  ['a picture run the tables lack', '2026-11-03', 'date', 'dateFormat:ddddd;', 'dateFormat'],
  ['numDigits out of range', '5', 'number', 'numDigits:100;', 'numDigits'],
  ['negativeOrder out of range', '-5', 'number', 'numDigits:0;negativeOrder:5;', 'negativeOrder'],
  ['currency negativeOrder 16', '-5', 'currency', 'numDigits:0;negativeOrder:16;', 'negativeOrder'],
  ['grouping 2', '5', 'number', 'numDigits:0;grouping:2;', 'grouping'],
  ['time with timeFormat:none', '09:30:00', 'time', 'timeFormat:none;', 'timeFormat'],
])('%s: the value unchanged, with FORMAT_UNSUPPORTED', (_name, value, type, options, option) => {
  expect(formatStringResult(value, type, options)).toEqual({
    text: value,
    unsupported: { type, option },
  });
});

test('an unparseable value is returned unchanged, with no issue (R4.3)', () => {
  for (const [value, type, options] of [
    ['soon', 'date', DATE],
    ['25:00:00', 'time', ''],
    ['n/a', 'percentage', PCT],
    ['1,234', 'currency', CURRENCY],
  ] as const) {
    expect(formatStringResult(value, type, options)).toEqual({ text: value });
  }
});

test('currencyLocale other than 1033 formats as en-US and names the locale', () => {
  expect(formatStringResult('5', 'currency', 'numDigits:2;currencyLocale:1036;')).toEqual({
    text: '$5.00',
    locale: '1036',
  });
});
