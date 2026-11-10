// FormIR JSON (spec 02 design §9, R13.1, R14): a stable serialiser and a strict parser. The parser
// checks every part against the shape of types.ts with a small schema table: required keys, no
// extra keys, value types, enum members. Strict on purpose: a new part bumps `irVersion`, and a
// consumer that meets another version rebuilds the FormIR from the `.xsn`.

import { AfterlifeError, ISSUE_CODES } from '../errors';
import {
  DEP_ROLES,
  LABEL_SOURCES,
  LIVENESS_REASONS,
  UNRESOLVED_REASONS,
  VIEW_LABEL_STEPS,
  type FormIR,
} from './types';

export const FORMIR_VERSION = 1 as const;

// ---- serialise --------------------------------------------------------------------------------

/** Sorted keys, arrays in order, two-space indent, final newline. */
export function serialiseFormIR(ir: FormIR): string {
  return `${JSON.stringify(normalise(ir, '$'), null, 2)}\n`;
}

function normalise(v: unknown, path: string): unknown {
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || Object.is(v, -0)) bad(path, `number ${String(v)}`);
    return v;
  }
  if (Array.isArray(v)) return v.map((x, i) => normalise(x, `${path}[${i}]`));
  if (typeof v !== 'object') bad(path, typeof v);
  const proto: unknown = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null) bad(path, 'not a plain object');
  const out = Object.create(null) as Record<string, unknown>;
  for (const k of Object.keys(v).sort()) {
    const x = (v as Record<string, unknown>)[k];
    if (x === undefined) bad(`${path}.${k}`, 'undefined');
    out[k] = normalise(x, `${path}.${k}`);
  }
  return out;
}

function bad(path: string, what: string): never {
  throw new AfterlifeError('INTERNAL', { path, reason: `FormIR cannot hold ${what}` });
}

// ---- schema -----------------------------------------------------------------------------------

type Schema =
  | { readonly t: 'str' | 'int' | 'num' | 'bool' | 'null' }
  | { readonly t: 'lit'; readonly v: string | number }
  | { readonly t: 'enum'; readonly vs: readonly string[] }
  | { readonly t: 'arr' | 'rec'; readonly of: Schema }
  | { readonly t: 'any'; readonly of: readonly Schema[] }
  | { readonly t: 'obj'; readonly req: Fields; readonly opt: Fields }
  | {
      readonly t: 'tagged';
      readonly key: string;
      readonly cases: Readonly<Record<string, Schema>>;
    };
type Fields = Readonly<Record<string, Schema>>;

const str: Schema = { t: 'str' };
const int: Schema = { t: 'int' };
const num: Schema = { t: 'num' };
const bool: Schema = { t: 'bool' };
const nul: Schema = { t: 'null' };
const lit = (v: string | number): Schema => ({ t: 'lit', v });
const en = (vs: readonly string[]): Schema => ({ t: 'enum', vs });
const arr = (of: Schema): Schema => ({ t: 'arr', of });
const rec = (of: Schema): Schema => ({ t: 'rec', of });
const any = (...of: Schema[]): Schema => ({ t: 'any', of });
const obj = (req: Fields, opt: Fields = {}): Schema => ({ t: 'obj', req, opt });
const strs = arr(str);

const located = obj({ file: str, path: str, line: int, column: int });
const attrs = rec(str);
const depRole = en(DEP_ROLES);
const depRef = obj({ elementId: str, role: depRole });
const unresolved = obj({ role: depRole, text: str, reason: en(UNRESOLVED_REASONS) });
const unresolvedRefs = arr(unresolved);
const endpoint = obj(
  {
    attribute: str,
    value: str,
    liveness: en(['internal', 'package', 'unknown']),
    reason: en(LIVENESS_REASONS),
    source: located,
  },
  { host: str },
);
const labelEvidence = obj(
  { step: en(LABEL_SOURCES) },
  { viewStep: en(VIEW_LABEL_STEPS), view: str, at: located },
);
const node = (req: Fields, opt: Fields = {}) =>
  obj(
    {
      id: str,
      dataSource: str,
      path: str,
      name: str,
      namespace: any(str, nul),
      nodeType: en(['element', 'attribute']),
      repeating: bool,
      optional: bool,
      label: str,
      labelSource: en(LABEL_SOURCES),
      labelEvidence,
      dependencies: obj({ readBy: arr(depRef), writtenBy: arr(depRef) }),
      source: located,
      ...req,
    },
    { groupId: str, choiceGroup: str, use: located, ...opt },
  );
const xsdType = obj(
  { builtin: str, variety: en(['atomic', 'list', 'union', 'complex']) },
  { declared: str, itemType: str, memberTypes: strs },
);
const field = node(
  { kind: en(['field', 'richText']), xsdType, required: bool },
  { default: str, fixed: str },
);
const group = node({ kind: lit('group') });
const control = obj(
  { id: str, binding: str, readOnly: bool, inRepeat: bool, source: located },
  {
    xctname: str,
    ctrlId: str,
    targetId: str,
    title: str,
    dynamicAttrs: strs,
    choice: obj({ label: str }, { value: str }),
    choicesFrom: obj({ dataSource: str, select: str, filterIds: strs }, { connectionId: str }),
  },
);
const view = obj(
  {
    id: str,
    name: str,
    isDefault: bool,
    isPrint: bool,
    scanned: bool,
    controls: arr(control),
    source: located,
  },
  { caption: str, xslFile: str, printView: str },
);
const trigger: Schema = {
  t: 'tagged',
  key: 'kind',
  cases: {
    fieldChange: obj({ kind: str, match: str, source: located }, { targetId: str }),
    onLoad: obj({ kind: str, source: located }),
    submit: obj({ kind: str, source: located }),
    button: obj({ kind: str, source: located }, { view: str, button: str }),
  },
};
const rule = obj(
  {
    id: str,
    ruleSet: str,
    enabled: bool,
    stopProcessing: bool,
    actions: arr(obj({ id: str, kind: str, attrs, source: located }, { text: str })),
    triggers: arr(trigger),
    unresolvedRefs,
    source: located,
  },
  { caption: str, condition: str },
);
const calculation = obj(
  { id: str, target: str, expression: str, unresolvedRefs, source: located },
  { targetId: str, refresh: str },
);
const validation = obj(
  {
    id: str,
    kind: en(['errorCondition', 'blank']),
    match: str,
    unresolvedRefs,
    source: located,
  },
  {
    matchId: str,
    expressionContext: str,
    expression: str,
    message: obj({ text: str }, { type: str, shortMessage: str }),
  },
);
const connection = obj(
  {
    id: str,
    adapterKind: str,
    isQuery: bool,
    isSubmit: bool,
    attrs,
    children: arr(obj({ kind: str, attrs, source: located })),
    endpoints: arr(endpoint),
    credentialRedacted: bool,
    lineage: obj({ fieldIds: strs, usedBy: strs }),
    unresolvedRefs,
    source: located,
  },
  { name: str, dataSource: str },
);
const unknownEntry = obj({
  kind: en(['element', 'attribute', 'text']),
  reason: en(['notModelled', 'unexpectedValue', 'repeated']),
  file: str,
  path: str,
  line: int,
  column: int,
  namespace: any(str, nul),
  name: str,
  raw: str,
  documented: bool,
});
const issue = obj(
  { code: en(ISSUE_CODES), message: str },
  { file: str, path: str, offset: int, line: int, column: int, details: rec(any(str, num)) },
);
const FORMIR: Schema = obj({
  irVersion: lit(FORMIR_VERSION),
  meta: obj(
    {
      name: str,
      nameSource: en(['caption', 'urn', 'none']),
      generation: en(['2003', '2007', '2010', '2013', 'unknown']),
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
  fields: arr(field),
  groups: arr(group),
  views: arr(view),
  rules: arr(rule),
  calculations: arr(calculation),
  validations: arr(validation),
  dataConnections: arr(connection),
  codeBehind: obj({
    present: bool,
    languages: strs,
    files: strs,
    handlers: arr(obj({ id: str, match: str, handler: str, source: located }, { targetId: str })),
  }),
  signatures: obj({
    blocks: arr(
      obj(
        { id: str, source: located },
        { name: str, mode: str, message: str, data: str, dataId: str },
      ),
    ),
    signatureLines: arr(obj({ id: str, attrs, source: located }, { view: str })),
  }),
  activeX: obj({
    controls: arr(
      obj(
        { id: str, view: str, source: located },
        { classid: str, binding: str, targetId: str, server: endpoint },
      ),
    ),
    allowed: arr(obj({ id: str, source: located }, { clsid: str, cabFile: str })),
  }),
  dependencies: obj({
    references: arr(obj({ elementId: str, role: depRole, targetId: str, text: str })),
  }),
  unknowns: arr(unknownEntry),
  issues: arr(issue),
});

// ---- parse ------------------------------------------------------------------------------------

export function parseFormIR(json: string): FormIR {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch (e) {
    invalid('$', `not JSON (${(e as Error).message})`);
  }
  if (!isObject(value)) invalid('$', 'not an object');
  if (value.irVersion !== FORMIR_VERSION) {
    throw new AfterlifeError('UNSUPPORTED_IR_VERSION', {
      found: JSON.stringify(value.irVersion) ?? 'absent',
    });
  }
  return check(FORMIR, value, '$') as FormIR;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function invalid(path: string, reason: string): never {
  throw new AfterlifeError('INVALID_IR', { path, reason });
}

/** Checks `v` against `s` and returns a copy (records as objects without a prototype). */
function check(s: Schema, v: unknown, path: string): unknown {
  switch (s.t) {
    case 'str':
      if (typeof v !== 'string') invalid(path, 'expected a string');
      return v;
    case 'bool':
      if (typeof v !== 'boolean') invalid(path, 'expected a boolean');
      return v;
    case 'null':
      if (v !== null) invalid(path, 'expected null');
      return v;
    case 'int':
    case 'num':
      if (typeof v !== 'number' || Object.is(v, -0) || (s.t === 'int' && !Number.isInteger(v))) {
        invalid(path, s.t === 'int' ? 'expected an integer' : 'expected a number');
      }
      return v;
    case 'lit':
      if (v !== s.v) invalid(path, `expected ${JSON.stringify(s.v)}`);
      return v;
    case 'enum':
      if (typeof v !== 'string' || !s.vs.includes(v)) {
        invalid(path, `expected one of ${s.vs.join(', ')}`);
      }
      return v;
    case 'arr':
      if (!Array.isArray(v)) invalid(path, 'expected an array');
      return v.map((x, i) => check(s.of, x, `${path}[${i}]`));
    case 'rec': {
      if (!isObject(v)) invalid(path, 'expected an object');
      const out = Object.create(null) as Record<string, unknown>;
      for (const k of Object.keys(v)) out[k] = check(s.of, v[k], `${path}.${k}`);
      return out;
    }
    case 'any': {
      for (const option of s.of) {
        try {
          return check(option, v, path);
        } catch (e) {
          if (!(e instanceof AfterlifeError) || e.code !== 'INVALID_IR') throw e;
        }
      }
      return invalid(path, 'no allowed type matches');
    }
    case 'tagged': {
      if (!isObject(v)) invalid(path, 'expected an object');
      const tag = v[s.key];
      const c = typeof tag === 'string' ? s.cases[tag] : undefined;
      if (!c) invalid(`${path}.${s.key}`, `expected one of ${Object.keys(s.cases).join(', ')}`);
      return check(c, v, path);
    }
    case 'obj': {
      if (!isObject(v)) invalid(path, 'expected an object');
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(s.req)) {
        if (!Object.hasOwn(v, k)) invalid(`${path}.${k}`, 'missing');
        out[k] = check(s.req[k]!, v[k], `${path}.${k}`);
      }
      for (const k of Object.keys(v)) {
        if (Object.hasOwn(s.req, k)) continue;
        const o = Object.hasOwn(s.opt, k) ? s.opt[k] : undefined;
        if (!o) invalid(`${path}.${k}`, 'unexpected key');
        out[k] = check(o, v[k], `${path}.${k}`);
      }
      return out;
    }
  }
}
