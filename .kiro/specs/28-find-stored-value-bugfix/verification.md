# Spec 28 verification (2026-11-11)

| Test | Before (`acd2394` sources) | After |
|---|---|---|
| unit "spec 28 R1" | fails: `1423.94` finds 0, expected 1 | pass |
| e2e `bugfixes28.spec.ts` | fails: `1423.94` gives 0 rows, expected 1 | pass |

After the fix, on sample 04: `$1,423.94`, `1,423.94`, `1423.94`, `1423`, `5/13/2026` and
`2026-05-13` each find 1 record in the unit test; `true` finds none.
