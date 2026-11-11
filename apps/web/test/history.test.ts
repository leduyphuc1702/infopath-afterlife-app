import type { FormIR, TriageResult } from '@afterlife/core';
import fc from 'fast-check';
import { expect, test } from 'vitest';
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
