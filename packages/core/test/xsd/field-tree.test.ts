import { describe, expect, test } from 'vitest';
import type { Issue } from '../../src/errors';
import { buildFieldTree } from '../../src/xsd/field-tree';
import type { SchemaRoot } from '../../src/xsd/schema-set';
import type { FieldNode, FieldTree } from '../../src/xsd/types';
import { sampleSchemaSets, syntheticSet, syntheticXsd, xsdFiles } from '../helpers/schemas';
import { readmeTable } from '../oracles/readme-table';

// R14.1–R14.3, R14.5–R14.8 (shape; `required` is task 20), R15.1 (named types), R15.3, R15.7.

const sets = await sampleSchemaSets();

function tree(root: SchemaRoot | undefined): { tree: FieldTree; issues: Issue[] } {
  const issues: Issue[] = [];
  const t = buildFieldTree(root!, issues);
  return { tree: t!, issues };
}
const main = (slug: string) => tree(sets.get(slug)!.main).tree;

function nodes(n: FieldNode): FieldNode[] {
  return [n, ...n.children.flatMap(nodes)];
}
/** The node at a `/`-separated name path below the root. */
function at(t: FieldTree, path: string): FieldNode {
  let n = t.root;
  for (const name of path.split('/')) {
    const next = n.children.find((c) => c.name === name);
    if (!next) throw new Error(`${path}: no ${name} under ${n.name}`);
    n = next;
  }
  return n;
}

describe('every sample', () => {
  const rows = new Map(readmeTable().map((r) => [r.slug, r.counts]));

  test.each([...sets.keys()])('%s: no issues; element counts match README Fields', (slug) => {
    const { tree: t, issues } = tree(sets.get(slug)!.main);
    expect(issues).toEqual([]);
    const elements = nodes(t.root).filter((n) => n.nodeType === 'element');
    const expected = rows.get(slug)?.Fields ?? 5; // the public sample: R16.2
    expect(elements).toHaveLength(expected);
    for (const n of nodes(t.root)) expect(n.required, n.name).toBe(false);
  });
});

describe('R14.8 oracle (shape)', () => {
  test('form 04 line: repeating, raw "0" and "unbounded"', () => {
    const line = nodes(main('04-purchase-request').root).find((n) => n.name === 'line')!;
    expect(line.repeating).toBe(true);
    expect(line.optional).toBe(true);
    expect(line.raw).toMatchObject({ minOccurs: '0', maxOccurs: 'unbounded' });
    expect(line.effective).toEqual({ minOccurs: 0, maxOccurs: 'unbounded', nillable: false });
    expect(line.use).toBeDefined(); // a ref site
  });

  test('form 05: relocation optional, fullTime/contractor one choiceGroup, welcomeNote richText', () => {
    const t = main('05-new-hire-onboarding');
    expect(at(t, 'relocation').optional).toBe(true);
    const fullTime = at(t, 'employment/fullTime');
    const contractor = at(t, 'employment/contractor');
    expect(fullTime.choiceGroup).toBeDefined();
    expect(fullTime.choiceGroup).toBe(contractor.choiceGroup);
    expect(fullTime.optional).toBe(false); // alternation is not minOccurs = 0
    expect(fullTime.raw.groups).toEqual([{ kind: 'choice' }]);
    const note = at(t, 'welcomeNote');
    expect(note.kind).toBe('richText');
    expect(note.children).toEqual([]);
    expect(note.wildcards).toEqual([]);
    expect(
      nodes(t.root)
        .filter((n) => n.repeating || n.optional)
        .map((n) => n.name),
    ).toEqual(['relocation']);
  });

  test('form 45: signatures1 and signatures2 are groups; signatures2 has one XML-DSig wildcard', () => {
    const t = main('45-policy-acknowledgement');
    expect(at(t, 'signatures1').kind).toBe('group');
    const s2 = at(t, 'signatures1/signatures2');
    expect(s2.kind).toBe('group');
    expect(s2.children).toEqual([]);
    expect(s2.wildcards).toEqual([
      {
        kind: 'any',
        namespace: 'http://www.w3.org/2000/09/xmldsig#',
        processContents: 'lax',
        minOccurs: '0',
        maxOccurs: 'unbounded',
      },
    ]);
  });

  test('form 47: borrower through personType; assetTag pattern; assetCondition facets', () => {
    const t = main('47-asset-checkout-script');
    const my = t.root.namespace!;
    const borrower = at(t, 'borrower');
    expect(borrower.kind).toBe('group');
    expect(borrower.xsdType.declared).toBe(`{${my}}personType`);
    expect(borrower.children.map((c) => c.name)).toEqual(['borrowerName', 'borrowerEmail']);
    const tag = at(t, 'assetTag');
    expect(tag.xsdType).toEqual({
      declared: `{${my}}assetTagType`,
      builtin: 'xsd:string',
      variety: 'atomic',
    });
    expect(tag.facets.map((f) => [f.name, f.value])).toEqual([['pattern', '[A-Z]{3}-[0-9]{4}']]);
    expect(at(t, 'assetCondition').facets.map((f) => [f.name, f.value])).toEqual([
      ['enumeration', 'New'],
      ['enumeration', 'Good'],
      ['enumeration', 'Worn'],
      ['maxLength', '10'],
    ]);
    expect(at(t, 'checkoutDate').effective.nillable).toBe(true);
  });

  test('secondary schemas of forms 03 and 04 have attribute nodes', () => {
    const loc = tree(sets.get('03-travel-request')!.secondary.Locations).tree;
    const country = at(loc, 'country');
    expect(country.children.map((c) => [c.name, c.nodeType])).toEqual([
      ['city', 'element'],
      ['code', 'attribute'],
      ['name', 'attribute'],
    ]);
    const vendors = tree(sets.get('04-purchase-request')!.secondary.Vendors).tree;
    const row = at(vendors, 'dataFields/Vendors');
    expect(row.repeating).toBe(true);
    expect(row.children.map((c) => [c.name, c.nodeType, c.namespace, c.optional])).toEqual([
      ['VendorID', 'attribute', null, true],
      ['VendorName', 'attribute', null, true],
    ]);
  });
});

describe('R15.7: form 04 has two myFields trees, each with its own children', () => {
  const set = sets.get('04-purchase-request')!;

  test('keyed by data object name', () => {
    expect(Object.keys(set.secondary)).toEqual(['Vendors', 'BudgetService']);
  });

  test('Vendors: queryFields/Vendors and dataFields/Vendors from Vendors1/2.xsd', () => {
    const t = tree(set.secondary.Vendors).tree;
    expect(t.file).toBe('Vendors.xsd');
    expect(t.root.name).toBe('myFields');
    expect(t.root.source.file).toBe('Vendors.xsd');
    expect(at(t, 'queryFields/Vendors').source.file).toBe('Vendors2.xsd');
    expect(at(t, 'dataFields/Vendors').source.file).toBe('Vendors1.xsd');
  });

  test('BudgetService: the web service request and response from BudgetService1.xsd', () => {
    const t = tree(set.secondary.BudgetService).tree;
    expect(t.file).toBe('BudgetService.xsd');
    expect(t.root.name).toBe('myFields');
    expect(t.root.source.file).toBe('BudgetService.xsd');
    expect(at(t, 'queryFields/GetRemainingBudget/costCenter').source.file).toBe(
      'BudgetService1.xsd',
    );
    expect(nodes(t.root).map((n) => n.name)).not.toContain('VendorID');
  });
});

describe('synthetic', () => {
  const synthetic = (file: string) => {
    const set = syntheticSet(
      xsdFiles(syntheticXsd()).filter((f) => f.name === file),
      { file },
    );
    expect(set.issues).toEqual([]);
    expect(set.unknowns).toEqual([]);
    return tree(set.main);
  };

  test('kinds: one element per row of the kind table', () => {
    const { tree: t, issues } = synthetic('kinds.xsd');
    expect(issues).toEqual([]);
    expect(t.root.children.map((c) => [c.name, c.kind, c.xsdType.builtin])).toEqual([
      ['simple', 'field', 'xsd:date'],
      ['inlineSimple', 'field', 'xsd:integer'],
      ['simpleContent', 'field', 'xsd:string'],
      ['rich', 'richText', 'xsd:anyType'],
      ['xhtmlNotMixed', 'group', 'xsd:anyType'],
      ['wildcardOnly', 'group', 'xsd:anyType'],
      ['empty', 'group', 'xsd:anyType'],
      ['untyped', 'group', 'xsd:anyType'],
      ['anyTyped', 'group', 'xsd:anyType'],
    ]);
    expect(at(t, 'inlineSimple').facets.map((f) => f.name)).toEqual([
      'minInclusive',
      'maxInclusive',
    ]);
    expect(at(t, 'xhtmlNotMixed').wildcards).toEqual([
      { kind: 'any', namespace: 'http://www.w3.org/1999/xhtml' },
    ]);
    expect(at(t, 'wildcardOnly').wildcards).toEqual([
      { kind: 'any', namespace: '##other', processContents: 'skip', minOccurs: '0' },
      { kind: 'anyAttribute', namespace: '##any' },
    ]);
    expect(at(t, 'anyTyped').raw.nillable).toBe('true');
  });

  test('extension: base content first; facets base first; simple content attributes', () => {
    const { tree: t } = synthetic('extension.xsd');
    expect(t.root.description).toBe('The root.');
    const derived = at(t, 'derived');
    expect(derived.children.map((c) => [c.name, c.nodeType])).toEqual([
      ['a', 'element'],
      ['b', 'element'],
      ['id', 'attribute'],
      ['extra', 'attribute'],
    ]);
    expect(at(t, 'derived/extra')).toMatchObject({
      raw: { use: 'required' },
      default: 'x',
      optional: false,
    });
    const price = at(t, 'price');
    expect(price.kind).toBe('field');
    expect(price.xsdType.builtin).toBe('xsd:decimal');
    expect(price.children.map((c) => c.name)).toEqual(['currency']);
    expect(at(t, 'price/currency').facets.map((f) => [f.name, f.value])).toEqual([['length', '3']]);
    const country = at(t, 'country');
    expect(country.xsdType).toEqual({
      declared: '{urn:e}upperCode',
      builtin: 'xsd:token',
      variety: 'atomic',
    });
    expect(country.facets.map((f) => f.name)).toEqual(['length', 'pattern']);
    expect(country.fixed).toBe('VNM');
  });

  test('recursion: a repeat of an ancestor element or type is a leaf marked recursive', () => {
    const { tree: t } = synthetic('recursion.xsd');
    const inner = t.root.children.find((c) => c.name === 'folder')!;
    expect(inner).toMatchObject({ recursive: true, children: [], repeating: true });
    expect(t.root.recursive).toBe(false);
    const node = at(t, 'node');
    expect(node.recursive).toBe(false);
    expect(at(t, 'node/child')).toMatchObject({ recursive: true, children: [] });
  });

  test('an unresolved type or ref keeps the node and records UNRESOLVED_REFERENCE', () => {
    const set = syntheticSet(
      [
        {
          name: 's.xsd',
          bytes: new TextEncoder().encode(
            '<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:n="urn:none"><xsd:element name="r"><xsd:complexType><xsd:sequence><xsd:element name="a" type="n:missing"/><xsd:element ref="n:gone"/></xsd:sequence></xsd:complexType></xsd:element></xsd:schema>',
          ),
        },
      ],
      { file: 's.xsd' },
    );
    const { tree: t, issues } = tree(set.main);
    expect(t.root.children.map((c) => [c.name, c.namespace, c.kind])).toEqual([
      ['a', null, 'field'],
      ['gone', 'urn:none', 'field'],
    ]);
    expect(issues.map((i) => [i.code, i.details?.kind, i.details?.reference])).toEqual([
      ['UNRESOLVED_REFERENCE', 'type', 'n:missing'],
      ['UNRESOLVED_REFERENCE', 'element', 'n:gone'],
    ]);
  });
});
