// FormIR values built directly from arbitraries, one per part (spec 02 design §10, P6). Every
// element list has 0–5 entries, every optional property is present or absent (never undefined),
// every enum member occurs, and strings include quotes, backslashes, newlines, non-BMP characters
// and keys such as `__proto__`.

import fc from 'fast-check';
import { ISSUE_CODES } from '../../src/errors';
import type { FormIR } from '../../src/index';
import {
  DEP_ROLES,
  LABEL_SOURCES,
  LIVENESS_REASONS,
  UNRESOLVED_REASONS,
  VIEW_LABEL_STEPS,
} from '../../src/ir/types';

type Arbs = Record<string, fc.Arbitrary<unknown>>;

/** Required keys always present; optional keys present or absent. */
const rec = (req: Arbs, opt: Arbs = {}): fc.Arbitrary<Record<string, unknown>> =>
  fc.record({ ...req, ...opt }, { requiredKeys: Object.keys(req) });
const list = <T>(a: fc.Arbitrary<T>) => fc.array(a, { maxLength: 5 });
const en = <T>(vs: readonly T[]) => fc.constantFrom(...vs);

const TRICKY = ['', '"', "'", '\\', '\n', '\r\n', '\t', '\u2028', '😀', '__proto__', 'constructor'];
export const str = fc.oneof(
  fc.string({ unit: 'binary', maxLength: 12 }),
  fc.constantFrom(...TRICKY),
  fc.string({ unit: fc.constantFrom('"', '\\', '\n', 'a', '😀', '{', ':'), maxLength: 8 }),
);
/** Integers, never -0 (the serialiser refuses it). */
const int = fc.integer().map((n) => (n === 0 ? 0 : n));
const num = fc.oneof(
  int,
  fc.double({ noNaN: true, noDefaultInfinity: true }).map((n) => (n === 0 ? 0 : n)),
);
const bool = fc.boolean();
const key = fc.oneof(
  str,
  fc.constantFrom('__proto__', 'constructor', 'toString', 'hasOwnProperty'),
);
/** Own keys only, `__proto__` included (Object.fromEntries defines it as data). */
const attrs = list(fc.tuple(key, str)).map((e) => Object.fromEntries(e) as Record<string, string>);
const strs = list(str);

const located = rec({ file: str, path: str, line: int, column: int });
const depRef = rec({ elementId: str, role: en(DEP_ROLES) });
const unresolved = list(rec({ role: en(DEP_ROLES), text: str, reason: en(UNRESOLVED_REASONS) }));
const endpoint = rec(
  {
    attribute: str,
    value: str,
    liveness: en(['internal', 'package', 'unknown'] as const),
    reason: en(LIVENESS_REASONS),
    source: located,
  },
  { host: str },
);
const nodeReq: Arbs = {
  id: str,
  dataSource: str,
  path: str,
  name: str,
  namespace: fc.option(str, { nil: null }),
  nodeType: en(['element', 'attribute'] as const),
  repeating: bool,
  optional: bool,
  label: str,
  labelSource: en(LABEL_SOURCES),
  labelEvidence: rec(
    { step: en(LABEL_SOURCES) },
    { viewStep: en(VIEW_LABEL_STEPS), view: str, at: located },
  ),
  dependencies: rec({ readBy: list(depRef), writtenBy: list(depRef) }),
  source: located,
};
const nodeOpt: Arbs = { groupId: str, choiceGroup: str, use: located };
const field = rec(
  {
    ...nodeReq,
    kind: en(['field', 'richText'] as const),
    xsdType: rec(
      { builtin: str, variety: en(['atomic', 'list', 'union', 'complex'] as const) },
      { declared: str, itemType: str, memberTypes: strs },
    ),
    required: bool,
  },
  { ...nodeOpt, default: str, fixed: str },
);
const group = rec({ ...nodeReq, kind: fc.constant('group') }, nodeOpt);
const control = rec(
  { id: str, binding: str, readOnly: bool, inRepeat: bool, source: located },
  {
    xctname: str,
    ctrlId: str,
    targetId: str,
    title: str,
    dynamicAttrs: strs,
    choice: rec({ label: str }, { value: str }),
    choicesFrom: rec({ dataSource: str, select: str, filterIds: strs }, { connectionId: str }),
  },
);
const view = rec(
  {
    id: str,
    name: str,
    isDefault: bool,
    isPrint: bool,
    scanned: bool,
    controls: list(control),
    source: located,
  },
  { caption: str, xslFile: str, printView: str },
);
const trigger = fc.oneof(
  rec({ kind: fc.constant('fieldChange'), match: str, source: located }, { targetId: str }),
  rec({ kind: fc.constant('onLoad'), source: located }),
  rec({ kind: fc.constant('submit'), source: located }),
  rec({ kind: fc.constant('button'), source: located }, { view: str, button: str }),
);
const rule = rec(
  {
    id: str,
    ruleSet: str,
    enabled: bool,
    stopProcessing: bool,
    actions: list(rec({ id: str, kind: str, attrs, source: located }, { text: str })),
    triggers: list(trigger),
    unresolvedRefs: unresolved,
    source: located,
  },
  { caption: str, condition: str },
);
const calculation = rec(
  { id: str, target: str, expression: str, unresolvedRefs: unresolved, source: located },
  { targetId: str, refresh: str },
);
const validation = rec(
  {
    id: str,
    kind: en(['errorCondition', 'blank'] as const),
    match: str,
    unresolvedRefs: unresolved,
    source: located,
  },
  {
    matchId: str,
    expressionContext: str,
    expression: str,
    message: rec({ text: str }, { type: str, shortMessage: str }),
  },
);
const connection = rec(
  {
    id: str,
    adapterKind: str,
    isQuery: bool,
    isSubmit: bool,
    attrs,
    children: list(rec({ kind: str, attrs, source: located })),
    endpoints: list(endpoint),
    credentialRedacted: bool,
    lineage: rec({ fieldIds: strs, usedBy: strs }),
    unresolvedRefs: unresolved,
    source: located,
  },
  { name: str, dataSource: str },
);
const unknownEntry = rec({
  kind: en(['element', 'attribute', 'text'] as const),
  reason: en(['notModelled', 'unexpectedValue', 'repeated'] as const),
  file: str,
  path: str,
  line: int,
  column: int,
  namespace: fc.option(str, { nil: null }),
  name: str,
  raw: str,
  documented: bool,
});
const issue = rec(
  { code: en(ISSUE_CODES), message: str },
  {
    file: str,
    path: str,
    offset: int,
    line: int,
    column: int,
    details: list(fc.tuple(key, fc.oneof(str, num))).map((e) => Object.fromEntries(e)),
  },
);

export const formIR: fc.Arbitrary<FormIR> = rec({
  irVersion: fc.constant(1),
  meta: rec(
    {
      name: str,
      nameSource: en(['caption', 'urn', 'none'] as const),
      generation: en(['2003', '2007', '2010', '2013', 'unknown'] as const),
      browserCompatible: bool,
      source: located,
    },
    {
      urn: str,
      solutionVersion: str,
      productVersion: str,
      solutionFormatVersion: str,
      publishUrl: str,
      generationEvidence: located,
      publishEndpoint: endpoint,
    },
  ),
  fields: list(field),
  groups: list(group),
  views: list(view),
  rules: list(rule),
  calculations: list(calculation),
  validations: list(validation),
  dataConnections: list(connection),
  codeBehind: rec({
    present: bool,
    languages: strs,
    files: strs,
    handlers: list(rec({ id: str, match: str, handler: str, source: located }, { targetId: str })),
  }),
  signatures: rec({
    blocks: list(
      rec(
        { id: str, source: located },
        { name: str, mode: str, message: str, data: str, dataId: str },
      ),
    ),
    signatureLines: list(rec({ id: str, attrs, source: located }, { view: str })),
  }),
  activeX: rec({
    controls: list(
      rec(
        { id: str, view: str, source: located },
        { classid: str, binding: str, targetId: str, server: endpoint },
      ),
    ),
    allowed: list(rec({ id: str, source: located }, { clsid: str, cabFile: str })),
  }),
  dependencies: rec({
    references: list(rec({ elementId: str, role: en(DEP_ROLES), targetId: str, text: str })),
  }),
  unknowns: list(unknownEntry),
  issues: list(issue),
}) as unknown as fc.Arbitrary<FormIR>;
