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
