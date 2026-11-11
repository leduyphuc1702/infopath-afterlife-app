// Spec 04 R5.1, design D16: which field nodes are invalid, and why. Four sources, first one wins
// per node: required and empty; not of its schema type; outside a facet; an errorCondition.

import type { FormIR } from '../ir/types';
import { requiredTargets } from '../render/marks';
import { toRegExp } from '../xsd/empty-string';
import { NotEvaluated, textOf, type Evaluator, type RtNode } from './evaluate';
import type { FieldIndex } from './model';

export interface Invalid {
  readonly path: string;
  readonly fieldId: string;
  readonly kind: 'required' | 'type' | 'facet' | 'errorCondition';
  readonly short: string;
  readonly message: string;
}

const DATE = '-?\\d{4,}-(\\d{2})-(\\d{2})';
const TIME = '(\\d{2}):(\\d{2}):(\\d{2})(\\.\\d+)?';
const ZONE = '(Z|[+-]\\d{2}:\\d{2})?';
const DECIMAL = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;
const DOUBLE = /^([+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?|-?INF|NaN)$/;
const INTEGER = /^[+-]?\d+$/;
const INTEGERS = new Set(
  'integer long int short byte nonNegativeInteger positiveInteger nonPositiveInteger negativeInteger unsignedLong unsignedInt unsignedShort unsignedByte'.split(
    ' ',
  ),
);

const okDate = (y: string, m: string, d: string) => {
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = (Number(y) % 4 === 0 && Number(y) % 100 !== 0) || Number(y) % 400 === 0;
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
};
const okTime = (h: string, m: string, s: string) =>
  Number(h) < 24 && Number(m) < 60 && Number(s) < 60;

/** The type message for `text` of builtin `type`, or undefined when it fits. */
export function typeProblem(type: string, text: string): string | undefined {
  const t = type.replace(/^\w+:/, '');
  const v = text.trim();
  if (t === 'double' || t === 'float') return DOUBLE.test(v) ? undefined : 'Only numbers allowed';
  if (t === 'decimal') return DECIMAL.test(v) ? undefined : 'Only numbers allowed';
  if (INTEGERS.has(t)) {
    if (!INTEGER.test(v)) return 'Only whole numbers allowed';
    const n = BigInt(v.replace(/^\+/, ''));
    if ((t.startsWith('nonNegative') || t.startsWith('unsigned')) && n < 0n)
      return 'Only whole numbers allowed';
    if (t === 'positiveInteger' && n < 1n) return 'Only whole numbers allowed';
    return undefined;
  }
  if (t === 'boolean')
    return /^(true|false|1|0)$/.test(v) ? undefined : 'Only true or false allowed';
  if (t === 'date') {
    const m = new RegExp(`^${DATE}${ZONE}$`).exec(v);
    return m && okDate(v.replace(/^-/, '').slice(0, 4), m[1]!, m[2]!)
      ? undefined
      : 'Only dates allowed';
  }
  if (t === 'time') {
    const m = new RegExp(`^${TIME}${ZONE}$`).exec(v);
    return m && okTime(m[1]!, m[2]!, m[3]!) ? undefined : 'Only times allowed';
  }
  if (t === 'dateTime') {
    const m = new RegExp(`^${DATE}T${TIME}${ZONE}$`).exec(v);
    return m && okDate(v.replace(/^-/, '').slice(0, 4), m[1]!, m[2]!) && okTime(m[3]!, m[4]!, m[5]!)
      ? undefined
      : 'Only dates and times allowed';
  }
  return undefined;
}

export interface ValidateHost {
  readonly ir: FormIR;
  readonly index: FieldIndex;
  readonly evaluator: Evaluator;
  readonly doc: RtNode;
  pathOf(node: RtNode): string;
  notEvaluated(caption: string, note: string): void;
}

export function validate(h: ValidateHost): Invalid[] {
  const found = new Map<RtNode, Invalid>();
  const add = (
    node: RtNode,
    fieldId: string,
    kind: Invalid['kind'],
    short: string,
    message = short,
  ) => {
    if (!found.has(node)) found.set(node, { path: h.pathOf(node), fieldId, kind, short, message });
  };
  const required = requiredTargets(h.ir);
  const nodes = h.index.nodes(h.doc);
  for (const [id, list] of nodes) {
    const field = h.index.field(id);
    if (!field) continue;
    const schema = h.index.schema(id);
    for (const node of list) {
      const text = textOf(node);
      if (text === '') {
        if (required.has(id))
          add(node, id, 'required', 'Cannot be blank', 'This field is required.');
        continue;
      }
      if (field.kind === 'richText' || !field.xsdType) continue;
      const t = typeProblem(field.xsdType.builtin, text);
      if (t) {
        add(node, id, 'type', t);
        continue;
      }
      const f = facetProblem(schema?.facets ?? [], text);
      if (f === null) h.notEvaluated(field.path, 'its pattern has no JavaScript equivalent');
      else if (f) add(node, id, 'facet', f);
    }
  }
  for (const v of h.ir.validations) {
    if (v.kind !== 'errorCondition' || v.expression === undefined) continue;
    try {
      const targets =
        v.matchId !== undefined ? (nodes.get(v.matchId) ?? []) : h.evaluator.nodes(v.match, h.doc);
      for (const t of targets) {
        const ctx =
          v.expressionContext && v.expressionContext !== '.'
            ? h.evaluator.nodes(v.expressionContext, t)[0]
            : t;
        if (ctx && h.evaluator.boolean(v.expression, ctx))
          add(
            t,
            v.matchId ?? h.index.idOf(t) ?? '',
            'errorCondition',
            v.message?.shortMessage ?? v.message?.text ?? 'Invalid',
            v.message?.text ?? v.message?.shortMessage ?? 'Invalid',
          );
      }
    } catch (e) {
      if (!(e instanceof NotEvaluated)) throw e;
      h.notEvaluated(v.match, e.message);
    }
  }
  // Document order of the nodes, which is the order of the record.
  const order = new Map<RtNode, number>();
  for (const list of nodes.values()) for (const n of list) order.set(n, order.size);
  return [...found.entries()]
    .sort((a, b) => (order.get(a[0]) ?? 1e9) - (order.get(b[0]) ?? 1e9))
    .map(([, i]) => i);
}

/** A facet message; undefined when it fits; null when a pattern cannot be evaluated. */
function facetProblem(
  facets: readonly { name: string; value: string }[],
  text: string,
): string | undefined | null {
  const enums = facets.filter((f) => f.name === 'enumeration').map((f) => f.value);
  if (enums.length > 0 && !enums.includes(text)) return `Only ${enums.join(', ')} allowed`;
  const len = [...text].length;
  for (const f of facets) {
    const n = Number(f.value);
    if (f.name === 'maxLength' && len > n) return `No more than ${n} characters`;
    if (f.name === 'minLength' && len < n) return `At least ${n} characters`;
    if (f.name === 'length' && len !== n) return `Exactly ${n} characters`;
  }
  const patterns = facets.filter((f) => f.name === 'pattern');
  if (patterns.length > 0) {
    const res = patterns.map((p) => toRegExp(p.value));
    if (res.some((r) => r === undefined)) return null;
    if (!res.some((r) => r!.test(text))) return 'Not in the expected format';
  }
  return undefined;
}
