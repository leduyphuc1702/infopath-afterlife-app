import { describe, expect, test } from 'vitest';
import { parseExpression, tokenize, wholePath, type LocationPath } from '../../src/ir/xpath/tokens';

// Spec 02 R11.1, design §7.1.

const kinds = (s: string) => tokenize(s).map((t) => (t.t === 'op' ? t.v : t.t));
const texts = (s: string) => parseExpression(s).paths.map((p) => s.slice(p.pos, p.end));
const all = (s: string): string[] => {
  const out: string[] = [];
  const walk = (paths: readonly LocationPath[]) => {
    for (const p of paths) {
      out.push(s.slice(p.pos, p.end));
      for (const st of p.steps) for (const e of st.predicates) walk(e.paths);
    }
  };
  walk(parseExpression(s).paths);
  return out;
};

describe('XPath 1.0 §3.7 disambiguation', () => {
  test.each([
    ['div div div', ['name', 'div', 'name']],
    ['mod mod 2', ['name', 'mod', 'num']],
    ['and and or', ['name', 'and', 'name']],
    ['my:and and 1', ['name', 'and', 'num']],
    ['* * 2', ['name', '*', 'num']],
    ['my:a * my:*', ['name', '*', 'name']],
    ['(1) div 2', ['(', 'num', ')', 'div', 'num']],
    ['a[1] mod 2', ['name', '[', 'num', ']', 'mod', 'num']],
    ['child::a/attribute::b', ['axis', 'name', 'slash', 'axis', 'name']],
    ['node() | text()', ['nodetype', '(', ')', '|', 'nodetype', '(', ')']],
    ['xdMath:Nz(.)', ['func', '(', 'dot', ')']],
    ['$v/x', ['var', 'slash', 'name']],
  ])('%s', (s, expected) => {
    expect(kinds(s)).toEqual(expected);
  });

  test('an unterminated literal is a lex error', () => {
    expect(() => tokenize('"abc')).toThrow(/lex error/);
  });
});

describe('location paths', () => {
  test('operators, functions and numbers are not paths', () => {
    expect(texts('xdMath:Nz(../my:quantity) * xdMath:Nz(../my:unitPrice) div 100')).toEqual([
      '../my:quantity',
      '../my:unitPrice',
    ]);
  });

  test('a path inside a string literal is not a path', () => {
    expect(texts('concat("Total /my:grandTotal ", /my:purchaseRequest/my:grandTotal)')).toEqual([
      '/my:purchaseRequest/my:grandTotal',
    ]);
    expect(texts('string("my:a/my:b")')).toEqual([]);
  });

  test('div, mod and and as element names inside a path', () => {
    expect(texts('/my:x/div/mod and and')).toEqual(['/my:x/div/mod', 'and']);
  });

  test('nested predicates are collected with their own paths', () => {
    expect(all('my:a[my:b[@c = 1] > my:d]/my:e')).toEqual([
      'my:a[my:b[@c = 1] > my:d]/my:e',
      'my:b[@c = 1]',
      '@c',
      'my:d',
    ]);
  });

  test('GetDOM and current() start paths; the GetDOM name is kept', () => {
    const s =
      'xdXDocument:GetDOM("Locations")/locations/country[@code = current()/my:destCountry]/city';
    expect(all(s)).toEqual([s, '@code', 'current()/my:destCountry']);
    expect(parseExpression(s).paths[0]!.start).toEqual({ kind: 'getDom', name: 'Locations' });
    expect(parseExpression('xdXDocument:GetDOM($n)/a').paths[0]!.start).toEqual({
      kind: 'dynamicGetDom',
    });
  });

  test('xdMath:Eval: its second argument is a string expression', () => {
    const s = 'xdMath:Eval(my:rows/my:row, "my:qty * my:price")';
    const e = parseExpression(s);
    expect(texts(s)).toEqual(['my:rows/my:row']);
    expect(e.stringExpressions.map((x) => s.slice(x.pos, x.end))).toEqual(['"my:qty * my:price"']);
  });

  test('// and a filter expression start are recorded as such', () => {
    const e = parseExpression('count(//my:item) + (my:a)/my:b');
    expect(e.paths.map((p) => [p.start.kind, p.steps.map((x) => x.descendant)])).toEqual([
      ['absolute', [true]],
      ['relative', [false]],
      ['filter', [false]],
    ]);
  });

  test('wholePath: one path covering the string', () => {
    const one = '  /my:a/my:b ';
    expect(wholePath(one, parseExpression(one))).toBeDefined();
    const two = 'my:a + 1';
    expect(wholePath(two, parseExpression(two))).toBeUndefined();
  });
});
