// Spec 04 task 11 (R9.1, D25): a Rule Trace entry as a sentence a form owner can follow, e.g.
// "Total changed from 350.30 to 405.30 because Amount in row 2 changed."
import type { FormIR, TraceEntry } from '@afterlife/core';

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

const ACTIONS: Readonly<Record<string, string>> = {
  assignmentAction: 'set a field',
  queryAction: 'query a data connection',
  submitAction: 'submit',
  closeDocumentAction: 'close the form',
  switchViewAction: 'switch view',
  dialogBoxAction: 'show a message',
  dialogBoxExpressionAction: 'show a message',
};

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
      const m = /^(.*): (\w+)$/.exec(e.caption);
      const what = m
        ? `Rule “${m[1]}” did not ${ACTIONS[m[2]!] ?? m[2]}`
        : `${e.caption} was skipped`;
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
  e.kind === 'calc' ? e.note : undefined;
