# Spec 26 design

Root causes at `6977aaf`. Tests: `apps/web/test/history.test.ts` (M1, added),
`apps/web/e2e/bugfixes26.spec.ts` (M1, M2, F12), `packages/core/test/runtime/n1-noise.test.ts` (N1).

| Bug | Root cause | Fix |
|---|---|---|
| M1 | `apps/web/src/store.ts` `restore`: `openState` only for form, Documentation, Records | also whenever no form is open and the entry names one |
| M2 | `apps/web/src/App.tsx` `applySession` built the "already open" notice for every source | a `bundled` flag from `openSample` and `openAllSamples` drops it |
| N1 | `core/src/runtime/session.ts` (calculations) and `rules.ts` (assignment) wrote `Evaluator.string()` | `Evaluator.recordString()`: a finite number through `toPrecision(15)`, then XPath's number-to-string |
| F12 | `apps/web/src/records/Summary.tsx`: a fixed caption | the hint only while no group is chosen |

No reference file changes: no stored record or golden held the noise.

## Existing tests changed
None edited. Added: one test in `apps/web/test/history.test.ts`.
