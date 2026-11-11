# Spec 28 verification (2026-11-11)

| Test | Before (`acd2394` sources) | After |
|---|---|---|
| unit "spec 28 R1" | fails: `1423.94` finds 0, expected 1 | pass |
| e2e `bugfixes28.spec.ts` | fails: `1423.94` gives 0 rows, expected 1 | pass |

After the fix, on sample 04: `$1,423.94`, `1,423.94`, `1423.94`, `1423`, `5/13/2026` and
`2026-05-13` each find 1 record in the unit test; `true` finds none.

## Round 2 (R2, R3)

| Test | Before (`cffc527` sources) | After |
|---|---|---|
| web unit "spec 28 R2, R3" | fails | pass |
| web unit "spec 28 R1" | fails (it now gives `stored`, which `cffc527` does not read) | pass |
| core "spec 28 R2, R3" in `list.test.ts` | fails (`stored` missing) | pass |
| e2e `bugfixes28.spec.ts` | fails: 0 rows, expected 1 | pass |

After the fix on sample 04: `2978.30`, `2978.3`, `1334.60` and `1,334.60` each find 1 record;
the "found in" line for `1334.60` reads `Line total: $1,334.60`.
