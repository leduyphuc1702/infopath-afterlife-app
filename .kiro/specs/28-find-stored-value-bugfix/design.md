# Spec 28 design

Root cause at `acd2394`: `searchText` in `apps/web/src/records/find.ts` joins the shown cells and
the repeating-row values only. The value a number or date column stores is already in the row,
as its sort key (`ListKey`: the number, or the ISO date), but Find never read it.

Fix: `searchText` and `whereFound` take the column kinds; for `number` and `date` columns
(currency and percentage are `number`) they add `String(key)` to the text searched.
`Records.tsx` passes `list.columns`' kinds. The skipped Failed checks column stays skipped.

Tests:
- `apps/web/test/records-find.test.ts`: added "spec 28 R1", the reviewer's table plus `true`
  against a ticked box; P20 edited (below).
- `apps/web/e2e/bugfixes28.spec.ts` (new): `1423.94` and `2026-05-13` each find one record.

## Existing tests changed
`records-find.test.ts` P20: its expected set asserted the defect (shown values only). It now
passes the sort column's kind and expects a match in that column's stored value too.

## Round 2 (R2, R3), root cause at `cffc527`
`stored()` in `apps/web/src/records/find.ts` used the sort key, which core's list makes with
`Number(text)` (`packages/core/src/legacy/list.ts`, `shown`); `more` holds shown text only.

Fix: core's `ListRow` gains `stored` (each number and date column's text as the record holds it)
and `moreStored` (beside each `more` entry, "Label: stored text" for a number or date, else
`''`). `searchText` and `whereFound` read them instead of the keys and column kinds; the kinds
parameter is gone. `whereFound` returns the `more` entry whose shown or stored text matched.

Tests: `records-find.test.ts` gains "spec 28 R2, R3"; "spec 28 R1" and P20 now give `stored`
rows instead of column kinds (the parameter went, the expectation did not change);
`packages/core/test/legacy/list.test.ts` gains "spec 28 R2, R3"; `bugfixes28.spec.ts` gains
`2978.30` and `1334.60`.
