// Spec 04 task 11 (R9.1, D25): a Rule Trace entry as a sentence a form owner can follow, e.g.
// "Total changed from 350.30 to 405.30 because Amount in row 2 changed."
// Spec 15 R2.1: moved from the web viewer; the dossier's sentences use the same names and verbs.
import type { FormIR, IrAction } from '../ir/types';
import type { TraceEntry } from '../runtime/trace';

/** "/my:a[1]/my:b[2]/my:c[1]" → "/my:a/my:b/my:c". */
const schemaPath = (path: string) => path.replace(/\[\d+\]/g, '');

/** A field's label, with its row when it is in a repeating group: "Amount in row 2". */
export function fieldName(ir: FormIR, path: string): string {
  const steps = path.split('/').slice(1);
  const node =
    ir.fields.find((f) => f.path === schemaPath(path)) ??
    ir.groups.find((g) => g.path === schemaPath(path));
  const label =
    node?.label ??
    steps
      .at(-1)
      ?.replace(/\[\d+\]$/, '')
      .replace(/^.*:/, '') ??
    path;
  // The innermost repeating group above the field gives the row number.
  for (let i = steps.length - 1; i > 0; i--) {
    const prefix = `/${steps.slice(0, i).join('/')}`;
    const g = ir.groups.find((x) => x.path === schemaPath(prefix) && x.repeating);
    if (g) return `${label} in row ${/\[(\d+)\]$/.exec(steps[i - 1]!)?.[1] ?? '1'}`;
  }
  return label;
}

const shown = (v: string) => (v === '' ? 'blank' : v);

/** What an action does, as the rest of "Rule … did not …" and "it …". */
export const ACTION_VERBS: Readonly<Record<string, string>> = {
  assignmentAction: 'set a field',
  queryAction: 'query a data connection',
  submitAction: 'submit',
  closeDocumentAction: 'close the form',
  switchViewAction: 'switch view',
  dialogBoxAction: 'show a message',
  dialogBoxExpressionAction: 'show a message',
  dialogBoxMessageAction: 'show a message',
  ruleSetAction: 'run another rule set',
};

/** The verb of an action, for kinds not in the table: its element name. */
export const actionVerb = (a: Pick<IrAction, 'kind'>): string =>
  ACTION_VERBS[a.kind] ?? `run “${a.kind}”`;

/** The sentence for one entry. Expressions are not in it; `entry.note` has them on demand. */
export function traceSentence(ir: FormIR, e: TraceEntry): string {
  const name = (p: string) => fieldName(ir, p);
  const because =
    e.button !== undefined
      ? ` because “${e.button}” was pressed`
      : e.trigger === undefined
        ? ''
        : ` because ${name(e.trigger)} changed`;
  const changed = e.changes
    .map((c) => `${name(c.path)} changed from ${shown(c.before)} to ${shown(c.after)}`)
    .join('; ');
  switch (e.kind) {
    case 'calc': {
      const c = e.changes[0];
      if (!c) return `${name(e.caption)} was worked out again${because}.`;
      // Spec 16 K13: at open the cause is the stored value, not another field.
      if (e.opened)
        return c.before === ''
          ? `${name(c.path)} was empty in the record and has been worked out: ${shown(c.after)}.`
          : `${name(c.path)} in the record (${c.before}) does not match the form’s formula, which gives ${shown(c.after)}; the form’s value is shown.`;
      return e.trigger === undefined
        ? `${name(c.path)} was worked out again: from ${shown(c.before)} to ${shown(c.after)}.`
        : `${changed}${because}.`;
    }
    case 'rule':
      if (e.condition === false)
        return `Rule “${e.caption}” checked${because}; its condition was not met, so it did nothing.`;
      return changed === ''
        ? `Rule “${e.caption}” ran${because}; no field changed.`
        : `Rule “${e.caption}” ran${because}: ${changed}.`;
    case 'validation':
      return e.condition === false
        ? `${name(e.trigger ?? '')} is no longer marked: “${e.caption}” is fixed.`
        : `${name(e.trigger ?? '')} is marked: ${e.caption}.`;
    case 'skipped': {
      // Spec 14 B8: no XPath in the sentence; the expression is behind "Show expression".
      const source = /^GetDOM\("([^"]+)"\)$/.exec(e.caption)?.[1];
      if (source !== undefined)
        return `Data connection “${source}” was not loaded. ${e.note ?? ''}`.trim();
      const m = /^(.*): (\w+)$/.exec(e.caption);
      const what = m
        ? `Rule “${m[1]}” did not ${ACTION_VERBS[m[2]!] ?? m[2]}`
        : `${e.caption} was skipped`;
      const query = /\(([^)]+)\)$/.exec(e.note ?? '')?.[1];
      if (e.note?.startsWith('Not run: it uses the result of a query') && query !== undefined)
        return `${what}: it needs the result of query “${query}”, which the viewer cannot run.`;
      if (e.note?.endsWith(' selects no field'))
        return `${what}: the field it sets is not in this form.`;
      return `${what}. ${e.note ?? ''}`.trim();
    }
    case 'undo':
    case 'redo': {
      // Spec 16 N1: written by the page from the values before and after the step.
      const back = e.changes.map((x) =>
        e.kind === 'undo'
          ? `${name(x.path)} is back to ${shown(x.after)}`
          : `${name(x.path)} is ${shown(x.after)} again`,
      );
      return `${e.kind === 'undo' ? 'Undo' : 'Redo'}: ${back.length ? back.join('; ') : 'no field changed'}.`;
    }
    case 'loop':
      return `Stopped a possible rule loop. ${e.note ?? ''}`.trim();
    case 'notEvaluated':
      return `${e.caption.startsWith('/') ? name(e.caption) : `“${e.caption}”`} could not be worked out in the viewer. ${e.note ?? ''}`.trim();
  }
}

/** The paths an entry is about, for the field filter and the outline. */
export const tracePaths = (e: TraceEntry): string[] => [
  ...e.changes.map((c) => c.path),
  ...(e.trigger === undefined ? [] : [e.trigger]),
];

/** The expression to show on demand: a calculation's formula. */
export const traceExpression = (e: TraceEntry): string | undefined =>
  e.kind === 'calc'
    ? e.note
    : e.kind === 'skipped' && e.note?.endsWith(' selects no field')
      ? e.note.slice(0, -' selects no field'.length)
      : undefined;

// ---------------------------------------------------------------------------------------------
// Spec 15 R1.3–R1.5: sentences about the template itself, for the form dossier.

/** A sentence with the expressions it is about, shown under it. */
export interface Sentence {
  readonly sentence: string;
  readonly expressions: readonly string[];
}

const getDom = /^xdXDocument:GetDOM\("([^"]+)"\)(.*)$/;

/** A field named by an expression's path: its label, or its last step's name. */
export function pathName(ir: FormIR, path: string): string {
  const m = getDom.exec(path.trim());
  if (m) {
    const node = ir.fields.find((f) => f.dataSource === m[1] && f.path === m[2]);
    const last = node?.label ?? m[2]!.split('/').at(-1)?.replace(/^.*:/, '') ?? m[2]!;
    return `${last} in data connection “${m[1]}”`;
  }
  if (!path.startsWith('/')) {
    const last = path.split('/').at(-1)?.replace(/\[.*$/, '').replace(/^.*:/, '') ?? path;
    const f = ir.fields.find((x) => x.dataSource === 'main' && x.name === last);
    return f?.label ?? last;
  }
  return fieldName(ir, path).replace(/ in row 1$/, '');
}

/** The label of a field or group by id, with its data source when it is not the main one. */
export function nodeName(ir: FormIR, id: string): string {
  const n = ir.fields.find((f) => f.id === id) ?? ir.groups.find((g) => g.id === id);
  // Spec 16 K11: a node FormIR does not know is named by its own name; the caller puts the
  // path under the sentence (`unnamedPaths`).
  if (!n) return localName(id);
  return n.dataSource === 'main' ? n.label : `${n.label} in data connection “${n.dataSource}”`;
}

/** The last step's local name of a path or id: `f:main:/my:a/my:subtotal` → "subtotal". */
export const localName = (path: string): string =>
  path.split('/').at(-1)?.replace(/\[.*$/, '').replace(/^.*:/, '') || path;

/** Spec 16 K11: paths an element refers to that FormIR has no node for. */
export function unnamedPaths(ir: FormIR, elementId: string): string[] {
  const known = (id: string) =>
    ir.fields.some((f) => f.id === id) || ir.groups.some((g) => g.id === id);
  return unique(
    ir.dependencies.references
      .filter((r) => r.elementId === elementId && !known(r.targetId))
      .map((r) => r.targetId.replace(/^[^/]*:(?=\/)/, '')),
  );
}

/** "A", "A and B", "A, B and C". */
export const list = (xs: readonly string[]): string =>
  xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`;

const unique = <T>(xs: readonly T[]) => [...new Set(xs)];

/** The fields an element reads, by role, in FormIR's reference order. */
export function readsOf(ir: FormIR, elementId: string, roles: readonly string[]): string[] {
  return unique(
    ir.dependencies.references
      .filter((r) => r.elementId === elementId && roles.includes(r.role))
      .map((r) => nodeName(ir, r.targetId)),
  );
}

/** True when a schema path is inside a repeating group. */
const inRow = (ir: FormIR, path: string) =>
  ir.groups.some((g) => g.repeating && path.startsWith(`${g.path}/`));

const literal = (e: string): string | undefined => {
  const t = e.trim();
  const s = /^"([^"]*)"$/.exec(t) ?? /^'([^']*)'$/.exec(t);
  if (s) return `“${s[1]}”`;
  return /^-?\d+(\.\d+)?$/.test(t) ? t : undefined;
};

/** What one action does, after "it". */
export function actionSentence(ir: FormIR, a: IrAction): Sentence {
  const at = a.attrs;
  switch (a.kind) {
    case 'assignmentAction': {
      const target = pathName(ir, at['targetField'] ?? '');
      const e = at['expression'] ?? '';
      const lit = literal(e);
      if (lit === '“”') return { sentence: `clears ${target}`, expressions: [] };
      if (lit !== undefined) return { sentence: `sets ${target} to ${lit}`, expressions: [] };
      const from = readsOf(ir, a.id, ['actionExpression']);
      return {
        sentence: `sets ${target} from ${from.length ? list(from) : 'a formula'}`,
        expressions: [e],
      };
    }
    case 'queryAction':
      return {
        sentence: `queries data connection “${at['adapter'] ?? '?'}”`,
        expressions: [],
      };
    case 'submitAction':
      return {
        sentence: at['adapter'] ? `submits the form to “${at['adapter']}”` : 'submits the form',
        expressions: [],
      };
    case 'closeDocumentAction':
      return { sentence: 'closes the form', expressions: [] };
    case 'switchViewAction':
      return { sentence: `switches to view “${at['view'] ?? '?'}”`, expressions: [] };
    case 'ruleSetAction':
      return { sentence: `runs rule set “${at['ruleSet'] ?? '?'}”`, expressions: [] };
    case 'dialogBoxAction':
    case 'dialogBoxMessageAction':
      return { sentence: `shows the message “${a.text ?? ''}”`, expressions: [] };
    case 'dialogBoxExpressionAction': {
      const from = readsOf(ir, a.id, ['dialogText', 'actionExpression']);
      return {
        sentence: `shows a message built from ${from.length ? list(from) : 'a formula'}`,
        expressions: a.text === undefined ? [] : [a.text],
      };
    }
    default:
      return {
        sentence: `has an action the viewer does not describe (${a.kind})`,
        expressions: [],
      };
  }
}

/** When a rule runs: "when Country changes", "when the form opens", … */
export function ruleWhen(
  ir: FormIR,
  r: FormIR['rules'][number],
  captions?: ReadonlyMap<string, string>,
): string {
  const whens = r.triggers.map((t) => {
    switch (t.kind) {
      case 'fieldChange':
        return `when ${t.targetId ? nodeName(ir, t.targetId) : pathName(ir, t.match)} changes`;
      case 'onLoad':
        return 'when the form opens';
      case 'submit':
        return 'when the form is submitted';
      case 'button':
        return `when ${buttonName(t.button, t.view, captions)} is pressed`;
    }
  });
  return whens.length ? list(unique(whens)) : 'only when another rule runs its rule set';
}

/**
 * Spec 16 K2: a button by the caption its view shows (`buttonCaptions`); its control id only
 * when the view gives none.
 */
export const buttonName = (
  button?: string,
  view?: string,
  captions?: ReadonlyMap<string, string>,
) => {
  const caption = button === undefined ? undefined : captions?.get(button);
  const on = view ? ` on view “${view}”` : '';
  return caption !== undefined
    ? `the button “${caption}”${on}`
    : `button ${button ?? '(no id)'}${on}`;
};

export function ruleSentence(
  ir: FormIR,
  r: FormIR['rules'][number],
  captions?: ReadonlyMap<string, string>,
): Sentence {
  const self = r.triggers.find((t) => t.kind === 'fieldChange');
  const words =
    r.condition === undefined
      ? undefined
      : conditionWords(
          ir,
          r.condition,
          self?.kind === 'fieldChange' && self.targetId ? nodeName(ir, self.targetId) : undefined,
        );
  const on = readsOf(ir, r.id, ['condition']);
  const cond = r.condition
    ? words !== undefined
      ? `, if ${words}`
      : `, if ${on.length ? `a condition on ${list(on)}` : 'its condition'} is true`
    : '';
  const acts = r.actions.map((a) => actionSentence(ir, a));
  const does = acts.length ? `it ${list(acts.map((a) => a.sentence))}` : 'it does nothing';
  const tail = [
    r.stopProcessing ? ' Then no later rule in the set runs.' : '',
    r.enabled ? '' : ' It is turned off.',
  ].join('');
  return {
    sentence: `Rule “${r.caption ?? 'without a name'}” runs ${ruleWhen(ir, r, captions)}${cond}: ${does}.${tail}`,
    expressions: [
      ...(r.condition ? [r.condition] : []),
      ...acts.flatMap((a) => a.expressions),
      ...unnamedPaths(ir, r.id),
      ...r.actions.flatMap((a) => unnamedPaths(ir, a.id)),
    ],
  };
}

export function calcSentence(ir: FormIR, c: FormIR['calculations'][number]): Sentence {
  const target = c.targetId ? nodeName(ir, c.targetId) : pathName(ir, c.target);
  const from = readsOf(ir, c.id, ['calcExpression']);
  const row = inRow(ir, c.target) ? ' in each row' : '';
  return {
    sentence: from.length
      ? `${target} is calculated${row} from ${list(from)}, again whenever ${from.length > 1 ? 'they change' : 'it changes'}.`
      : `${target} is calculated${row} by a formula that reads no field.`,
    expressions: [
      c.expression,
      ...(c.targetId && ir.fields.some((f) => f.id === c.targetId) ? [] : [c.target]),
      ...unnamedPaths(ir, c.id).filter((p) => p !== c.target),
    ],
  };
}

export function validationSentence(ir: FormIR, v: FormIR['validations'][number]): Sentence {
  const field = v.matchId ? nodeName(ir, v.matchId) : pathName(ir, v.match);
  const msg = v.message;
  const short = msg?.shortMessage ?? msg?.text;
  const end = (t: string) => (/[.!?]$/.test(t) ? '' : '.');
  const full = msg && msg.text !== short ? ` Its full message: “${msg.text}”${end(msg.text)}` : '';
  if (v.kind === 'blank')
    return {
      sentence: `${field} must not be blank.${short ? ` Message: “${short}”.` : ''}`,
      expressions: [],
    };
  const words = v.expression === undefined ? undefined : conditionWords(ir, v.expression, 'it');
  const on = readsOf(ir, v.id, ['validationExpression']);
  const when = words ?? `${on.length ? `a condition on ${list(on)}` : 'its condition'} is true`;
  return {
    sentence: `${field} is marked${short ? ` “${short}”` : ' as an error'} when ${when}.${full}`,
    expressions: [...(v.expression === undefined ? [] : [v.expression]), ...unnamedPaths(ir, v.id)],
  };
}

/** Any FormIR element by id, in words: for "what depends on what". */
export function elementName(ir: FormIR, id: string): string {
  const rule = ir.rules.find((r) => r.id === id || r.actions.some((a) => a.id === id));
  if (rule) return `rule “${rule.caption ?? 'without a name'}”`;
  const c = ir.calculations.find((x) => x.id === id);
  if (c)
    return `the calculation of ${c.targetId ? nodeName(ir, c.targetId) : pathName(ir, c.target)}`;
  const v = ir.validations.find((x) => x.id === id);
  if (v) return `the check on ${v.matchId ? nodeName(ir, v.matchId) : pathName(ir, v.match)}`;
  const d = ir.dataConnections.find((x) => x.id === id);
  if (d) return `data connection “${d.name ?? d.dataSource ?? d.adapterKind}”`;
  for (const view of ir.views) {
    const k = view.controls.find((x) => x.id === id);
    if (k)
      return `the ${k.choicesFrom ? 'choice list' : (k.xctname ?? 'control')} of ${k.targetId ? nodeName(ir, k.targetId) : 'a control'} on view “${view.caption ?? view.name}”`;
  }
  return id;
}

// ---------------------------------------------------------------------------------------------
// Spec 16 K4: a condition in words, for the shapes InfoPath's condition builder writes:
// comparisons of a field with a value or another field, "is blank", and `and`, `or`, `not()`
// of those. Anything else gives `undefined`, and the caller keeps "a condition on X is true".

type Tok = { readonly t: 'str' | 'num' | 'op' | 'name' | '(' | ')' | ','; readonly v: string };

function tokens(e: string): Tok[] | undefined {
  const out: Tok[] = [];
  const re =
    /\s*(?:("[^"]*"|'[^']*')|(-?\d+(?:\.\d+)?)(?![\w:])|(!=|<=|>=|=|<|>)|([(),])|([^\s()=!<>,"']+))/y;
  let i = 0;
  while (i < e.length) {
    if (/^\s*$/.test(e.slice(i))) break;
    re.lastIndex = i;
    const m = re.exec(e);
    if (!m) return undefined;
    i = re.lastIndex;
    if (m[1] !== undefined) out.push({ t: 'str', v: m[1].slice(1, -1) });
    else if (m[2] !== undefined) out.push({ t: 'num', v: m[2] });
    else if (m[3] !== undefined) out.push({ t: 'op', v: m[3] });
    else if (m[4] !== undefined) out.push({ t: m[4] as '(' | ')' | ',', v: m[4] });
    else out.push({ t: 'name', v: m[5]! });
  }
  return out;
}

type Operand =
  | { readonly k: 'field'; readonly name: string }
  | { readonly k: 'value'; readonly text: string; readonly blank: boolean };
type Cond =
  | { readonly k: 'cmp'; readonly a: Operand; readonly op: string; readonly b: Operand }
  | { readonly k: 'before'; readonly a: Operand; readonly b: Operand; readonly not: boolean }
  | { readonly k: 'blank'; readonly a: Operand; readonly not: boolean }
  | { readonly k: 'and' | 'or'; readonly xs: readonly Cond[] }
  | { readonly k: 'not'; readonly x: Cond };

const INVERSE: Readonly<Record<string, string>> = {
  '=': '!=',
  '!=': '=',
  '<': '>=',
  '>=': '<',
  '>': '<=',
  '<=': '>',
};
const UNWRAP = new Set(['xdMath:Nz', 'string', 'number', 'normalize-space']);

export function conditionWords(ir: FormIR, expression: string, self?: string): string | undefined {
  const ts = tokens(expression);
  if (!ts) return undefined;
  let i = 0;
  const peek = () => ts[i];
  const take = (t: Tok['t'], v?: string) => {
    const x = ts[i];
    if (!x || x.t !== t || (v !== undefined && x.v !== v)) throw new Error('shape');
    i++;
    return x;
  };
  const isName = (v: string) => peek()?.t === 'name' && peek()!.v === v;
  const fieldOf = (p: string): Operand => {
    if (p.includes('[') || p.includes('*') || p.startsWith('$') || p.startsWith('@'))
      throw new Error('shape');
    if (p === '.') {
      if (self === undefined) throw new Error('shape');
      return { k: 'field', name: self };
    }
    return { k: 'field', name: pathName(ir, p) };
  };
  const operand = (): Operand => {
    const x = peek();
    if (!x) throw new Error('shape');
    if (x.t === 'str') return (i++, { k: 'value', text: `“${x.v}”`, blank: x.v === '' });
    if (x.t === 'num') return (i++, { k: 'value', text: x.v, blank: false });
    if (x.t === 'name' && ts[i + 1]?.t === '(') {
      if (!UNWRAP.has(x.v)) throw new Error('shape');
      i += 2;
      const inner = operand();
      take(')');
      return inner;
    }
    if (x.t === 'name') return (i++, fieldOf(x.v));
    throw new Error('shape');
  };
  const primary = (): Cond => {
    if (isName('not') && ts[i + 1]?.t === '(') {
      i += 2;
      const x = or();
      take(')');
      return { k: 'not', x };
    }
    if (peek()?.t === '(') {
      i++;
      const x = or();
      take(')');
      return x;
    }
    if (isName('msxsl:string-compare') && ts[i + 1]?.t === '(') {
      i += 2;
      const a = operand();
      take(',');
      const b = operand();
      take(')');
      const op = take('op').v;
      const n = take('num').v;
      if (n !== '0' || !['<', '>', '>=', '<='].includes(op)) throw new Error('shape');
      return op === '<' || op === '>='
        ? { k: 'before', a, b, not: op === '>=' }
        : { k: 'before', a: b, b: a, not: op === '<=' };
    }
    const a = operand();
    if (peek()?.t !== 'op') {
      // A bare field: true when it has text.
      if (a.k !== 'field') throw new Error('shape');
      return { k: 'blank', a, not: true };
    }
    const op = take('op').v;
    const b = operand();
    if (b.k === 'value' && b.blank && (op === '=' || op === '!='))
      return { k: 'blank', a, not: op === '!=' };
    return { k: 'cmp', a, op, b };
  };
  const and = (): Cond => {
    const xs = [primary()];
    while (isName('and')) {
      i++;
      xs.push(primary());
    }
    return xs.length === 1 ? xs[0]! : { k: 'and', xs };
  };
  const or = (): Cond => {
    const xs = [and()];
    while (isName('or')) {
      i++;
      xs.push(and());
    }
    return xs.length === 1 ? xs[0]! : { k: 'or', xs };
  };
  let c: Cond;
  try {
    c = or();
    if (i !== ts.length) return undefined;
  } catch {
    return undefined;
  }
  return say(c, false);
}

const word = (o: Operand) => (o.k === 'field' ? o.name : o.text);

function say(c: Cond, not: boolean): string | undefined {
  switch (c.k) {
    case 'not':
      return say(c.x, !not);
    case 'and':
    case 'or': {
      // De Morgan under `not`.
      const k = not ? (c.k === 'and' ? 'or' : 'and') : c.k;
      const parts = c.xs.map((x) => say(x, not));
      if (parts.some((p) => p === undefined)) return undefined;
      return parts.join(` ${k} `);
    }
    case 'blank':
      return `${word(c.a)} is ${c.not !== not ? 'not blank' : 'blank'}`;
    case 'before':
      return `${word(c.a)} ${c.not !== not ? 'does not come before' : 'comes before'} ${word(c.b)}`;
    case 'cmp': {
      const op = not ? INVERSE[c.op]! : c.op;
      const b = word(c.b);
      switch (op) {
        case '=':
          return `${word(c.a)} is ${b}`;
        case '!=':
          return `${word(c.a)} is not ${b}`;
        case '<':
          return `${word(c.a)} is less than ${b}`;
        case '>':
          return `${word(c.a)} is greater than ${b}`;
        case '<=':
          return `${word(c.a)} is ${b} or less`;
        case '>=':
          return `${word(c.a)} is ${b} or more`;
      }
      return undefined;
    }
  }
}
