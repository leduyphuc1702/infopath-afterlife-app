import { describe, expect, test } from 'vitest';
import { syntheticSet, syntheticXsd, xsdFiles } from '../helpers/schemas';
import { encode } from '../helpers/encode';

// R15.4: XSD constructs the parser does not model are unknown entries, documented: true when
// XML Schema 1.0 defines them there; an identity constraint is one entry with its selector and
// field.

const files = xsdFiles(syntheticXsd());
const entries = (name: string) => {
  const set = syntheticSet(
    files.filter((f) => f.name === name),
    { file: name },
  );
  return set.unknowns.map((u) => [u.kind, u.name, u.path, u.documented]);
};
const E = '/xsd:schema[1]/xsd:element[1]';

describe.each([
  ['key.xsd', 'key'],
  ['keyref.xsd', 'keyref'],
  ['unique.xsd', 'unique'],
])('%s', (file, name) => {
  test(`one entry for xsd:${name}, its selector and field inside it`, () => {
    expect(entries(file)).toEqual([['element', name, `${E}/xsd:${name}[1]`, true]]);
    const set = syntheticSet(
      files.filter((f) => f.name === file),
      { file },
    );
    expect(set.unknowns[0]!.raw).toContain('<xsd:selector xpath="u:i"/>');
    expect(set.unknowns[0]!.raw).toContain('<xsd:field xpath="."/>');
  });
});

test.each([
  ['redefine.xsd', 'redefine', '/xsd:schema[1]/xsd:redefine[1]'],
  ['notation.xsd', 'notation', '/xsd:schema[1]/xsd:notation[1]'],
])('%s: one element entry', (file, name, path) => {
  expect(entries(file)).toEqual([['element', name, path, true]]);
});

test.each([
  [
    'substitution-group.xsd',
    'substitutionGroup',
    '/xsd:schema[1]/xsd:element[2]/@substitutionGroup',
  ],
  ['abstract.xsd', 'abstract', `${E}/@abstract`],
  ['block.xsd', 'block', `${E}/@block`],
  ['final.xsd', 'final', `${E}/@final`],
])('%s: one attribute entry', (file, name, path) => {
  expect(entries(file)).toEqual([['attribute', name, path, true]]);
});

test('blockDefault and finalDefault on xsd:schema are unknown, documented', () => {
  const set = syntheticSet(
    [
      {
        name: 's.xsd',
        bytes: encode(
          '<xsd:schema blockDefault="#all" finalDefault="extension" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><xsd:element name="r"/></xsd:schema>',
          'utf-8',
        ),
      },
    ],
    { file: 's.xsd' },
  );
  expect(set.unknowns.map((u) => [u.name, u.documented])).toEqual([
    ['blockDefault', true],
    ['finalDefault', true],
  ]);
});

test('a made-up xsd:foo and a foreign element are documented: false; annotation content is kept', () => {
  const set = syntheticSet(
    [
      {
        name: 's.xsd',
        bytes: encode(
          `<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:x="urn:x">
<xsd:foo/><x:bar/>
<xsd:element name="r"><xsd:annotation><xsd:documentation xml:lang="en">A <b>field</b>.</xsd:documentation><xsd:appinfo><x:any/></xsd:appinfo></xsd:annotation></xsd:element>
<xsd:element name="s" xsd:bad="1"><xsd:sequence/></xsd:element>
</xsd:schema>`,
          'utf-8',
        ),
      },
    ],
    { file: 's.xsd' },
  );
  expect(set.unknowns.map((u) => [u.kind, u.name, u.documented])).toEqual([
    ['element', 'foo', false],
    ['element', 'bar', false],
    ['attribute', 'bad', false],
    ['element', 'sequence', false],
  ]);
});
