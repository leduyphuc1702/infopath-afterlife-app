# Spec 16 verification (2026-11-11)

"Before" is the code at `1f2ac50` (the e2e on its build, core tests before the fix).

| Bug | Test | Before | After |
|---|---|---|---|
| K1 | e2e K1 | `scrollWidth` 438 > 390 | pass |
| K2 | core K2 (dossier, Rule Trace) | `buttonCaptions is not a function`; sentences named CTRL900 | pass |
| K3 | core K3 | Required `['Needs accounting approval']` | pass (`Name`, `Justification`) |
| K4 | core K4 | `conditionWords is not a function`; "a condition on Total incl. VAT is true" | pass; 48 of 48 conditions in words |
| K5 | e2e K5 | sections 2–6 `break-before: page` | pass; 4 A4 pages |
| K6 | core K6 examples | `04\-purchase\-request\.xsn` | pass; property 1,000 runs |
| K7, K8 | e2e K7, K8 | status line without "Saved …" | pass |
| K9, K10 | core K9, K10 | 5 of 8 connections "Not known"; "Manual:" in 2 | pass |
| K11 | core K11 | sentence held `f:main:/my:purchaseRequest/my:subtotal` | pass |
| K12 | e2e K12 | Tab went to the footer link | pass |
| K13 | core K13, e2e K13 | "because Subtotal changed"; no status sentence | pass |
| N1 | e2e N1 | first entry was a calculation | pass |
| N2 | e2e N2 | no "Exported" while filling | pass |
| N3 | e2e N3 | placeholders `display: block` in print | pass |
| D1 | core R4.3 | the notice twice | pass |

Spec 04 criteria proven by this spec's new tests: R4.3 (submit and close), R5.3, R5.4, R6.1,
R9.2. R5.3, R5.4 and R6.1 passed on the old build too: no defect behind them.
