import { describe, expect, test } from 'vitest';
import type { Issue } from '../../src/errors';
import { acceptsEmpty, toRegExp, type SimpleTypeInfo } from '../../src/xsd/empty-string';
import { buildFieldTree } from '../../src/xsd/field-tree';
import { syntheticSet, syntheticXsd, xsdFiles } from '../helpers/schemas';
import { encode } from '../helpers/encode';

// R14.4, design §9.3: does a type accept ''? Patterns go through toRegExp.

const atomic = (builtin: string, facets: [string, string, string?][] = []): SimpleTypeInfo => ({
  builtin,
  variety: 'atomic',
  facets: facets.map(([name, value, step]) => ({ name, value, step: step ?? 's1' })),
});
const accepts = (t: SimpleTypeInfo) => acceptsEmpty(t).accepts;

describe('built-in families', () => {
  test.each([
    'xsd:string',
    'xsd:normalizedString',
    'xsd:token',
    'xsd:anyURI',
    'xsd:base64Binary',
    'xsd:hexBinary',
    'xsd:anySimpleType',
  ])('%s accepts ""', (b) => {
    expect(accepts(atomic(b))).toBe(true);
  });

  test.each([
    'xsd:boolean',
    'xsd:decimal',
    'xsd:integer',
    'xsd:int',
    'xsd:double',
    'xsd:date',
    'xsd:dateTime',
    'xsd:time',
    'xsd:duration',
    'xsd:gYear',
    'xsd:QName',
    'xsd:NOTATION',
    'xsd:language',
    'xsd:Name',
    'xsd:NCName',
    'xsd:ID',
    'xsd:IDREF',
    'xsd:ENTITY',
    'xsd:NMTOKEN',
    // Part 2 defines these three as lists restricted with minLength 1.
    'xsd:NMTOKENS',
    'xsd:IDREFS',
    'xsd:ENTITIES',
  ])('%s rejects ""', (b) => {
    expect(accepts(atomic(b))).toBe(false);
  });
});

describe('lists and unions', () => {
  const list = (facets: [string, string][] = []): SimpleTypeInfo => ({
    builtin: 'xsd:anySimpleType',
    variety: 'list',
    facets: facets.map(([name, value]) => ({ name, value, step: 's' })),
  });

  test('a list accepts "" (zero items); minLength 1 or length 1 makes it reject', () => {
    expect(accepts(list())).toBe(true);
    expect(accepts(list([['minLength', '1']]))).toBe(false);
    expect(accepts(list([['length', '3']]))).toBe(false);
    expect(accepts(list([['maxLength', '3']]))).toBe(true);
  });

  test('a union accepts "" if any member does', () => {
    const u = (members: SimpleTypeInfo[], facets: [string, string][] = []): SimpleTypeInfo => ({
      builtin: 'xsd:anySimpleType',
      variety: 'union',
      members,
      facets: facets.map(([name, value]) => ({ name, value, step: 'u' })),
    });
    expect(accepts(u([atomic('xsd:date'), atomic('xsd:int')]))).toBe(false);
    expect(accepts(u([atomic('xsd:date'), atomic('xsd:string', [['enumeration', '']])]))).toBe(
      true,
    );
    expect(accepts(u([atomic('xsd:date'), atomic('xsd:token', [['enumeration', 'S']])]))).toBe(
      false,
    );
    // Facets on the union narrow it.
    expect(accepts(u([atomic('xsd:string')], [['enumeration', 'x']]))).toBe(false);
  });
});

describe('restriction facets', () => {
  test('enumeration with and without ""', () => {
    expect(
      accepts(
        atomic('xsd:string', [
          ['enumeration', 'a'],
          ['enumeration', ''],
        ]),
      ),
    ).toBe(true);
    expect(
      accepts(
        atomic('xsd:string', [
          ['enumeration', 'a'],
          ['enumeration', 'b'],
        ]),
      ),
    ).toBe(false);
    // Each restriction step narrows: '' must be in every step's list.
    expect(
      accepts(
        atomic('xsd:string', [
          ['enumeration', '', 's1'],
          ['enumeration', 'a', 's2'],
        ]),
      ),
    ).toBe(false);
  });

  test('length and minLength ≥ 1 reject; 0 does not', () => {
    expect(accepts(atomic('xsd:string', [['minLength', '1']]))).toBe(false);
    expect(accepts(atomic('xsd:string', [['length', '0']]))).toBe(true);
    expect(accepts(atomic('xsd:string', [['minLength', ' 2 ']]))).toBe(false);
  });

  test('[A-Z]{3}-[0-9]{4} rejects ""; patterns in one step are alternatives', () => {
    expect(accepts(atomic('xsd:string', [['pattern', '[A-Z]{3}-[0-9]{4}']]))).toBe(false);
    expect(accepts(atomic('xsd:string', [['pattern', '[A-Z]*']]))).toBe(true);
    expect(
      accepts(
        atomic('xsd:string', [
          ['pattern', 'x'],
          ['pattern', ''],
        ]),
      ),
    ).toBe(true);
    expect(
      accepts(
        atomic('xsd:string', [
          ['pattern', '', 's1'],
          ['pattern', 'x', 's2'],
        ]),
      ),
    ).toBe(false);
  });

  test('a pattern with \\i is unknown, naming the pattern', () => {
    expect(acceptsEmpty(atomic('xsd:string', [['pattern', '\\i\\c*']]))).toEqual({
      accepts: 'unknown',
      unevaluated: [{ pattern: '\\i\\c*', step: 's1' }],
    });
    // A pattern that can be evaluated and rejects '' decides it.
    expect(
      accepts(
        atomic('xsd:string', [
          ['pattern', '\\i\\c*', 's1'],
          ['minLength', '1', 's2'],
        ]),
      ),
    ).toBe(false);
  });
});

describe('toRegExp', () => {
  test.each([
    ['[A-Z]{3}-[0-9]{4}', 'ABC-1234', true],
    ['\\d{3}\\-\\d{4}', '555-1234', true],
    ['a$b', 'a$b', true],
    ['^x', '^x', true],
    ['[^a]', 'b', true],
    ['\\p{L}+', 'Ñandú', true],
    ['abc', 'xabcx', false],
  ])('%s on %s', (pattern, input, matches) => {
    expect(toRegExp(pattern)!.test(input)).toBe(matches);
  });

  test.each(['\\i\\c*', '\\I', '[a-z-[aeiou]]', '\\p{IsBasicLatin}', '(', '\\'])(
    '%s has no JavaScript equivalent',
    (pattern) => {
      expect(toRegExp(pattern)).toBeUndefined();
    },
  );
});

test('PATTERN_NOT_EVALUATED: once per pattern facet, required left false', () => {
  const set = syntheticSet(
    [
      {
        name: 's.xsd',
        bytes: encode(
          `<xsd:schema targetNamespace="urn:p" xmlns:p="urn:p" xmlns:xsd="http://www.w3.org/2001/XMLSchema" elementFormDefault="qualified">
<xsd:simpleType name="xmlName"><xsd:restriction base="xsd:string"><xsd:pattern value="\\i\\c*"/></xsd:restriction></xsd:simpleType>
<xsd:element name="r"><xsd:complexType><xsd:sequence>
  <xsd:element name="a" type="p:xmlName"/><xsd:element name="b" type="p:xmlName"/>
</xsd:sequence></xsd:complexType></xsd:element></xsd:schema>`,
          'utf-8',
        ),
      },
    ],
    { file: 's.xsd' },
  );
  const issues: Issue[] = [];
  const t = buildFieldTree(set.main!, issues)!;
  expect(t.root.children.map((c) => c.required)).toEqual([false, false]);
  expect(issues).toEqual([
    {
      code: 'PATTERN_NOT_EVALUATED',
      message: expect.stringContaining('\\i\\c*') as string,
      file: 's.xsd',
      path: '/xsd:schema[1]/xsd:simpleType[1]/xsd:restriction[1]',
      details: {
        pattern: '\\i\\c*',
        node: '/xsd:schema[1]/xsd:element[1]/xsd:complexType[1]/xsd:sequence[1]/xsd:element[1]',
      },
    },
  ]);
});

test('union.xsd: due accepts "" through its blank member; size does not', () => {
  const set = syntheticSet(
    xsdFiles(syntheticXsd()).filter((f) => f.name === 'union.xsd'),
    {
      file: 'union.xsd',
    },
  );
  const t = buildFieldTree(set.main!, [])!;
  expect(t.root.children.map((c) => [c.name, c.required])).toEqual([
    ['due', false],
    ['size', true],
    ['limited', true],
  ]);
});
