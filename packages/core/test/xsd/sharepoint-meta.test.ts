import { describe, expect, test } from 'vitest';
import type { Issue } from '../../src/errors';
import { buildFieldTree } from '../../src/xsd/field-tree';
import type { FieldNode } from '../../src/xsd/types';
import { syntheticSet, xsdFiles } from '../helpers/schemas';
import { sampleSchemaSets } from '../helpers/schemas';

// R21.5 (spec 01 addendum, design §15.3): SharePoint `ma:` attributes on element declarations.

const dir = new URL('../fixtures/synthetic/real-infopath', import.meta.url).pathname;
const set = syntheticSet(
  xsdFiles(dir).filter((f) => f.name === 'sharepoint-meta.xsd'),
  { file: 'sharepoint-meta.xsd' },
);
const issues: Issue[] = [];
const tree = buildFieldTree(set.main!, issues)!;
const room = tree.root.children[0]!;
const field = (name: string): FieldNode => room.children.find((c) => c.name === name)!;

describe('sharepoint-meta.xsd', () => {
  test('all 11 listed names land on sharePoint, as written', () => {
    expect(field('Title').sharePoint).toEqual({
      displayName: 'Room name',
      readOnly: 'false',
      allowDeletion: 'true',
    });
    expect(field('Seats').sharePoint).toEqual({
      displayName: 'Seats',
      formatCategory: 'Number',
      formatSpec: '0',
    });
    expect(field('Owner').sharePoint).toEqual({
      displayName: 'Owner',
      SearchPeopleOnly: 'true',
      SharePointGroup: '0',
    });
    expect(field('Building').sharePoint).toEqual({
      displayName: 'Building',
      auxDataSourceName: 'Buildings',
      auxChoicesXPath: '/b/building',
      auxValue: 'id',
      auxDisplay: 'name',
    });
  });

  test('a ref takes sharePoint from its declaration, not from the ref site', () => {
    expect(field('Notes').sharePoint).toEqual({ displayName: 'Notes' });
  });

  test('a declaration with none has no sharePoint key', () => {
    expect(field('Floor')).not.toHaveProperty('sharePoint');
    expect(room).not.toHaveProperty('sharePoint');
  });

  test('an unlisted ma: name, another namespace and ma: on a ref are unknown, documented: false', () => {
    expect(set.issues).toEqual([]);
    expect(issues).toEqual([]);
    expect(set.unknowns.map((u) => [u.kind, u.namespace, u.name, u.documented])).toEqual([
      [
        'attribute',
        'http://schemas.microsoft.com/office/2009/metadata/properties/metaAttributes',
        'index',
        false,
      ],
      ['attribute', 'urn:example:other', 'hint', false],
      [
        'attribute',
        'http://schemas.microsoft.com/office/2009/metadata/properties/metaAttributes',
        'displayName',
        false,
      ],
    ]);
    expect(set.unknowns[2]!.raw).toBe('ma:displayName="Notes here"');
  });
});

test('no in-repo sample has sharePoint on any node (golden field trees unchanged)', async () => {
  const has = (n: FieldNode): boolean => 'sharePoint' in n || n.children.some(has);
  for (const [slug, s] of await sampleSchemaSets()) {
    const t = buildFieldTree(s.main!, [])!;
    expect(has(t.root), slug).toBe(false);
  }
});
