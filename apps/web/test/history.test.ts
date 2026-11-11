import type { FormIR, TriageResult } from '@afterlife/core';
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { keyOf, placeIn, placeOf, visit, type HistoryLike } from '../src/shell/history';
import { initialState, reducer, type Action, type State } from '../src/store';
import type { SessionRes, TemplateSummary } from '../src/worker/protocol';

// Spec 13 B2, P17: each screen change is one history entry; Back undoes them in order and
// Forward replays them.

const ir = { views: [{ name: 'V', isDefault: true }] } as unknown as FormIR;
const tpl = (templateId: string): TemplateSummary => ({
  templateId,
  fileName: `${templateId}.xsn`,
  ir,
});
const session = (templates: TemplateSummary[]): SessionRes => ({
  type: 'session',
  templates,
  records: [],
  failures: [],
  duplicates: [],
  ignored: [],
  triage: {} as TriageResult,
});

/** `window.history` as the browser keeps it: entries, an index, `popstate` on Back and Forward. */
class FakeHistory implements HistoryLike {
  entries: unknown[] = [null];
  at = 0;
  constructor(private readonly onPop: (state: unknown) => void) {}
  get state() {
    return this.entries[this.at];
  }
  pushState(data: unknown) {
    this.entries = [...this.entries.slice(0, this.at + 1), data];
    this.at++;
  }
  replaceState(data: unknown) {
    this.entries[this.at] = data;
  }
  go(delta: number) {
    const to = this.at + delta;
    if (to < 0 || to >= this.entries.length) return;
    this.at = to;
    this.onPop(this.state);
  }
}

const IDS = ['t1', 't2', 't3'];
const change = fc.oneof(
  fc.constant<Action>({ type: 'screen', screen: 'triage' }),
  fc
    .constantFrom(...IDS)
    .map<Action>((templateId) => ({ type: 'screen', screen: 'certificate', templateId })),
  fc
    .constantFrom(...IDS)
    .map<Action>((templateId) => ({ type: 'screen', screen: 'form', templateId })),
);

test('P17: n screen changes, then n Back steps, is the start; Forward replays them', () => {
  fc.assert(
    fc.property(fc.array(change, { maxLength: 12 }), (actions) => {
      let s: State = reducer(initialState, {
        type: 'session',
        session: session(IDS.map(tpl)),
        open: 't1',
        screen: 'triage',
      });
      const h = new FakeHistory((state) => {
        const place = placeIn(state);
        if (place) settle({ type: 'restore', place });
      });
      const settle = (a?: Action) => {
        if (a) s = reducer(s, a);
        visit(h, placeOf(s));
      };
      settle();
      const seen = [keyOf(placeOf(s))];
      for (const a of actions) {
        settle(a);
        const k = keyOf(placeOf(s));
        if (k !== seen.at(-1)) seen.push(k);
      }
      const n = seen.length - 1;
      for (let i = n - 1; i >= 0; i--) {
        h.go(-1);
        expect(keyOf(placeOf(s))).toBe(seen[i]);
      }
      for (let i = 1; i <= n; i++) {
        h.go(1);
        expect(keyOf(placeOf(s))).toBe(seen[i]);
      }
    }),
    { numRuns: 300 },
  );
});

test('spec 25 L2: the first place is an entry after the start page', () => {
  const h = new FakeHistory(() => undefined);
  visit(h, { screen: 'form', openId: 't1' });
  expect(h.entries).toHaveLength(2);
  expect(h.entries[0]).toBeNull();
});

test('spec 26 M1: Forward from the start page to Triage or a certificate shows that screen', () => {
  const loaded = reducer(initialState, {
    type: 'session',
    session: session(IDS.map(tpl)),
    open: 't1',
    screen: 'triage',
  });
  const home = reducer(loaded, { type: 'home' });
  expect(home.openId).toBeUndefined();
  for (const place of [
    { screen: 'triage', openId: 't1' },
    { screen: 'certificate', openId: 't1', certificateId: 't2' },
  ] as const) {
    const s = reducer(home, { type: 'restore', place });
    expect(placeOf(s)).toEqual(place);
  }
});

describe('spec 27 R1: a form reached again shows its record', () => {
  const recs = ['r1', 'r2', 'r3'].map((recordId) => ({
    recordId,
    fileName: `${recordId}.xml`,
    match: { kind: 'exact', templateId: 't1' },
  }));
  const withRecords = { ...session(IDS.map(tpl)), records: recs } as unknown as SessionRes;
  const opened = (s: State) => reducer(s, { type: 'session', session: withRecords, open: 't1' });

  test('opened again from the start page: the first record, as the first time', () => {
    const first = opened(initialState);
    expect(first.recordIndex).toBe(1);
    const again = opened(reducer(first, { type: 'home' }));
    expect(again.recordIndex).toBe(1);
  });

  test('Back and Forward: the record the entry was left on; the first when it is gone', () => {
    const on3 = { ...opened(initialState), recordIndex: 3 };
    const entry = placeOf(on3);
    const home = reducer(on3, { type: 'home' });
    expect(reducer(home, { type: 'restore', place: entry }).recordIndex).toBe(3);
    const fewer = { ...home, records: home.records.slice(0, 1) };
    expect(reducer(fewer, { type: 'restore', place: entry }).recordIndex).toBe(1);
  });

  test('the record does not make a new entry', () => {
    const s = opened(initialState);
    expect(keyOf(placeOf({ ...s, recordIndex: 2 }))).toBe(keyOf(placeOf(s)));
  });
});
