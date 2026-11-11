# Spec 25 design

Root causes at `f87164f`. Tests: `packages/core/test/xpath-fns/format.test.ts` (7 new, G1),
`apps/web/test/history.test.ts` (L2), `apps/web/e2e/bugfixes25.spec.ts` (L1 ×2, L2, L3).

| Bug | Root cause | Fix |
|---|---|---|
| G1 | `core/src/xpath-fns/format.ts` `grouped()`: `opts.get('grouping') ?? '0'` ("Absent means none", an assumption); currency had its own fixed `CURRENCY_GROUPING` | absent and `-1` give `LOCALE_GROUPING` (3); currency uses `grouped()` too, so an explicit `grouping:0` is honoured there; comment says what is seen and what is from the specification |
| G2 | the samples changed (by the owner) | `pnpm gen:xsltproc-refs` and `vitest -u` on the three snapshot files, once, then the diff read |
| L1 | `apps/web/src/App.tsx`: the `beforeunload` listener existed only while `dirty` | always listening in Fill; asks when `dirty` or `uncommitted()` (spec 23) |
| L2 | `apps/web/src/shell/history.ts` `visit()`: no current place → `replaceState` | always `pushState`; the page's own entry (no place) is the start page, which `popstate` already handles, with the question |
| L3 | `apps/web/src/paper/fill.ts` `commit()` normalised dates only | `numberValue()` drops en-US grouping commas (and a leading `$` in a currency box) when the result is a plain decimal |

Shown numbers change wherever core formats them: the paper, a Fill box after it loses focus, the
kept web pages and Documentation's renders. The record, CSV and Excel hold raw values.

## Existing tests changed
- `core/test/xpath-fns/format.test.ts`: "grouping absent: none", "number 0, not grouped",
  "number 2, not grouped" and "number auto" asserted the G1 defect; they now expect groups of 3.
- The 70 reference tests (G2): regenerated, not edited by hand.
