import type { FormIR, TriageResult } from '@afterlife/core';
import { expect, test } from 'vitest';
import { initialState, reducer } from '../src/store';
import type { RecordSummary, SessionRes, TemplateSummary } from '../src/worker/protocol';

// Spec 13 B4: the first record that arrived is shown; the empty form stays one Previous away.

const ir = { views: [{ name: 'V', isDefault: true }] } as unknown as FormIR;
const tpl = (templateId: string): TemplateSummary => ({
  templateId,
  fileName: `${templateId}.xsn`,
  ir,
});
const rec = (recordId: string, templateId: string): RecordSummary => ({
  recordId,
  fileName: `${recordId}.xml`,
  match: { kind: 'exact', templateId },
});
const session = (templates: TemplateSummary[], records: RecordSummary[]): SessionRes => ({
  type: 'session',
  templates,
  records,
  failures: [],
  duplicates: [],
  ignored: [],
  triage: {} as TriageResult,
});

test('B4: a template with its records opens on the first record; Previous reaches the empty form', () => {
  const s = reducer(initialState, {
    type: 'session',
    session: session([tpl('t1')], [rec('r2', 't1'), rec('r3', 't1')]),
    open: 't1',
    screen: 'form',
  });
  expect(s.recordIndex).toBe(1);
  expect(reducer(s, { type: 'record', index: 0 }).recordIndex).toBe(0);
});

test('B4: a template with no records opens on the empty form', () => {
  const s = reducer(initialState, {
    type: 'session',
    session: session([tpl('t1')], []),
    open: 't1',
  });
  expect(s.recordIndex).toBe(0);
});

test('B4: a record dropped for the open template is shown; an answer with no new record keeps the place', () => {
  let s = reducer(initialState, {
    type: 'session',
    session: session([tpl('t1')], [rec('r2', 't1')]),
    open: 't1',
  });
  s = reducer(s, { type: 'record', index: 0 });
  s = reducer(s, {
    type: 'session',
    session: session([tpl('t1')], [rec('r2', 't1'), rec('r5', 't1')]),
  });
  expect(s.recordIndex).toBe(2);
  s = reducer(s, { type: 'record', index: 1 });
  s = reducer(s, {
    type: 'session',
    session: session([tpl('t1')], [rec('r2', 't1'), rec('r5', 't1')]),
  });
  expect(s.recordIndex).toBe(1);
});
