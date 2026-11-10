// Spec 09 R4.2: the small markers on each field of the tree.
import type { FormIR } from '@afterlife/core';

export interface Markers {
  /** A rule, one of its actions or its trigger reads or writes the field. */
  readonly rule: boolean;
  readonly calculated: boolean;
  readonly validated: boolean;
  /** Filled from a data connection (see `markersOf`). */
  readonly connection: boolean;
}

const RULE = /^(rule|action):/;

/**
 * `connection` is set when a control bound to the field takes its choices from a connection,
 * when a connection uses an element that writes the field (`lineage.usedBy`), or when the field
 * belongs to the tree a connection fills (`lineage.fieldIds`, a secondary data source).
 */
export function markersOf(ir: FormIR): Map<string, Markers> {
  const calculated = new Set(ir.calculations.flatMap((c) => (c.targetId ? [c.targetId] : [])));
  const validated = new Set(ir.validations.flatMap((v) => (v.matchId ? [v.matchId] : [])));
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
