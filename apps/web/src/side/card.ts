// Spec 09 R5.1: the details card for a field or a control: path, type, required flag, every
// rule, calculation and validation that touches it (expressions as written), the data
// connections it uses, and how many controls show it.
import type { DepRole, FormIR, IrConnection } from '@afterlife/core';
import { typeWords } from './tree';

export interface CardRef {
  readonly id: string;
  readonly kind: 'Rule' | 'Rule action' | 'Calculation' | 'Validation' | 'Submit';
  readonly title: string;
  readonly expression?: string;
  readonly note?: string;
  readonly roles: readonly DepRole[];
}

export interface Card {
  readonly fieldId?: string;
  readonly label: string;
  readonly path: string;
  readonly type: string;
  readonly required: boolean;
  readonly repeating: boolean;
  readonly refs: readonly CardRef[];
  readonly connections: readonly {
    readonly id: string;
    readonly name: string;
    readonly kind: string;
  }[];
  readonly controls: number;
}

const KINDS: Readonly<Record<string, string>> = {
  adoAdapter: 'Database (SQL)',
  webServiceAdapter: 'Web service',
  xmlFileAdapter: 'XML file',
  sharepointListAdapter: 'SharePoint list',
  sharepointListAdapterRW: 'SharePoint list',
  sharePointListAdapter: 'SharePoint list',
  emailAdapter: 'Email submit',
  davAdapter: 'SharePoint library submit',
  hwsAdapter: 'Web service (HTTP)',
};
export const connectionKind = (c: IrConnection) => KINDS[c.adapterKind] ?? c.adapterKind;
export const connectionName = (c: IrConnection) => c.name ?? c.dataSource ?? connectionKind(c);

const ACTIONS: Readonly<Record<string, string>> = {
  assignmentAction: 'set a field',
  queryAction: 'query data',
  submitAction: 'submit',
  dialogMessageAction: 'show a message',
  switchViewAction: 'switch views',
  closeDocumentAction: 'close the form',
};

const attrsText = (a: Readonly<Record<string, string>>) =>
  Object.entries(a)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');

function describe(ir: FormIR, id: string): Omit<CardRef, 'roles'> | undefined {
  if (id.startsWith('rule:')) {
    const r = ir.rules.find((x) => x.id === id);
    if (!r) return undefined;
    return {
      id,
      kind: 'Rule',
      title: r.caption ?? 'Rule',
      ...(r.condition !== undefined && { expression: r.condition }),
      ...(!r.enabled && { note: 'Turned off' }),
    };
  }
  if (id.startsWith('action:')) {
    for (const r of ir.rules) {
      const a = r.actions.find((x) => x.id === id);
      if (!a) continue;
      const expression =
        a.kind === 'assignmentAction' && a.attrs.targetField !== undefined
          ? `${a.attrs.targetField} = ${a.attrs.expression ?? ''}`
          : (a.attrs.expression ?? (attrsText(a.attrs) || undefined));
      return {
        id,
        kind: 'Rule action',
        title: `${r.caption ?? 'Rule'}: ${ACTIONS[a.kind] ?? a.kind}`,
        ...(expression !== undefined && { expression }),
        ...(r.condition !== undefined && { note: `When ${r.condition}` }),
      };
    }
    return undefined;
  }
  if (id.startsWith('calc:')) {
    const c = ir.calculations.find((x) => x.id === id);
    return (
      c && { id, kind: 'Calculation', title: `Calculates ${c.target}`, expression: c.expression }
    );
  }
  if (id.startsWith('val:')) {
    const v = ir.validations.find((x) => x.id === id);
    if (!v) return undefined;
    return {
      id,
      kind: 'Validation',
      title: v.message?.shortMessage ?? (v.kind === 'blank' ? 'Cannot be blank' : 'Validation'),
      ...(v.expression !== undefined && { expression: v.expression }),
      ...(v.message?.text !== undefined && { note: v.message.text }),
    };
  }
  if (id.startsWith('conn:')) {
    const c = ir.dataConnections.find((x) => x.id === id);
    return c && { id, kind: 'Submit', title: `Sent by ${connectionName(c)}` };
  }
  return undefined;
}

const controlsById = (ir: FormIR) =>
  new Map(ir.views.flatMap((v) => v.controls.map((c) => [c.id, c])));

export function cardFor(ir: FormIR, fieldId: string): Card | undefined {
  const node = ir.fields.find((f) => f.id === fieldId) ?? ir.groups.find((g) => g.id === fieldId);
  if (!node) return undefined;
  const refs = new Map<string, { d: Omit<CardRef, 'roles'>; roles: DepRole[] }>();
  const elementIds = new Set<string>();
  for (const r of [...node.dependencies.readBy, ...node.dependencies.writtenBy]) {
    elementIds.add(r.elementId);
    const seen = refs.get(r.elementId);
    if (seen) {
      if (!seen.roles.includes(r.role)) seen.roles.push(r.role);
      continue;
    }
    const d = describe(ir, r.elementId);
    if (d) refs.set(r.elementId, { d, roles: [r.role] });
  }
  const controls = [...controlsById(ir).values()].filter((c) => c.targetId === fieldId);
  for (const c of controls) elementIds.add(c.id);
  const connections = ir.dataConnections
    .filter(
      (c) =>
        c.lineage.fieldIds.includes(fieldId) ||
        c.lineage.usedBy.some((u) => elementIds.has(u)) ||
        controls.some((k) => k.choicesFrom?.connectionId === c.id),
    )
    .map((c) => ({ id: c.id, name: connectionName(c), kind: connectionKind(c) }));
  return {
    fieldId,
    label: node.label,
    path: node.path,
    type: typeWords(node),
    required: node.kind !== 'group' && node.required,
    repeating: node.repeating,
    refs: [...refs.values()].map(({ d, roles }) => ({ ...d, roles })),
    connections,
    controls: controls.length,
  };
}

/** A control bound to no single field (an expression box): its binding is shown as written. */
export function cardForControl(ir: FormIR, controlId: string): Card | undefined {
  const c = controlsById(ir).get(controlId);
  if (!c) return undefined;
  if (c.targetId) return cardFor(ir, c.targetId);
  return {
    label: c.title ?? (c.readOnly ? 'Expression box' : 'Control'),
    path: c.binding,
    type: c.readOnly ? 'Expression box (shows a calculated value)' : (c.xctname ?? 'Control'),
    required: false,
    repeating: c.inRepeat,
    refs: [],
    connections: [],
    controls: 1,
  };
}
