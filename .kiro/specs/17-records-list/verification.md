# Spec 17 verification (2026-11-11)

| Criteria | Test | Result |
|---|---|---|
| R2, R3, R4, R12 (core) | `packages/core/test/legacy/list.test.ts`: form 02 columns equal the Records sheet; currency and dates formatted as the view; failed checks on form 10; every form with records gives text cells | pass |
| R5, R7, R10, P20 | `apps/web/test/records-find.test.ts`, 200 runs | pass |
| R1, R5–R10 | `e2e/records.spec.ts` › R1–R10 (form 02: find "gbp", sort Total by Enter and Space, open by Enter and by click, walk, Back restores Find, sort and focus) | pass |
| R4 | `e2e/records.spec.ts` › R4: the count equals Fill's attention line on form 10 record 1 | pass |
| R11, R12 | `e2e/records.spec.ts` › R11, R12: 5,000 generated form 02 records; a value `<b>Bold</b>` stays text | pass |

## R11 measures (Chromium, built app, `pnpm e2e:web`; wall time from the action to the rows)

| | First rows | Find | Sort |
|---|---|---|---|
| Form 02, 30 records | 252 ms | 64 ms | 43 ms |
| 5,000 generated records | 2,495 ms | 10 ms | 34 ms |

With 5,000 records, 32 rows are drawn. Three keys typed into Find took 5 ms. Most of the first
rows' time is the Worker opening each record in the runtime for Failed checks (R4). A separate
run gave 166 ms and 1,330 ms for the first rows, so these times vary by about 2x between runs.

Looked at 1280 and 390 px through MCP: the Find label was centred over its box, so it is now
left-aligned. At 390 px the file name column scrolled away, so it now stays in place while the
other columns scroll sideways. The page does not scroll sideways (`scrollWidth` 390).
