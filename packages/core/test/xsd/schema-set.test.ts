import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { classifyLocation } from '../../src/xsd/schema-set';
import { sampleSchemaSets, syntheticSet, syntheticXsd, xsdFiles } from '../helpers/schemas';
import { encode } from '../helpers/encode';

// R15.1 (resolution by name and location), R15.2, R15.5 (include, remote), R15.7 (one table per
// schema root); design §9.1, D9.

const DFS = 'http://schemas.microsoft.com/office/infopath/2003/dataFormSolution';
const sets = await sampleSchemaSets();

describe('in-repo samples', () => {
  test('every sample: no schema unknowns and no schema issues', () => {
    for (const [slug, set] of sets) {
      expect(set.unknowns, slug).toEqual([]);
      expect(set.issues, slug).toEqual([]);
      expect(set.main?.element, slug).toBeDefined();
    }
  });

  test('form 04: Vendors.xsd imports Vendors1.xsd and Vendors2.xsd; their globals are indexed', () => {
    const vendors = sets.get('04-purchase-request')!.secondary.Vendors!;
    expect(vendors.file).toBe('Vendors.xsd');
    expect(vendors.table.files.map((f) => f.file)).toEqual([
      'Vendors.xsd',
      'Vendors1.xsd',
      'Vendors2.xsd',
    ]);
    const d = vendors.table.get('element', {
      namespace: 'http://schemas.microsoft.com/office/infopath/2003/ado/dataFields',
      local: 'Vendors',
    })!;
    expect(d.doc.file).toBe('Vendors1.xsd');
    expect(d.node.children.flatMap((c) => c.children).map((a) => a.attrs.name)).toEqual([
      'VendorID',
      'VendorName',
    ]);
  });

  test('form 04: one table per root, so each data source has its own dfs:myFields', () => {
    const set = sets.get('04-purchase-request')!;
    expect(Object.keys(set.secondary)).toEqual(['Vendors', 'BudgetService']);
    const vendors = set.secondary.Vendors!;
    const budget = set.secondary.BudgetService!;
    expect(vendors.element!.name).toBe('myFields');
    expect(budget.element!.name).toBe('myFields');
    expect(vendors.element!.namespace).toBe(DFS);
    expect(vendors.element!.doc.file).toBe('Vendors.xsd');
    expect(budget.element!.doc.file).toBe('BudgetService.xsd');
    expect(budget.table.files.map((f) => f.file)).toEqual([
      'BudgetService.xsd',
      'BudgetService1.xsd',
    ]);
    expect(vendors.table.get('element', { namespace: DFS, local: 'myFields' })!.doc.file).toBe(
      'Vendors.xsd',
    );
  });

  test('main schema from rootSchema="yes" and the rootElement file property', () => {
    const main = sets.get('05-new-hire-onboarding')!.main!;
    expect(main.file).toBe('myschema.xsd');
    expect(main.element!.name).toBe('onboarding');
    expect(main.table.files.map((f) => f.file)).toEqual(['myschema.xsd']);
  });

  test('form 03: the secondary root is the first global element of locations.xsd', () => {
    const loc = sets.get('03-travel-request')!.secondary.Locations!;
    expect(loc.element!.name).toBe('locations');
    expect(loc.element!.namespace).toBeNull();
  });
});

describe('include and import (synthetic)', () => {
  test('include by last segment, case-insensitively; a chameleon include takes the namespace', () => {
    const set = syntheticSet(xsdFiles(syntheticXsd('include')), {
      file: 'main.xsd',
      rootElement: 'root',
    });
    expect(set.issues).toEqual([]);
    expect(set.unknowns).toEqual([]);
    const t = set.main!.table;
    expect(t.files.map((f) => f.file)).toEqual(['main.xsd', 'types.xsd', 'chameleon.xsd']);
    expect(t.get('type', { namespace: 'urn:inc', local: 'rootType' })!.doc.file).toBe('types.xsd');
    expect(t.get('element', { namespace: 'urn:inc', local: 'item' })!.doc.file).toBe(
      'chameleon.xsd',
    );
    expect(t.get('element', { namespace: null, local: 'item' })).toBeUndefined();
  });

  test('import with no schemaLocation resolves by namespace; the xml namespace import is silent', () => {
    const set = syntheticSet(xsdFiles(syntheticXsd('import-no-location')), { file: 'main.xsd' });
    expect(set.issues).toEqual([]);
    expect(set.main!.table.files.map((f) => f.file)).toEqual(['main.xsd', 'other.xsd']);
    expect(
      set.main!.table.get('element', { namespace: 'urn:other', local: 'thing' }),
    ).toBeDefined();
  });

  test('a file no root reaches is walked but in no table, with no issue', () => {
    const files = [
      ...xsdFiles(syntheticXsd('import-no-location')),
      ...xsdFiles(syntheticXsd('include')).filter((f) => f.name === 'chameleon.xsd'),
    ];
    const set = syntheticSet(files, { file: 'main.xsd' });
    expect(set.docs.map((d) => d.file)).toContain('chameleon.xsd');
    expect(set.main!.table.files.map((f) => f.file)).not.toContain('chameleon.xsd');
    expect(set.issues).toEqual([]);
  });
});

describe('remote and absolute locations (R15.2)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', () => {
      throw new Error('fetch must not be called');
    });
    vi.stubGlobal('XMLHttpRequest', function () {
      throw new Error('XMLHttpRequest must not be used');
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('none fetched; each records UNRESOLVED_REFERENCE with the reason', () => {
    const set = syntheticSet(
      xsdFiles(syntheticXsd()).filter((f) => f.name === 'remote-location.xsd'),
      { file: 'remote-location.xsd' },
    );
    expect(
      set.issues.map((i) => [i.code, i.details?.kind, i.details?.reference, i.details?.reason]),
    ).toEqual([
      ['UNRESOLVED_REFERENCE', 'import', 'http://forms-legacy/schemas/a.xsd', 'remote'],
      ['UNRESOLVED_REFERENCE', 'include', 'C:\\forms\\schemas\\b.xsd', 'absolute'],
      ['UNRESOLVED_REFERENCE', 'include', '/etc/schemas/c.xsd', 'absolute'],
      ['UNRESOLVED_REFERENCE', 'include', 'missing.xsd', 'notInPackage'],
    ]);
    expect(set.main!.element!.name).toBe('r');
  });

  test.each([
    ['http://x/a.xsd', { kind: 'remote' }],
    ['urn:x:a.xsd', { kind: 'remote' }],
    ['file:///a.xsd', { kind: 'remote' }],
    ['C:\\a.xsd', { kind: 'absolute' }],
    ['d:/a.xsd', { kind: 'absolute' }],
    ['\\\\server\\a.xsd', { kind: 'absolute' }],
    ['/a.xsd', { kind: 'absolute' }],
    ['../sub/A.xsd', { kind: 'file', name: 'A.xsd' }],
    ['sub\\b.xsd', { kind: 'file', name: 'b.xsd' }],
  ])('classifyLocation(%s)', (loc, expected) => {
    expect(classifyLocation(loc)).toEqual(expected);
  });
});

describe('DUPLICATE_GLOBAL (R15.7)', () => {
  const xsd = (name: string, body: string) => ({
    name,
    bytes: encode(
      `<xsd:schema targetNamespace="urn:d" xmlns:xsd="http://www.w3.org/2001/XMLSchema">${body}</xsd:schema>`,
      'utf-8',
    ),
  });

  test('a repeat inside one root keeps the first; the second is still walked', () => {
    const set = syntheticSet(
      [
        xsd(
          'a.xsd',
          '<xsd:include schemaLocation="b.xsd"/><xsd:element name="r" type="xsd:string"/>',
        ),
        xsd('b.xsd', '<xsd:element name="r" type="xsd:int" bogus="1"/>'),
      ],
      { file: 'a.xsd' },
    );
    expect(set.main!.table.get('element', { namespace: 'urn:d', local: 'r' })!.doc.file).toBe(
      'a.xsd',
    );
    expect(set.issues.map((i) => [i.code, i.details])).toEqual([
      [
        'DUPLICATE_GLOBAL',
        {
          kind: 'element',
          name: '{urn:d}r',
          file: 'b.xsd',
          path: '/xsd:schema[1]/xsd:element[1]',
          otherFile: 'a.xsd',
          otherPath: '/xsd:schema[1]/xsd:element[1]',
          root: 'a.xsd',
        },
      ],
    ]);
    expect(set.unknowns.map((u) => [u.file, u.name])).toEqual([['b.xsd', 'bogus']]);
  });

  test('complex and simple types share one symbol space; other kinds do not collide', () => {
    const set = syntheticSet(
      [
        xsd(
          'a.xsd',
          '<xsd:complexType name="t"/><xsd:simpleType name="t"><xsd:restriction base="xsd:string"/></xsd:simpleType><xsd:element name="t" type="xsd:string"/><xsd:attribute name="t"/><xsd:group name="t"><xsd:sequence/></xsd:group><xsd:attributeGroup name="t"/>',
        ),
      ],
      { file: 'a.xsd' },
    );
    expect(set.issues.map((i) => i.details?.kind)).toEqual(['type']);
  });

  test('the same name in two roots is no issue', () => {
    const set = syntheticSet(
      [xsd('a.xsd', '<xsd:element name="r"/>'), xsd('b.xsd', '<xsd:element name="r"/>')],
      undefined,
      { A: 'a.xsd', B: 'b.xsd' },
    );
    expect(set.issues).toEqual([]);
    expect(set.secondary.A!.element!.doc.file).toBe('a.xsd');
    expect(set.secondary.B!.element!.doc.file).toBe('b.xsd');
  });
});

describe('broken schema files are issues, not fatal (R5.4)', () => {
  test('malformed XML, a DOCTYPE and a non-schema root; the other file still loads', () => {
    const set = syntheticSet(
      [
        { name: 'bad.xsd', bytes: encode('<xsd:schema', 'utf-8') },
        { name: 'dtd.xsd', bytes: encode('<!DOCTYPE x><x/>', 'utf-8') },
        { name: 'other.xsd', bytes: encode('<root/>', 'utf-8') },
        {
          name: 'ok.xsd',
          bytes: encode(
            '<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema"><xsd:element name="r"/></xsd:schema>',
            'utf-8',
          ),
        },
      ],
      { file: 'ok.xsd' },
    );
    expect(set.issues.map((i) => [i.code, i.file])).toEqual([
      ['INVALID_XML', 'bad.xsd'],
      ['UNSAFE_XML', 'dtd.xsd'],
      ['INVALID_XML', 'other.xsd'],
    ]);
    expect(set.docs.map((d) => d.file)).toEqual(['ok.xsd']);
    expect(set.main!.element!.name).toBe('r');
  });
});
