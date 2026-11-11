# Spec 25 verification (2026-11-11)

Each test was run on the unfixed code first.

| Bug | Before | After |
|---|---|---|
| G1 | 6 of 7 new tests fail (`1472.13` for `1,472.13`); `grouping:0` passes, it guards | pass |
| G2 | 70 failed in 4 files | pass; 71 reference files changed (13 package, 13 FormIR, 22 render, 23 xsltproc); 66 `grouping:1;` items gone, none left; column shifts of 22 and 44 only; 14 number texts changed (`7,7,6.01` → `776.01` and the like), the four already grouped by 3 (`$1,423.94`…) unchanged; the generated-date line |
| L1 typing | the browser did not ask | asks |
| L1 nothing typed | asks nothing (guard) | asks nothing |
| L2 | unit: 1 entry, not 2; e2e: start page not shown after Back | pass |
| L3 | record `<my:quantity>1,200</my:quantity>` | `1200` |
