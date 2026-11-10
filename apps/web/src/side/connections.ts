// Spec 09 R6.1: the data connections panel. Each connection with its name, kind in plain words,
// query or submit, its targets as FormIR redacted them, a status, and what uses it. A pure
// function of FormIR, like the tree and the card.
import type { Endpoint, FormIR, IrConnection } from '@afterlife/core';

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

/** The kind in plain words; an adapter we have no words for keeps its name. */
export const connectionKind = (c: IrConnection) => KINDS[c.adapterKind] ?? c.adapterKind;
export const connectionName = (c: IrConnection) => c.name ?? c.dataSource ?? connectionKind(c);

export interface ConnTarget {
  /** The manifest attribute: `fileUrl`, `wsdlUrl`, `connectionString`, `to`, … */
  readonly attribute: string;
  /** As FormIR has it (connection strings redacted). */
  readonly value: string;
}

/** Something that uses the connection; selecting it selects `fieldId` in the tree. */
export interface ConnUse {
  readonly id: string;
  readonly kind: 'Field' | 'Group' | 'Control' | 'Rule action';
  readonly label: string;
  readonly fieldId?: string;
}

export interface ConnEntry {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  /** "Query", "Submit", or both. */
  readonly direction: string;
  readonly targets: readonly ConnTarget[];
  readonly status: 'Works offline' | 'Dead after migration';
  /** Why it is dead, one phrase per reason. */
  readonly reasons: readonly string[];
  readonly credentialRedacted: boolean;
  /** The fields of the tree it fills (`lineage.fieldIds`). */
  readonly fills: readonly ConnUse[];
  /** Controls that take choices from it, rule actions that use it, fields its submit reads. */
  readonly usedBy: readonly ConnUse[];
}

/** Control types in InfoPath's words. */
const CONTROL_WORDS: Readonly<Record<string, string>> = {
  dropdown: 'drop-down list box',
  listbox: 'list box',
  combobox: 'combo box',
  plaintext: 'text box',
  checkbox: 'check box',
  optionbutton: 'option button',
  dtpicker_dtext: 'date picker',
};
const controlWords = (xctname: string | undefined) =>
  xctname === undefined ? 'control' : (CONTROL_WORDS[xctname.toLowerCase()] ?? xctname);

const at = (e: Endpoint) => e.host ?? e.value;

/** Spec 02's liveness reasons in words. */
function reasonWords(e: Endpoint): string {
  switch (e.reason) {
    case 'singleLabel':
    case 'reservedSuffix':
      return `internal server ${at(e)}`;
    case 'localhost':
    case 'loopbackIp':
    case 'localServer':
      return `this computer (${at(e)})`;
    case 'privateIp':
      return `private network address ${at(e)}`;
    case 'linkLocalIp':
      return `link-local address ${at(e)}`;
    case 'filePath':
      return `file path ${e.value}`;
    case 'public':
      return `public address ${at(e)}`;
    case 'unparsed':
      return `an address we could not read (${e.value})`;
    case 'packageFile':
      return `file ${e.value} in the form`;
  }
}

function status(c: IrConnection): Pick<ConnEntry, 'status' | 'reasons'> {
  if (c.endpoints.length > 0 && c.endpoints.every((e) => e.liveness === 'package'))
    return { status: 'Works offline', reasons: [] };
  const reasons = [
    ...(c.adapterKind === 'emailAdapter' ? ['sends email from InfoPath'] : []),
    ...c.endpoints.filter((e) => e.liveness !== 'package').map(reasonWords),
  ];
  return {
    status: 'Dead after migration',
    reasons: [...new Set(reasons.length ? reasons : ['it runs inside InfoPath only'])],
  };
}

/** Endpoints as FormIR redacted them; an email submit's `to`, `cc` and `bcc` from its children. */
function targets(c: IrConnection): ConnTarget[] {
  const out: ConnTarget[] = c.endpoints.map((e) => ({ attribute: e.attribute, value: e.value }));
  for (const ch of c.children)
    if (['to', 'cc', 'bcc'].includes(ch.kind) && ch.attrs.value)
      out.push({ attribute: ch.kind, value: ch.attrs.value });
  return out;
}

export function connectionsOf(ir: FormIR): ConnEntry[] {
  const fields = new Map([...ir.fields, ...ir.groups].map((n) => [n.id, n]));
  const controls = new Map(ir.views.flatMap((v) => v.controls.map((c) => [c.id, { c, v }])));
  const actions = new Map(ir.rules.flatMap((r) => r.actions.map((a) => [a.id, { r, a }] as const)));
  /** The field an action assigns to: the one whose `writtenBy` names it as the target. */
  const assigned = new Map<string, string>();
  for (const f of ir.fields)
    for (const w of f.dependencies.writtenBy)
      if (w.role === 'assignmentTarget') assigned.set(w.elementId, f.id);

  const fieldUse = (id: string): ConnUse | undefined => {
    const n = fields.get(id);
    return n && { id, kind: n.kind === 'group' ? 'Group' : 'Field', label: n.label, fieldId: id };
  };
  const controlUse = (id: string): ConnUse | undefined => {
    const hit = controls.get(id);
    if (!hit) return undefined;
    const { c, v } = hit;
    const bound = c.targetId === undefined ? undefined : fields.get(c.targetId);
    const view = v.caption ?? v.name;
    return {
      id,
      kind: 'Control',
      label: `${bound?.label ?? c.title ?? c.binding} (${controlWords(c.xctname)}, ${view} view)`,
      ...(c.targetId !== undefined && { fieldId: c.targetId }),
    };
  };
  const actionUse = (id: string): ConnUse | undefined => {
    const hit = actions.get(id);
    if (!hit) return undefined;
    const target = assigned.get(id);
    const into = target === undefined ? undefined : fields.get(target);
    return {
      id,
      kind: 'Rule action',
      label: `${hit.r.caption ?? 'Rule'}: ${into ? `sets ${into.label}` : hit.a.kind}`,
      ...(target !== undefined && { fieldId: target }),
    };
  };

  return ir.dataConnections.map((c) => {
    const choosers = [...controls.values()]
      .filter(({ c: k }) => k.choicesFrom?.connectionId === c.id)
      .map(({ c: k }) => k.id);
    const used = [...new Set([...c.lineage.usedBy, ...choosers])];
    // A submit reads fields (an email's `to`, a submitted value): they name the connection.
    const read = ir.fields.filter((f) => f.dependencies.readBy.some((r) => r.elementId === c.id));
    return {
      id: c.id,
      name: connectionName(c),
      kind: connectionKind(c),
      direction: [c.isQuery && 'Query', c.isSubmit && 'Submit'].filter(Boolean).join(' and '),
      targets: targets(c),
      ...status(c),
      credentialRedacted: c.credentialRedacted,
      fills: c.lineage.fieldIds.flatMap((id) => fieldUse(id) ?? []),
      usedBy: [
        ...used.flatMap((id) => (id.startsWith('action:') ? actionUse(id) : controlUse(id)) ?? []),
        ...read.flatMap((f) => fieldUse(f.id) ?? []),
      ],
    };
  });
}
