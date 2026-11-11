// Spec 04 D10: which FormIR field or group a DOM node is. Keys use expanded names, so a record
// that binds `my` to the same URI under another prefix still maps.

import type { FieldNode, FieldTree } from '../xsd/types';
import type { FormIR, IrField, IrGroup } from '../ir/types';
import type { RtNode } from './evaluate';

const step = (ns: string | null, local: string, attribute: boolean) =>
  `${attribute ? '@' : ''}{${ns ?? ''}}${local}`;

export interface FieldIndex {
  /** Field or group id of a node of `dataSource`'s document, or undefined. */
  idOf(node: RtNode): string | undefined;
  /** Nodes of each field and group, in document order. */
  nodes(root: RtNode): Map<string, RtNode[]>;
  field(id: string): IrField | undefined;
  group(id: string): IrGroup | undefined;
  /** The schema node of a field, for facets and nillable (R5.1). */
  schema(id: string): FieldNode | undefined;
}

export function fieldIndex(ir: FormIR, dataSource: string, tree?: FieldTree): FieldIndex {
  const nodes = [...ir.groups, ...ir.fields].filter((n) => n.dataSource === dataSource);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const keyOf = new Map<string, string>();
  const key = (id: string): string => {
    const hit = keyOf.get(id);
    if (hit !== undefined) return hit;
    const n = byId.get(id)!;
    const k = `${n.groupId && byId.has(n.groupId) ? key(n.groupId) : ''}/${step(n.namespace, n.name, n.nodeType === 'attribute')}`;
    keyOf.set(id, k);
    return k;
  };
  const idByKey = new Map(nodes.map((n) => [key(n.id), n.id]));
  const schemaByKey = new Map<string, FieldNode>();
  const walk = (f: FieldNode, base: string) => {
    const k = `${base}/${step(f.namespace, f.name, f.nodeType === 'attribute')}`;
    if (!schemaByKey.has(k)) schemaByKey.set(k, f);
    for (const c of (f as { children?: readonly FieldNode[] }).children ?? []) walk(c, k);
  };
  if (tree) walk(tree.root, '');

  const nodeKey = (n: RtNode): string | undefined => {
    const steps: string[] = [];
    let cur: RtNode | null | undefined = n;
    if (cur.nodeType === 2) {
      steps.push(step(cur.namespaceURI ?? null, local(cur), true));
      cur = cur.ownerElement;
    }
    for (; cur && cur.nodeType === 1; cur = cur.parentNode)
      steps.push(step(cur.namespaceURI ?? null, local(cur), false));
    return cur && cur.nodeType === 9 ? `/${steps.reverse().join('/')}` : undefined;
  };

  return {
    idOf: (n) => {
      const k = nodeKey(n);
      return k === undefined ? undefined : idByKey.get(k);
    },
    nodes: (root) => {
      const out = new Map<string, RtNode[]>();
      const visit = (el: RtNode, base: string) => {
        const k = `${base}/${step(el.namespaceURI ?? null, local(el), false)}`;
        const id = idByKey.get(k);
        if (id === undefined) return;
        push(out, id, el);
        for (const a of Array.from(el.attributes ?? [])) {
          const aid = idByKey.get(`${k}/${step(a.namespaceURI ?? null, local(a), true)}`);
          if (aid !== undefined) push(out, aid, a);
        }
        for (let c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 1) visit(c, k);
      };
      const top = root.nodeType === 9 ? root.documentElement : root;
      if (top) visit(top, '');
      return out;
    },
    field: (id) => {
      const n = byId.get(id);
      return n && n.kind !== 'group' ? n : undefined;
    },
    group: (id) => {
      const n = byId.get(id);
      return n && n.kind === 'group' ? n : undefined;
    },
    schema: (id) => (byId.has(id) ? schemaByKey.get(key(id)) : undefined),
  };
}

function push(m: Map<string, RtNode[]>, k: string, n: RtNode) {
  const list = m.get(k);
  if (list) list.push(n);
  else m.set(k, [n]);
}

export const local = (n: RtNode): string => n.localName ?? n.nodeName.replace(/^.*:/, '');
