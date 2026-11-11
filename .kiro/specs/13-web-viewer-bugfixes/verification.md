# Spec 13: verification

Run on 2026-11-11. "Before" is each regression test on the unfixed code (`057927c` plus the new
tests only); "after" is the same test with the fix.

| Bug | Test | Before the fix | After |
|---|---|---|---|
| B1 | e2e "B1: the form screen prints the paper…" | `[data-afl-paper]`: expected visible, received hidden | pass |
| B1 | e2e "B1: the certificate screen prints the certificate" | heading "Death certificate: …": element(s) not found | pass |
| B2 | e2e "B2: Back and Forward…" | after `goBack()`, the certificate region: element(s) not found (the page had left the app) | pass |
| B2 | P13 `test/history.test.ts` | cannot find module `../src/shell/history` (nothing records history) | pass, 300 runs |
| B3 | `test/session.test.ts`, template twice | expected 1 template, received 2 | pass |
| B3 | `test/session.test.ts`, record under another name | expected 1 record, received 2 | pass |
| B3 | P12 `test/session.test.ts` | property failed after 1 test: the answer has no `duplicates` | pass, 25 runs |
| B3 | e2e "B3: the same template opened twice…" | expected "02-expense-report.xsn is already open", received "" | pass |
| B4 | `test/store.test.ts`, template with records | expected `recordIndex` 1, received 0 | pass |
| B4 | `test/store.test.ts`, record dropped later | expected `recordIndex` 2, received 0 | pass |
| B4 | e2e "B4: a template with its records…" | "Record 1 of 3, 02-expense-report-001.xml": element(s) not found | pass |
| B5 | e2e "B5: Escape closes an open menu…" | menu still has `open=""` after Escape | pass |
| B6 | e2e "B6: focus moves to the new screen…" | `#afl-cert-h`: expected focused, received inactive | pass |
| B7 | e2e "B7: the title names the screen first" | expected "Triage: 48 forms · InfoPath Afterlife", received the landing title | pass |
| B8 | e2e "B8: at 390 px the Triage table scrolls…" | `tabindex`: expected "0", received null | pass |
| B9 | e2e "B9: at 390 px no header button label wraps…" | lines per label: "Open files: 2", "Try a sample: 2", "X-ray: 2" | pass |
| B10 | e2e "B10: files not opened are announced…" | `[data-afl-announce]`: element(s) not found | pass |
| B11 | e2e "B11: at 390 px every open menu…" | "Try a sample": left edge expected 0, received −11 | pass (1280 px passed before and after) |

The first B11 test opened two templates, whose header has a "Triage" button that moves "Try a
sample" right; it passed on the unfixed code. It was rewritten to follow the report (one sample,
form screen) before the fix.

The first B9 test compared button heights and passed on the unfixed code (every label wrapped, so
all heights matched). It was rewritten to count the text lines of each label before any fix.

## Whole suite, after the fixes

- `pnpm check`: green. Core 3,697 passed (3 skipped), browser 337, web 96 (89 + 7 new).
- `pnpm e2e:web`: 49 passed (38 + 11 new).

B11 after the fix, in the full suites of spec 09 phase B: `pnpm e2e:web` 56 passed.
