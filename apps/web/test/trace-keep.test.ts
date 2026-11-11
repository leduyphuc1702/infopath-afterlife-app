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

// Spec 19 P2, P5: an Undo or Redo entry carries the person's clock and no float noise.
test('P2: a step with no other entry is stamped with local time, as core stamps the rest', () => {
  const e = stepEntry('redo', { a: '1' }, { a: '2' }, []);
  const d = new Date();
  expect(e.at.slice(11, 13)).toBe(String(d.getHours()).padStart(2, '0'));
  expect(e.at).toMatch(/[+-]\d\d:\d\d$/);
});

test('P5: a number with float noise is shown as the form would store it', () => {
  const e = stepEntry('redo', { a: '0' }, { a: '1472.1299999999999' }, []);
  expect(e.changes[0]!.after).toBe('1472.13');
  expect(stepEntry('redo', { a: '0' }, { a: '0.1' }, []).changes[0]!.after).toBe('0.1');
  expect(stepEntry('redo', { a: '0' }, { a: 'E20001' }, []).changes[0]!.after).toBe('E20001');
});
