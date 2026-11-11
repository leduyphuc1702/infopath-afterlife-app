import { describe, expect, test } from 'vitest';
import { Evaluator, implementedFunctions, NotEvaluated, numberText } from '../../src/index';
import { parseXmlDom, xmlContext } from '../../src/xml/parse';
import { resolveLimits } from '../../src/limits';
import { fill, NOW } from './fill';

// Spec 04 task 1: R3.1–R3.4, design D5–D8.

const doc = (xml: string) =>
  parseXmlDom(new TextEncoder().encode(xml), 't.xml', xmlContext(resolveLimits())).doc;
const MY = 'http://example.com/my';
const d = doc(
  `<my:r xmlns:my="${MY}"><my:a>2</my:a><my:a></my:a><my:a>3.5</my:a><my:d>2026-01-30</my:d><my:s>b</my:s></my:r>`,
);
const ev = new Evaluator({ my: MY }, () => undefined, NOW);

describe('functions (D6)', () => {
  test.each([
    ['sum(xdMath:Nz(/my:r/my:a))', '5.5'],
    ['xdMath:Avg(/my:r/my:a[. != ""])', '2.75'],
    ['xdDate:Today()', '2026-11-11'],
    ['xdDate:Now()', '2026-11-11T09:00:00'],
    ['xdUser:get-UserName()', ''],
    ['msxsl:string-compare("2026-01-02", /my:r/my:d)', '-1'],
    ['msxsl:string-compare(/my:r/my:d, /my:r/my:d)', '0'],
    ['xdMath:Eval(/my:r/my:a, "number(.) * 2")', '4'],
    ['round(2.345 * 100) div 100', '2.35'],
    [
      'xdFormatting:formatString(1234.5, "number", "numDigits:2;negativeOrder:0;grouping:3;")',
      '1,234.50',
    ],
    ['concat(/my:r/my:s, "c")', 'bc'],
  ])('%s = %s', (expr, value) => {
    expect(ev.string(expr, d)).toBe(value);
  });

  test('the list of implemented functions', () => {
    const fns = implementedFunctions();
    console.log(`R3.1: ${fns.length} InfoPath functions: ${fns.join(', ')}`);
    for (const f of [
      'xdMath:Nz',
      'xdDate:Today',
      'xdXDocument:GetDOM',
      'msxsl:string-compare',
      'xdUser:get-UserName',
    ])
      expect(fns).toContain(f);
  });
});

describe('not evaluated (R3.2)', () => {
  test.each([
    ['xdDate:AddDays(/my:r/my:d, 1)', 'xdDate:AddDays is not available in the viewer'],
    ['xdMath:Nope(1)', 'xdMath:Nope is not available in the viewer'],
    ['zz:f(1)', ''],
    ['/my:r/', ''],
  ])('%s', (expr, reason) => {
    const e = (() => {
      try {
        ev.string(expr, d);
      } catch (x) {
        return x;
      }
    })();
    expect(e).toBeInstanceOf(NotEvaluated);
    expect((e as NotEvaluated).message).toContain(reason);
  });
});

test('number text follows XPath 1.0 (D7)', () => {
  expect(numberText(350.3)).toBe('350.3');
  expect(numberText(0.1 + 0.2)).toBe('0.30000000000000004');
  expect(numberText(1e21)).toBe('1000000000000000000000');
  expect(numberText(-0)).toBe('0');
  expect(numberText(NaN)).toBe('NaN');
});

describe('GetDOM (D8, R3.4)', () => {
  test('form 03: the Locations file in the template is readable', async () => {
    const { s } = await fill('03-travel-request');
    const e = (s as unknown as { evaluator: Evaluator }).evaluator;
    expect(
      Number(e.string('count(xdXDocument:GetDOM("Locations")/locations/country)', d)),
    ).toBeGreaterThan(1);
  });

  test('form 04: a query source is an empty document, said once in the trace', async () => {
    const { s } = await fill('04-purchase-request');
    const e = (s as unknown as { evaluator: Evaluator }).evaluator;
    expect(e.string('count(xdXDocument:GetDOM("Vendors")/*)', d)).toBe('0');
    expect(e.string('count(xdXDocument:GetDOM("Vendors")/*)', d)).toBe('0');
    expect(s.trace.filter((t) => t.caption === 'GetDOM("Vendors")').map((t) => t.note)).toEqual([
      'Query connections are not available in the viewer.',
    ]);
  });
});
