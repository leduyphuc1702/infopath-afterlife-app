// Spec 04 R9.2: the Rule Trace keeps the last 500 entries. Spec 16 N1: an Undo or Redo is an
// entry too, written here from the values on the paper before and after the step.
import type { TraceEntry } from '@afterlife/core';
import { localNow } from '../worker/client';

export const TRACE_KEPT = 500;

export const keepTrace = (old: readonly TraceEntry[], added: readonly TraceEntry[]) =>
  [...old, ...added].slice(-TRACE_KEPT);

let next = 0;

/** Spec 19 P5: a binary-float artefact shown with 15 significant digits, as InfoPath writes it. */
const plain = (v: string) => {
  if (!/^-?\d+\.\d{12,}$/.test(v)) return v;
  return String(Number(Number(v).toPrecision(15)));
};

export function stepEntry(
  kind: 'undo' | 'redo',
  before: Readonly<Record<string, string>>,
  after: Readonly<Record<string, string>>,
  trace: readonly TraceEntry[],
): TraceEntry {
  const changes = Object.keys(after)
    .filter((p) => p in before && before[p] !== after[p])
    .map((p) => ({ path: p, before: plain(before[p]!), after: plain(after[p]!) }));
  // Negative, so it never meets core's sequence numbers (React keys).
  return {
    seq: -++next,
    // Spec 19 P2: the person's clock, as core stamps every other entry.
    at: trace.at(-1)?.at ?? localNow(),
    kind,
    caption: '',
    changes,
  };
}
