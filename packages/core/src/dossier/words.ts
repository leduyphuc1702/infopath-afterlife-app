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
  const because = e.trigger === undefined ? '' : ` because ${name(e.trigger)} changed`;
  const changed = e.changes
    .map((c) => `${name(c.path)} changed from ${shown(c.before)} to ${shown(c.after)}`)
    .join('; ');
  switch (e.kind) {
    case 'calc': {
      const c = e.changes[0];
      if (!c) return `${name(e.caption)} was worked out again${because}.`;
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
  if (!n) return id;
  return n.dataSource === 'main' ? n.label : `${n.label} in data connection “${n.dataSource}”`;
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
export function ruleWhen(ir: FormIR, r: FormIR['rules'][number]): string {
  const whens = r.triggers.map((t) => {
    switch (t.kind) {
      case 'fieldChange':
        return `when ${t.targetId ? nodeName(ir, t.targetId) : pathName(ir, t.match)} changes`;
      case 'onLoad':
        return 'when the form opens';
      case 'submit':
        return 'when the form is submitted';
      case 'button':
        return `when ${buttonName(t.button, t.view)} is pressed`;
    }
  });
  return whens.length ? list(unique(whens)) : 'only when another rule runs its rule set';
}

/** Spec 15 D1: FormIR has no button captions; a button is its control id and view. */
export const buttonName = (button?: string, view?: string) =>
  `button ${button ?? '(no id)'}${view ? ` on view “${view}”` : ''}`;

export function ruleSentence(ir: FormIR, r: FormIR['rules'][number]): Sentence {
  const cond = r.condition
    ? `, if ${readsOf(ir, r.id, ['condition']).length ? `a condition on ${list(readsOf(ir, r.id, ['condition']))}` : 'its condition'} is true`
    : '';
  const acts = r.actions.map((a) => actionSentence(ir, a));
  const does = acts.length ? `it ${list(acts.map((a) => a.sentence))}` : 'it does nothing';
  const tail = [
    r.stopProcessing ? ' Then no later rule in the set runs.' : '',
    r.enabled ? '' : ' It is turned off.',
  ].join('');
  return {
    sentence: `Rule “${r.caption ?? 'without a name'}” runs ${ruleWhen(ir, r)}${cond}: ${does}.${tail}`,
    expressions: [...(r.condition ? [r.condition] : []), ...acts.flatMap((a) => a.expressions)],
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
    expressions: [c.expression],
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
  const on = readsOf(ir, v.id, ['validationExpression']);
  if (/^\s*\.\s*=\s*(""|'')\s*$/.test(v.expression ?? ''))
    return {
      sentence: `${field} is marked${short ? ` “${short}”` : ' as an error'} when it is blank.${full}`,
      expressions: [v.expression!],
    };
  return {
    sentence: `${field} is marked${short ? ` “${short}”` : ' as an error'} when ${on.length ? `a condition on ${list(on)}` : 'its condition'} is true.${full}`,
    expressions: v.expression === undefined ? [] : [v.expression],
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
