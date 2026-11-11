import { expect, test } from 'vitest';
import type { TraceEntry } from '@afterlife/core';
import { keepTrace, stepEntry, TRACE_KEPT } from '../src/side/trace-keep';

// Spec 04 R9.2 (spec 16 task): the Rule Trace keeps the last 500 entries.
const entry = (seq: number): TraceEntry => ({
  seq,
  at: 'x',
  kind: 'rule',
  caption: `r${seq}`,
  changes: [],
});

test('R9.2: 600 entries in steps keep the newest 500, in order', () => {
  let t: TraceEntry[] = [];
  for (let i = 0; i < 6; i++)
    t = keepTrace(
      t,
      Array.from({ length: 100 }, (_, k) => entry(i * 100 + k + 1)),
    );
  expect(TRACE_KEPT).toBe(500);
  expect(t).toHaveLength(500);
  expect([t[0]!.seq, t.at(-1)!.seq]).toEqual([101, 600]);
});

test('N1: an undo entry lists the values that went back', () => {
  const e = stepEntry('undo', { a: '7', b: '1' }, { a: '55.39', b: '1' }, []);
  expect([e.kind, e.changes]).toEqual(['undo', [{ path: 'a', before: '7', after: '55.39' }]]);
});
