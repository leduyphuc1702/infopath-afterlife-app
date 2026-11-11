# Spec 14 verification

Each regression test was run on the code before its fix (the fixes stashed), then after.
E2e: `apps/web/e2e/fill-bugfixes.spec.ts`. 2026-11-11.

| Bug | Test | Before the fix | After |
|---|---|---|---|
| B1 | e2e B1 | `toEqual`: "Insert below" and "Remove" are not the element at their own centre | pass |
| B2 | e2e B2 | 2 overlaps: "Actions for row 1 of Expenses covers SPAN "receipt-01-1.txt"", and row 2 | pass |
| B3 | e2e B3 | Views and records toolbar takes 2 rows at 1280 px; no "Fill" toolbar | pass (1 row at 1280, ≤ 3 at 390; Fill toolbar 1 row) |
| B4 | core `open-calculations.test.ts` | 2 of 4 fail: form 04 record 1 has 2 calc entries and a rewritten XML; form 02 Total becomes 350.3 | 4 pass |
| B4 | e2e B4 | `.afl-trace-empty` not found | pass |
| B5 | e2e B5 | status line has no "ran only in part" sentence | pass |
| B6 | e2e B6 | focus `undefined` (page body) after Undo | pass (Qty after Undo and after Redo) |
| B7 | e2e B7 | entries wider than the side panel | pass |
| B8 | web `trace-words.test.ts` › B8 | sentences hold `GetDOM("BudgetService")` and `xdXDocument:…` | pass |
| B9 | e2e B9 | Fill stays on: the discard question opens | pass |
| B10 | e2e B10 | body "You changed this form…" | pass ("You changed Expense Report (the empty form)…") |
| B11 | e2e B11 | focus `undefined` after the Manager button | pass (Full name of the new view) |
| B12 | e2e B12 | `.afl-form-name` not focused | pass |

Edited existing tests (they asserted a defect; see design.md): `calc-oracle.test.ts` (record
018 now agrees, 133 → 135 matches), `structure.test.ts` (Total compared as a number),
`rules.spec.ts` (focus after Undo on the field, not the button).
