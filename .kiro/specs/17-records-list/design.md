# Spec 17 design

1. **Core, `legacy/list.ts`: `recordList(t, ir, records, now)`.** Columns are the Records
   sheet of `recordTables` (so the screen and the export never disagree), headed by the field's
   label; then one count column per sheet whose rows have no parent row. Formats: `viewFormats(t)`
   reads `xd:binding` and `xd:datafmt` from each view's XSL (as `buttonCaptions` does), keyed by
   the binding's last step; the first format seen wins. Values go through `formatString`; sort
   keys are the number, the ISO date text, or the text; empty is `null`. Failed checks:
   `FillSession.open(…).opened.invalid.length`, the same number Fill shows; a record the
   runtime cannot open gets an empty cell. Booleans show "Yes" and "No".
2. **Worker:** `recordList(templateId)` answers `RecordListRes { columns, rows }`, each row
   `{ recordId, cells, keys }`; it keeps the answer until the records change.
3. **Page, `records/find.ts` (pure):** `findRows(rows, query, sort)` gives the shown row indices:
   a row matches when its lower-cased cells joined by U+0000 contain the lower-cased query;
   order is by the sort column's key, `Intl.Collator` (numeric) for text, empty last, ties by
   input order (file-name order). Each row's joined text is made once per list.
4. **Page, `records/Records.tsx`:** `h2` heading, Find box, live count, then a scroll box
   holding a `<table>` with `aria-rowcount`. Fixed row height (2.25rem); only rows within
   one screen above and below are drawn, between two spacer rows, each with `aria-rowindex`.
   The query goes through `useDeferredValue`, so typing never waits for the table. Sort headers
   are `<button>`s in `<th aria-sort>`. The file name cell is a button; a row click opens too.
   Values are React text children only.
5. **State:** the screen's Find text, sort and scroll top live in `App` (the screen unmounts on
   the form screen); `store` gains screen `records` and `walk: { templateId, order, found }`,
   set when a row opens, cleared when another form opens. `PaperToolbar` walks `order` when the
   shown record is in it: "Record 3 of 12 found, <file>" (found = Find text not empty), else
   "Record 3 of 30, <file>".
6. **Reaching it:** "Records" button after Next in the form toolbar; history key
   `records:<id>`; Back on the form screen is browser Back, as for the dossier.

## Property

- **P20** (`apps/web/test/records-find.test.ts`): for any rows, Find text and sort column and
  direction, `findRows` gives exactly the rows whose shown values contain the text, ordered by
  the column's value (empty last, ties in input order); and walking Next from the first shown
  record, then Previous from the last, visits them in that order and back.

## Defaults taken (cheap to change)

- Find matches substrings, not words or dates by value; Failed checks is not searched.
- Count columns are headed "<label> (rows)". Attachments show the export's file path.
- The walk ends when another form opens; new records arriving join the list on its next visit.
- Columns are not hidden or resized; a wide form scrolls sideways inside the table box.
