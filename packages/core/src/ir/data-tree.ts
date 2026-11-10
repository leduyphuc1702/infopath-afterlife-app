// Stage 2: fields, groups and data paths (spec 02 R3, design §4, §7.3). Values are copied from the
// spec 01 field tree, never re-derived.

import type { FieldNode, FieldTree } from '../xsd/types';
import type { ParsedTemplate } from '../xsn/parse';
import { dataStep, loc, nodeId, type IdRegistry } from './ids';
import type { DataSource, IrField, IrGroup, IrNodeBase } from './types';
import { titleCase } from './views/labels';

/** (data source, parent id, node type, namespace, local name) → node id (design §7.3). */
export class NameIndex {
  private readonly map = new Map<string, string>();
  /** Root id of each data source. */
  readonly roots = new Map<DataSource, string>();

  private static key(
    ds: DataSource,
    parent: string | null,
    nodeType: FieldNode['nodeType'],
    ns: string | null,
    local: string,
  ): string {
    return [ds, parent ?? '', nodeType, ns ?? '', local].join('\u0000');
  }

  add(
    ds: DataSource,
    parent: string | null,
    n: Pick<FieldNode, 'nodeType' | 'namespace' | 'name'>,
    id: string,
  ): void {
    const k = NameIndex.key(ds, parent, n.nodeType, n.namespace, n.name);
    if (!this.map.has(k)) this.map.set(k, id);
    if (parent === null && !this.roots.has(ds)) this.roots.set(ds, id);
  }

  /** The child of `parent` (`null`: the document node of `ds`) with this expanded name. */
  get(
    ds: DataSource,
    parent: string | null,
    nodeType: FieldNode['nodeType'],
    ns: string | null,
    local: string,
  ): string | undefined {
    return this.map.get(NameIndex.key(ds, parent, nodeType, ns, local));
  }
}

export interface DataTree {
  readonly fields: IrField[];
  readonly groups: IrGroup[];
  readonly index: NameIndex;
  /** Parent of each node id (absent for roots), for `..`. */
  readonly parentOf: ReadonlyMap<string, string>;
  /** Each node id's spec 01 node, for the label resolver's `sharePoint` step. */
  readonly nodeOf: ReadonlyMap<string, FieldNode>;
}

export function buildDataTree(t: ParsedTemplate, ids: IdRegistry): DataTree {
  const fields: IrField[] = [];
  const groups: IrGroup[] = [];
  const index = new NameIndex();
  const parentOf = new Map<string, string>();
  const nodeOf = new Map<string, FieldNode>();
  const ns = t.manifest.namespaces;

  const trees: [DataSource, FieldTree][] = [
    ...(t.schemas.main ? [['main', t.schemas.main] as [DataSource, FieldTree]] : []),
    ...Object.keys(t.schemas.secondary)
      .sort()
      .map((k): [DataSource, FieldTree] => [k, t.schemas.secondary[k]!]),
  ];

  for (const [ds, tree] of trees) {
    const visit = (n: FieldNode, parentPath: string, parentId: string | null, groupId?: string) => {
      const path = `${parentPath}/${dataStep(n.namespace, n.name, n.nodeType, ns)}`;
      const id = ids.claim(nodeId(n.kind === 'group' ? 'g' : 'f', ds, path), n.source);
      index.add(ds, parentId, n, id);
      if (parentId !== null) parentOf.set(id, parentId);
      nodeOf.set(id, n);
      const base: IrNodeBase = {
        id,
        dataSource: ds,
        path,
        name: n.name,
        namespace: n.namespace,
        nodeType: n.nodeType,
        ...(groupId === undefined ? {} : { groupId }),
        repeating: n.repeating,
        optional: n.optional,
        ...(n.choiceGroup === undefined ? {} : { choiceGroup: n.choiceGroup }),
        label: titleCase(n.name),
        labelSource: 'name',
        labelEvidence: { step: 'name' },
        dependencies: { readBy: [], writtenBy: [] },
        source: loc(n.source),
        ...(n.use === undefined ? {} : { use: loc(n.use) }),
      };
      if (n.kind === 'group') {
        groups.push({ ...base, kind: 'group' });
      } else {
        const x = n.xsdType;
        fields.push({
          ...base,
          kind: n.kind,
          xsdType: {
            ...(x.declared === undefined ? {} : { declared: x.declared }),
            builtin: x.builtin,
            variety: x.variety,
            ...(x.itemType === undefined ? {} : { itemType: x.itemType }),
            ...(x.memberTypes === undefined ? {} : { memberTypes: [...x.memberTypes] }),
          },
          required: n.required,
          ...(n.default === undefined ? {} : { default: n.default }),
          ...(n.fixed === undefined ? {} : { fixed: n.fixed }),
        });
      }
      for (const c of n.children) visit(c, path, id, n.kind === 'group' ? id : groupId);
    };
    visit(tree.root, '', null);
  }
  return { fields, groups, index, parentOf, nodeOf };
}
