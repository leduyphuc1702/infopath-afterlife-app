# Spec 20 verification (2026-11-11)

| Req | Test | Result |
|---|---|---|
| 1, 4, 6, 7 | e2e "Total by Department on form 02"; core `summary.test.ts` | pass: All 30, $24,440.53, $814.68; sort by sum gives `aria-sort="descending"` |
| 2, 3 | core "dates by year and month; more than 50 values"; e2e "dates by month" | pass: 51 values → `tooMany`, 50 → 50 lines |
| 5, 6 | core and e2e "Amount by Expense type" | pass: "99 Expense rows in 30 records"; All $24,440.53 |
| 8 | e2e: Lodging → "15 of 30 records match Type: Lodging.", with Find → "… Find and Type: Lodging." | pass (15 matches the reviewer's Find "lodging") |
| 9 | e2e CSV: header, first line in the order shown; core formula guard `'=HYPERLINK` | pass |
| 10 | e2e, 5,000 generated records: choice to table shown 192 ms (150 ms of it the wait after a choice), Worker 13 ms; Find typed 10 ms after the choice | pass |
| 11 | e2e: `<img src=x onerror=…>` as a group label is text; no `img` in the summary | pass |
| 12 | `test/property/p22.property.test.ts`, 200 runs | pass |

Final runs: `pnpm check` exit 0 (hooks 6, core 3,840 passed and 3 skipped, browser 337, web 116);
`pnpm e2e:web` 113 passed. Bundle: entry 87.5 of 100 KB, Worker 155.7 of 160 KB.
