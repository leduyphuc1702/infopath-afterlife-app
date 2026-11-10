// Spec 09 R4.1: the field tree, from FormIR. Roots by data source (main first), children by
// `groupId`. FormIR keeps fields and groups in two arrays, each in tree order; siblings are put
// back in document order by the position of each group's first field.
import type { FormIR, IrField, IrGroup } from '@afterlife/core';

export interface TreeNode {
  readonly id: string;
  readonly node: IrField | IrGroup;
  readonly children: readonly TreeNode[];
}

export interface TreeRoot {
  readonly dataSource: string;
  readonly children: readonly TreeNode[];
}

const XSD_WORDS: Readonly<Record<string, string>> = {
  string: 'Text',
  normalizedString: 'Text',
  token: 'Text',
  boolean: 'True/false',
  date: 'Date',
  dateTime: 'Date and time',
  time: 'Time',
  decimal: 'Decimal',
  double: 'Decimal',
  float: 'Decimal',
  integer: 'Whole number',
  int: 'Whole number',
  long: 'Whole number',
  short: 'Whole number',
  nonNegativeInteger: 'Whole number',
  positiveInteger: 'Whole number',
  base64Binary: 'Picture or file attachment',
  anyURI: 'Hyperlink',
};

/** The type in InfoPath's words: "Text", "Date", "Repeating group", … */
export function typeWords(n: IrField | IrGroup): string {
  if (n.kind === 'group') return n.repeating ? 'Repeating group' : 'Group';
  if (n.kind === 'richText') return 'Rich text';
  const builtin = n.xsdType.builtin.replace(/^[^:]*:/, '');
  return XSD_WORDS[builtin] ?? builtin;
}

export function buildTree(ir: FormIR): TreeRoot[] {
  const fieldIndex = new Map(ir.fields.map((f, i) => [f.id, i]));
  const kids = new Map<string | undefined, (IrField | IrGroup)[]>();
  const push = (n: IrField | IrGroup) => {
    const key = n.groupId ?? `root:${n.dataSource}`;
    kids.set(key, [...(kids.get(key) ?? []), n]);
  };
  ir.groups.forEach(push);
  ir.fields.forEach(push);

  const firstField = new Map<string, number>();
  const keyOf = (n: IrField | IrGroup): number => {
    if (n.kind !== 'group') return fieldIndex.get(n.id)!;
    let k = firstField.get(n.id);
    if (k === undefined) {
      k = Math.min(Infinity, ...(kids.get(n.id) ?? []).map(keyOf));
      firstField.set(n.id, k);
    }
    return k;
  };
  const groupIndex = new Map(ir.groups.map((g, i) => [g.id, i]));
  const order = (a: IrField | IrGroup, b: IrField | IrGroup) =>
    keyOf(a) - keyOf(b) || (groupIndex.get(a.id) ?? 0) - (groupIndex.get(b.id) ?? 0) || 0;
  const build = (n: IrField | IrGroup): TreeNode => ({
    id: n.id,
    node: n,
    children: [...(kids.get(n.id) ?? [])].sort(order).map(build),
  });

  const sources = [...new Set([...ir.groups, ...ir.fields].map((n) => n.dataSource))].sort(
    (a, b) => (a === 'main' ? -1 : b === 'main' ? 1 : a < b ? -1 : a > b ? 1 : 0),
  );
  return sources.map((dataSource) => ({
    dataSource,
    children: [...(kids.get(`root:${dataSource}`) ?? [])].sort(order).map(build),
  }));
}

/** Every node, depth first. */
export function* walk(nodes: readonly TreeNode[]): Generator<TreeNode> {
  for (const n of nodes) {
    yield n;
    yield* walk(n.children);
  }
}
