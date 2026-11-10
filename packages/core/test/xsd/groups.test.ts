import { describe, expect, test } from 'vitest';
import type { Issue } from '../../src/errors';
import { buildFieldTree } from '../../src/xsd/field-tree';
import type { FieldNode, FieldTree } from '../../src/xsd/types';
import { syntheticSet, syntheticXsd, xsdFiles } from '../helpers/schemas';

// R14.3 (group multiplication), R14.7 (list and union facets), R15.1 (groups, attribute groups,
// lists, unions), R15.3 (group recursion), R15.4, R15.5.

function load(file: string): FieldTree {
  const set = syntheticSet(
    xsdFiles(syntheticXsd()).filter((f) => f.name === file),
    { file },
  );
  expect(set.unknowns).toEqual([]);
  expect(set.issues).toEqual([]);
  const issues: Issue[] = [];
  const t = buildFieldTree(set.main!, issues)!;
  expect(issues).toEqual([]);
  return t;
}
const child = (n: FieldNode, name: string) => n.children.find((c) => c.name === name)!;

describe('model groups (group.xsd)', () => {
  const t = load('group.xsd');

  test('a group ref is expanded in place, in content order', () => {
    expect(t.root.children.map((c) => c.name)).toEqual([
      'street',
      'city',
      'phone',
      'email',
      'none',
      'process',
    ]);
  });

  test('cardinality multiplies through the ref; the ref is in raw.groups', () => {
    const street = child(t.root, 'street');
    expect(street).toMatchObject({ repeating: true, optional: true });
    expect(street.effective).toEqual({ minOccurs: 0, maxOccurs: 'unbounded', nillable: false });
    expect(street.raw).toEqual({
      groups: [
        { kind: 'sequence' },
        { kind: 'group', ref: '{urn:g}address', minOccurs: '0', maxOccurs: 'unbounded' },
        { kind: 'sequence' },
      ],
    });
    expect(child(t.root, 'city').raw.minOccurs).toBe('0');
  });

  test('a group inside a choice: its members share their own choice; none is in the outer one', () => {
    const phone = child(t.root, 'phone');
    const email = child(t.root, 'email');
    const none = child(t.root, 'none');
    expect(phone.choiceGroup).toBe(email.choiceGroup);
    expect(none.choiceGroup).toBeDefined();
    expect(none.choiceGroup).not.toBe(phone.choiceGroup);
    expect(phone.raw.groups.map((g) => g.kind)).toEqual(['sequence', 'choice', 'group', 'choice']);
    expect(phone.optional).toBe(false);
  });

  test('a self-referencing group is cut: its element is marked recursive', () => {
    const process = child(t.root, 'process');
    expect(process.recursive).toBe(true);
    expect(process.children.map((c) => c.name)).toEqual(['step']);
  });
});

test('attribute groups (attribute-group.xsd): nested, in document order, with anyAttribute', () => {
  const t = load('attribute-group.xsd');
  expect(t.root.children.map((c) => [c.name, c.nodeType, c.optional, c.xsdType.builtin])).toEqual([
    ['id', 'attribute', true, 'xsd:int'],
    ['createdBy', 'attribute', true, 'xsd:string'],
    ['createdOn', 'attribute', false, 'xsd:dateTime'],
    ['note', 'attribute', true, 'xsd:string'],
  ]);
  expect(child(t.root, 'createdOn').raw).toEqual({ use: 'required', groups: [] });
  expect(t.root.wildcards).toEqual([
    { kind: 'anyAttribute', namespace: '##other', processContents: 'lax' },
  ]);
});

test('lists (list.xsd): by itemType and inline, with a length facet', () => {
  const t = load('list.xsd');
  expect(child(t.root, 'tags')).toMatchObject({
    kind: 'field',
    xsdType: {
      declared: '{urn:l}codes',
      builtin: 'xsd:anySimpleType',
      variety: 'list',
      itemType: 'xsd:token',
    },
    facets: [],
  });
  const triple = child(t.root, 'triple');
  expect(triple.xsdType).toMatchObject({ variety: 'list', itemType: 'xsd:token' });
  expect(triple.facets.map((f) => [f.name, f.value])).toEqual([['length', '3']]);
  expect(child(t.root, 'scores').xsdType).toEqual({
    builtin: 'xsd:anySimpleType',
    variety: 'list',
    itemType: 'xsd:int',
  });
});

test('unions (union.xsd): memberTypes and inline members; a restriction keeps its facets', () => {
  const t = load('union.xsd');
  expect(child(t.root, 'due').xsdType).toEqual({
    declared: '{urn:u}dateOrBlank',
    builtin: 'xsd:anySimpleType',
    variety: 'union',
    memberTypes: ['xsd:date', '{urn:u}blank'],
  });
  expect(child(t.root, 'size').xsdType.memberTypes).toEqual(['xsd:int', 'xsd:token']);
  const limited = child(t.root, 'limited');
  expect(limited.kind).toBe('field');
  expect(limited.xsdType.variety).toBe('union');
  expect(limited.facets.map((f) => f.name)).toEqual(['pattern']);
});
