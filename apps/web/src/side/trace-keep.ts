// Spec 04 R9.2: the Rule Trace keeps the last 500 entries. Spec 16 N1: an Undo or Redo is an
// entry too, written here from the values on the paper before and after the step.
import type { TraceEntry } from '@afterlife/core';

export const TRACE_KEPT = 500;

export const keepTrace = (old: readonly TraceEntry[], added: readonly TraceEntry[]) =>
  [...old, ...added].slice(-TRACE_KEPT);

let next = 0;

export function stepEntry(
  kind: 'undo' | 'redo',
  before: Readonly<Record<string, string>>,
  after: Readonly<Record<string, string>>,
  trace: readonly TraceEntry[],
): TraceEntry {
  const changes = Object.keys(after)
    .filter((p) => p in before && before[p] !== after[p])
    .map((p) => ({ path: p, before: before[p]!, after: after[p]! }));
  // Negative, so it never meets core's sequence numbers (React keys).
  return {
    seq: -++next,
    at: trace.at(-1)?.at ?? new Date().toISOString(),
    kind,
    caption: '',
    changes,
  };
}
