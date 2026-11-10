// Spec 09 R4.2: the small markers on each field of the tree.
import type { FormIR, IrValidation } from '@afterlife/core';

export interface Markers {
  /** Required as InfoPath shows it: FormIR `required`, or a blank check (the asterisk's rule). */
  readonly required: boolean;
  /** A rule, one of its actions or its trigger reads or writes the field. */
  readonly rule: boolean;
  readonly calculated: boolean;
  /** A validation other than the blank check. */
  readonly validated: boolean;
  /** Filled from a data connection (see `markersOf`). */
  readonly connection: boolean;
}

const RULE = /^(rule|action):/;

/**
 * The blank check of spec 03 §9.2, the rule core's asterisk follows (`requiredTargets` in
 * `render/marks.ts`; the main thread imports core types only, so it is repeated here): a
 * validation of kind `blank`, or one whose context is `.` and whose expression is `.=""` once
 * whitespace is removed.
 */
export const isBlankCheck = (v: IrValidation) =>
  v.kind === 'blank' ||
  (v.expressionContext === '.' && (v.expression ?? '').replace(/\s+/g, '') === '.=""');

/** `Changed at review:` the field ids the "Required" chip and the card's "Required" line mark. */
export function requiredIds(ir: FormIR): ReadonlySet<string> {
  const out = new Set(ir.fields.flatMap((f) => (f.required ? [f.id] : [])));
  for (const v of ir.validations)
    if (v.matchId !== undefined && isBlankCheck(v)) out.add(v.matchId);
  return out;
}

/**
 * `connection` is set when a control bound to the field takes its choices from a connection,
 * when a connection uses an element that writes the field (`lineage.usedBy`), or when the field
 * belongs to the tree a connection fills (`lineage.fieldIds`, a secondary data source).
 */
export function markersOf(ir: FormIR): Map<string, Markers> {
  const required = requiredIds(ir);
  const calculated = new Set(ir.calculations.flatMap((c) => (c.targetId ? [c.targetId] : [])));
  const validated = new Set(
    ir.validations.flatMap((v) => (v.matchId && !isBlankCheck(v) ? [v.matchId] : [])),
  );
  const usedBy = new Set(ir.dataConnections.flatMap((c) => c.lineage.usedBy));
  const filled = new Set(ir.dataConnections.flatMap((c) => c.lineage.fieldIds));
  const choices = new Set(
    ir.views.flatMap((v) =>
      v.controls.flatMap((c) => (c.choicesFrom?.connectionId && c.targetId ? [c.targetId] : [])),
    ),
  );
  return new Map(
    ir.fields.map((f) => {
      const refs = [...f.dependencies.readBy, ...f.dependencies.writtenBy];
      return [
        f.id,
        {
          required: required.has(f.id),
          rule: refs.some((r) => RULE.test(r.elementId)),
          calculated: calculated.has(f.id),
          validated: validated.has(f.id),
          connection:
            choices.has(f.id) ||
            filled.has(f.id) ||
            f.dependencies.writtenBy.some((r) => usedBy.has(r.elementId)),
        },
      ];
    }),
  );
}
