// Spec 15 R1, D1: the form dossier, the manual nobody wrote, as plain data. Markdown and the
// web screen both draw this; the same FormIR always gives the same dossier.
import type { Issue } from '../errors';
import type { FormIR, IrConnection, IrField } from '../ir/types';
import { isBlankCheck } from '../coverage/classify';
import { causesOf } from '../triage/causes';
import {
  buttonName,
  calcSentence,
  elementName,
  list,
  nodeName,
  ruleSentence,
  validationSentence,
  type Sentence,
} from './words';

export interface DossierItem extends Sentence {
  /** The FormIR element this item is (P19); absent for summary lines. */
  readonly id?: string;
}

export interface DossierField {
  readonly label: string;
  readonly path: string;
  readonly type: string;
  readonly required: boolean;
  readonly default: string;
  readonly views: readonly string[];
}

export interface Dossier {
  readonly name: string;
  readonly fileName: string;
  readonly about: readonly { readonly label: string; readonly value: string }[];
  readonly fields: readonly DossierField[];
  readonly logic: {
    readonly onOpen: readonly DossierItem[];
    readonly rules: readonly DossierItem[];
    readonly calculations: readonly DossierItem[];
    readonly validations: readonly DossierItem[];
    readonly buttons: readonly DossierItem[];
  };
  readonly connections: readonly DossierItem[];
  readonly depends: readonly DossierItem[];
  readonly unread: readonly DossierItem[];
}

export interface DossierOptions {
  readonly fileName: string;
  /** Records loaded for this template. */
  readonly records?: number;
  /** Spec 16 K2: button captions by control id (`buttonCaptions`). */
  readonly buttons?: ReadonlyMap<string, string>;
}

const TYPE_WORDS: Readonly<Record<string, string>> = {
  string: 'Text',
  boolean: 'Yes/No',
  date: 'Date',
  dateTime: 'Date and time',
  time: 'Time',
  decimal: 'Decimal',
  double: 'Decimal',
  float: 'Decimal',
  integer: 'Whole number',
  int: 'Whole number',
  long: 'Whole number',
  anyURI: 'Link',
  base64Binary: 'Picture or file attachment',
};

const typeOf = (f: IrField) =>
  f.kind === 'richText'
    ? 'Rich text'
    : (TYPE_WORDS[f.xsdType.builtin.replace(/^.*:/, '')] ?? f.xsdType.builtin);

const ADAPTERS: Readonly<Record<string, string>> = {
  adoAdapter: 'a database query',
  webServiceAdapter: 'a web service',
  sharepointListAdapter: 'a SharePoint list',
  sharepointListAdapterRW: 'a SharePoint list',
  xmlFileAdapter: 'an XML file',
  davAdapter: 'a document library',
  emailAdapter: 'an e-mail',
  hwsAdapter: 'a workflow service',
  submitToHostAdapter: 'the hosting page',
};

/**
 * R1.4, spec 16 K9, K10: whether the connection can still work, said for its kind, from spec
 * 12's causes and the endpoints' liveness. "Not known" only when nothing can be said.
 */
function status(c: IrConnection, causes: ReturnType<typeof causesOf>): string {
  const at = (src: { file: string; path: string }) =>
    causes.some((k) =>
      k.evidence.some((e) => e.located.file === src.file && e.located.path === src.path),
    );
  const submitOnly = c.isSubmit && !c.isQuery;
  const jsm = submitOnly
    ? ' In Jira Service Management the request itself is the submit, so this connection is not needed there.'
    : '';
  if (c.adapterKind === 'adoAdapter')
    return `Cannot work: it needs a database on the old network${at(c.source) ? '' : ' that the viewer cannot reach'}. To keep this data, someone has to set up a new source by hand, such as a web service the form can reach or a Jira Assets list.`;
  const internal = c.endpoints.find((e) => e.liveness === 'internal' && at(e.source));
  if (internal)
    return `Cannot work outside the old network: it calls internal host ${internal.host ?? internal.value}.${
      jsm ||
      ' To keep it, someone has to point it at a service that can be reached, or replace it with a Jira field, by hand.'
    }`;
  if (c.endpoints.length > 0 && c.endpoints.every((e) => e.liveness === 'package'))
    return 'Still works: it reads a file inside the template.';
  const pub = c.endpoints.find((e) => e.reason === 'public');
  if (pub)
    return `May still work: it calls ${pub.host ?? pub.value}, a public address. The viewer does not call it.`;
  switch (c.adapterKind) {
    case 'emailAdapter':
      return `Cannot work as it is: InfoPath sent this e-mail itself, and nothing sends it now.${jsm || ''}${submitOnly ? '' : ' A Jira notification or automation rule can send the e-mail instead.'}`;
    case 'submitToHostAdapter':
      return `Cannot work as it is: it hands the form to the web page that hosted it, and only InfoPath Forms Services did that.${jsm}`;
    case 'hwsAdapter':
      return 'Cannot work: it starts a SharePoint 2013 workflow, and those were retired on 2026-04-02.';
    case 'davAdapter':
    case 'sharepointListAdapter':
    case 'sharepointListAdapterRW':
    case 'sharepointFormLibraryAdapter':
      return `Works only where its SharePoint site still runs: the template gives no full address, so it points at the site the form was published to.${jsm}`;
    case 'xmlFileAdapter':
      return 'Works only where its file still is: the template names no address for it.';
  }
  return 'Not known: no address could be read from it.';
}

function connectionItem(
  ir: FormIR,
  c: IrConnection,
  causes: ReturnType<typeof causesOf>,
): DossierItem {
  const name = c.name ?? c.dataSource ?? c.adapterKind;
  const host = c.endpoints.find((e) => e.host)?.host;
  const what = ADAPTERS[c.adapterKind] ?? `a connection of kind ${c.adapterKind}`;
  const mode =
    c.isQuery && c.isSubmit
      ? 'reads and submits data'
      : c.isSubmit
        ? 'submits the form'
        : 'reads data';
  // Spec 02 lineage: the controls (choice lists) and rules that use what it returns.
  const feeds = c.lineage.usedBy.map((id) => elementName(ir, id));
  const fed = [...new Set(feeds)];
  return {
    id: c.id,
    sentence: `Data connection “${name}” is ${what}${host ? ` on ${host}` : ''}; it ${mode}. ${
      fed.length
        ? `It feeds ${list(fed)}.`
        : c.isSubmit && !c.isQuery
          ? ''
          : 'Nothing in the form uses what it returns.'
    } ${status(c, causes)}`,
    expressions: [],
  };
}

/** Roles that make a field feed an element (R1.5); bindings and targets are not "feeding". */
const FEEDS = [
  'condition',
  'actionExpression',
  'dialogText',
  'calcExpression',
  'validationExpression',
  'choicesFilter',
  'submitValue',
  'trigger',
];

const ISSUE_WORDS: Partial<Record<Issue['code'], string>> = {
  CHECKSUM_MISMATCH:
    'The template package is damaged: a file inside it does not match its checksum',
  MISSING_FILE: 'The template names a file that is not in the package',
  UNLISTED_FILE: 'The package holds a file the template does not name',
  DUPLICATE_NAME: 'The package holds two files with the same name',
  UNSAFE_NAME: 'The package holds a file whose name could point outside it, so it was not read',
  URN_MISMATCH: 'The template’s identity differs between two of its files',
  UNSAFE_XML: 'A file holds XML the viewer does not read, for safety',
  INVALID_XML: 'A file is not well-formed XML',
  LIMIT_EXCEEDED: 'A file is larger or deeper than the viewer reads',
  INVALID_ENCODING: 'A file’s text encoding could not be read',
  XML_WARNING: 'A file has an XML problem the viewer read past',
  PATTERN_NOT_EVALUATED: 'A pattern check in the schema could not be run by the viewer',
  REPEATED_ELEMENT: 'An element appears more than once where the template expects one',
  DUPLICATE_GLOBAL: 'The schema defines the same name twice',
  UNRESOLVED_BINDING: 'A control on a view is bound to a field the schema does not have',
  DUPLICATE_ID:
    'Two parts of the template have the same name, so the second is listed under another name',
};

function issueItem(i: Issue): DossierItem {
  const where = [i.file, i.line !== undefined && `line ${i.line}`].filter(Boolean).join(', ');
  const words = ISSUE_WORDS[i.code] ?? 'Part of the template could not be read';
  const paths = [
    i.path,
    ...['id', 'path', 'binding', 'text']
      .map((k) => i.details?.[k])
      .filter((v) => typeof v === 'string'),
  ].filter((v): v is string => v !== undefined && v !== '');
  return { sentence: `${words}${where ? ` (${where})` : ''}.`, expressions: [...new Set(paths)] };
}

export function buildDossier(ir: FormIR, options: DossierOptions): Dossier {
  const views = ir.views.map((v) => v.caption ?? v.name);
  const main = ir.fields.filter((f) => f.dataSource === 'main');
  const fields: DossierField[] = main.map((f) => ({
    label: f.label,
    path: f.path,
    type: typeOf(f),
    // Spec 16 K3: what a person filling in the form meets: a blank check on the field, or a
    // required schema type that can be empty (a Yes/No box is never blank).
    required:
      (f.required && !/(^|:)boolean$/.test(f.xsdType.builtin)) ||
      ir.validations.some((v) => v.matchId === f.id && (v.kind === 'blank' || isBlankCheck(v))),
    default: f.default ?? '',
    views: ir.views
      .filter((v) => v.controls.some((k) => k.targetId === f.id))
      .map((v) => v.caption ?? v.name),
  }));
  const rules = ir.rules.map((r) => ({ id: r.id, ...ruleSentence(ir, r, options.buttons) }));
  const calculations = ir.calculations.map((c) => ({ id: c.id, ...calcSentence(ir, c) }));
  const validations = ir.validations.map((v) => ({ id: v.id, ...validationSentence(ir, v) }));

  const buttons = new Map<string, string[]>();
  for (const r of ir.rules)
    for (const t of r.triggers)
      if (t.kind === 'button') {
        const k = buttonName(t.button, t.view, options.buttons);
        buttons.set(k, [...(buttons.get(k) ?? []), `“${r.caption ?? 'without a name'}”`]);
      }
  const onLoad = ir.rules.filter((r) => r.triggers.some((t) => t.kind === 'onLoad'));
  const onOpen: DossierItem[] = [
    {
      sentence: onLoad.length
        ? `The rule${onLoad.length > 1 ? 's' : ''} ${list(onLoad.map((r) => `“${r.caption ?? 'without a name'}”`))} run${onLoad.length > 1 ? '' : 's'} when the form opens.`
        : 'No rule runs when the form opens.',
      expressions: [],
    },
    ...(ir.calculations.length
      ? [
          {
            sentence: `${ir.calculations.length} calculated field${ir.calculations.length > 1 ? 's are' : ' is'} worked out from ${ir.calculations.length > 1 ? 'their' : 'its'} inputs.`,
            expressions: [],
          },
        ]
      : []),
  ];

  const causes = causesOf(ir);
  const connections = ir.dataConnections.map((c) => connectionItem(ir, c, causes));

  const depends: DossierItem[] = [];
  for (const n of [...ir.fields, ...ir.groups]) {
    const by = [
      ...new Set(
        n.dependencies.readBy
          .filter((d) => FEEDS.includes(d.role))
          .map((d) => elementName(ir, d.elementId)),
      ),
    ];
    if (by.length)
      depends.push({ sentence: `${nodeName(ir, n.id)} feeds ${list(by)}.`, expressions: [] });
  }

  const unread: DossierItem[] = [
    ...ir.unknowns.map((u) => ({
      sentence: `${u.kind === 'attribute' ? 'Attribute' : u.kind === 'text' ? 'Text' : 'Element'} “${u.name}” in ${u.file}, line ${u.line}, is not understood by the viewer.`,
      expressions: [],
    })),
    // Spec 19 P4: in words, with paths under the sentence. UNRESOLVED_REFERENCE is said below,
    // once per element, from `unresolvedRefs`.
    ...ir.issues.filter((i) => i.code !== 'UNRESOLVED_REFERENCE').map(issueItem),
    ...[...ir.rules, ...ir.calculations, ...ir.validations].flatMap((e) =>
      e.unresolvedRefs.map((u) => ({
        sentence: `Part of an expression in ${elementName(ir, e.id)} could not be followed to a field (${u.reason}).`,
        expressions: [u.text],
      })),
    ),
  ];

  const m = ir.meta;
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const about = [
    { label: 'Name', value: m.name },
    { label: 'File', value: options.fileName },
    { label: 'Version', value: m.solutionVersion ?? 'not stated' },
    {
      label: 'Made with',
      value:
        m.generation === 'unknown' ? 'an unknown InfoPath version' : `InfoPath ${m.generation}`,
    },
    { label: 'Views', value: `${views.length}: ${views.join(', ')}` },
    {
      label: 'Counts',
      value: [
        count(main.length, 'field', 'fields'),
        count(ir.rules.length, 'rule', 'rules'),
        count(ir.calculations.length, 'calculation', 'calculations'),
        count(ir.validations.length, 'validation', 'validations'),
        count(ir.dataConnections.length, 'data connection', 'data connections'),
      ].join(', '),
    },
    { label: 'Records loaded', value: String(options.records ?? 0) },
  ];

  return {
    name: m.name,
    fileName: options.fileName,
    about,
    fields,
    logic: {
      onOpen,
      rules,
      calculations,
      validations,
      buttons: [...buttons].map(([b, rs]) => ({
        sentence: `${b[0]!.toUpperCase()}${b.slice(1)} runs ${rs.length > 1 ? 'the rules' : 'the rule'} ${list(rs)}.`,
        expressions: [],
      })),
    },
    connections,
    depends,
    unread,
  };
}
