# Spec 26 verification (2026-11-11)

Each test was run on the unfixed code first.

| Bug | Before | After |
|---|---|---|
| M1 | unit: `screen` not restored; e2e: Triage not shown after Forward | pass |
| M2 | status line contains "already open" | pass |
| N1 | `recordString is not a function`; 4 records got noisy values at opening | pass |
| F12 | caption still holds "Choose a group" | pass |

N1 over the 348 own records (`n1-noise.test.ts`):

| | Before | After |
|---|---|---|
| Records changed by opening | 47 | 47 |
| … whose opening writes held float noise | 4 | 0 |
| … that differed only by noise | 0 | 0 |
| Calculated values equal to the stored ones | 135 of 139 | 135 of 139 |

The 4 left are form 04's records `-004` and `-010`, a cent apart (see bugfix.md). Spec 15's 133
was before spec 19's comparison at stored precision.
