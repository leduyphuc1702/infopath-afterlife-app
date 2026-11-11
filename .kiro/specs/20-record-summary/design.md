# Spec 20 design

## Core: `packages/core/src/legacy/summary.ts`
- `recordList` (spec 17) gains `parts`: one per top-level repeating group, its `label`
  ("Expense"), `columns` (shown values, kinds and number formats as for the record's columns)
  and `rows` (`record`: the list row it belongs to, `cells`, `keys`). `ListColumn` gains
  `format?` (the view's `xd:datafmt`) for number columns.
- `summaryColumns(list, unit)`: the record's columns, then the part's when `unit ≥ 0`.
- `summarize(list, query, found)`: `query = { unit, by, dates?, total?, sort }`, `found` the
  list rows to count. Each unit is a found record, or a row of part `unit` whose record is found.
  - Group key: date → `YYYY` or `YYYY-MM` from the ISO key ("March 2025"); otherwise the shown
    value; "" → "No value". More than `MAX_GROUPS` (50) keys → `tooMany`, no lines.
  - Sums are exact: each number key becomes a scaled `bigint` (its shortest decimal text), so a
    sum is the same in any order and the group sums add up to the total. Values that are not
    numbers count as units but not in the sum or the average.
  - Shown with `formatString` and the column's format; without one, the decimal text. The
    average is rounded to the values' decimals plus two.
  - Lines are sorted by the chosen column, ties by the group key; `records` (list row indexes,
    ascending) per line; `bar` = |sum| or count over the largest.
  - `csv`: `sheetCsv` of the lines in that order and the "All" line; numbers as numbers.
- P22 in `test/property/p22.property.test.ts` over generated lists (no XML: `summarize` is pure).

## Worker
- `session.recordList` keeps the core list; the page's `RecordListRes` gains `parts` as
  `{ label, columns }` only (no rows).
- New request `summary { templateId, query, recordIds }` → `SummaryRes` (lines, all, labels,
  `tooMany`, `csv`, `ms`). Queued like every request; the list is the cached one.

## Page: `apps/web/src/records/Summary.tsx` (in the entry: +0.9 KB; a chunk of its own would
need the budget test's "no other chunks" rule changed)
- A "Summarize" toggle button in the tools; the panel sits between the tools and the list.
- Selects: Count, Group by, By (dates only), Total of (number columns; "Nothing, count only").
  Defaults: count records, group by the first choice column (else the first text column after
  the file name), no total, sorted by group ascending.
- Asked again (debounced 150 ms) when Find's results, a choice or the sort change; the last
  answer wins (request number).
- Table: caption says what is counted; `th scope="row"` holds a button per group; header buttons
  sort; bars are `span[aria-hidden]` with a width in %, colour `var(--ds-…)`.
- Choosing a line: `Records` keeps `pick = { label, ids }`; shown rows = found ∩ ids; the status
  line says "4 of 30 records match Find and Department: Sales." with "Show every group".
- "Download CSV" saves `csv` through the page's `save()` helper, `<form-name>-summary.csv`.

## Defaults taken (cheapest to change)
- 50 groups at most; "No value" for empty; group order ascending by default.
- Month labels in English ("March 2025"), as the rest of the copy.
- A group line filters records, also when rows are counted (a record with any row in the group).
- CSV in the on-screen order with raw numbers (as the export writes them), not formatted text.
