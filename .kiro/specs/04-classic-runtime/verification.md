# Spec 04 verification

## Tasks 1–4: the runtime in core (2026-11-11, Node 22)

| Criterion | Oracle | Result |
|---|---|---|
| R3.1 functions | `test/runtime/evaluate.test.ts` | pass; 12 functions (below) |
| R3.2 not evaluated | same file: unknown function, unknown prefix, syntax error | pass |
| R3.3 user name `""`, `now` from the command | same file | pass |
| R3.4 GetDOM | same file: form 03 `Locations` read from the template; form 04 `Vendors` empty, one trace entry | pass |
| R1.1, R1.2, R1.4 | `test/runtime/cycle.test.ts`: empty form and record; onLoad on forms 01 (empty and record); 6 bad paths change nothing | pass |
| R2.1, R2.3 | same file: form 02 total, form 04 chain in rows in dependency order, form 03 field-change rule | pass |
| R2.2 | same file (an oscillating pair stops at 16 passes); P7 | pass |
| R11.1 P7 | `test/property/p7.property.test.ts`, 300 graphs ≤ 30 fields: 89 stopped by the cap, 47 acyclic | pass |
| R11.2 P18 | `test/property/p18.property.test.ts`, 100 runs over 395 cases (47 empty forms, 348 records) | pass |
| R11.3 calculation oracle | `test/runtime/calc-oracle.test.ts` | 133 of 139 stored values match; 6 generator rounding cases; 88 targets stored empty (below) |
| R2.4 budget (Node) | `test/perf/fill.perf.test.ts`, 50 timed cycles each | form 04 p50 2.47 ms, p95 5.03 ms; form 08 p50 17.86 ms, p95 21.18 ms |
| R5.1 validation | `test/runtime/validate.test.ts` (24): required, type, facets on form 47, errorCondition, trace, `xsi:nil` | pass |
| R11.4 validation oracle | `test/runtime/validate-oracle.test.ts` | 330 of 348 records valid; 18 invalid (below) |

**Functions implemented** (spec 03's render table, GetDOM replaced): `msxsl:node-set`,
`msxsl:string-compare`, `xdDate:Now`, `xdDate:Today`, `xdFormatting:formatString`,
`xdImage:getImageUrl`, `xdMath:Avg`, `xdMath:Eval`, `xdMath:Nz`, `xdUser:get-UserName`,
`xdXDocument:GetDOM`, `xdXDocument:GetNamedNodeProperty`, plus the XPath 1.0 core library.
Any other prefixed function (for example `xdDate:AddDays`, `xdMath:Max`) is "not evaluated" with
a trace entry. None of our 48 templates calls one.

**Number text.** A calculation writes XPath 1.0 `string()` of its double, as the `xpath`
package gives it (`630.1800000000001`). The view's own number formatting draws it. InfoPath's
text for such sums is **unverified**: our records were written by the sample generator, not
saved by InfoPath (E1).

### Calculation oracle: 227 calculated nodes in 95 records of 12 forms

- **133 of 139 stored values match.** Compared as numbers rounded to the stored value's places.
- **88 stored empty**: every record of forms 10, 17, 18, 24, 29, 30, 31, 35 and 40 has its
  calculated fields as `xsi:nil="true"` with no value. The generator did not compute them.
  The runtime fills them on open.
- **6 rounding differences, all form 04**, all in the generator's arithmetic. The form says
  `round(subtotal * vatRate * 100) div 100` on doubles; the generator rounded with Python's
  `round(x, 2)`:

| Record | Field | Stored | Runtime | Why |
|---|---|---|---|---|
| 004 | vatAmount | 629.12 | 629.13 | 6291.25 × 0.1 × 100 = 62912.5; XPath `round` rounds half up |
| 004 | grandTotal | 6920.37 | 6920.38 | follows vatAmount |
| 010 | vatAmount | 151.09 | 151.1 | 15109.5 rounds up in XPath; 151.095 is 151.09499… in binary for `round(x, 2)` |
| 010 | grandTotal | 1662.04 | 1662.05 | follows vatAmount |
| 018 | vatAmount | 37.11 | 37.1 | the double line total 5 × 74.21 is 371.04999999999995, so × 0.1 × 100 = 3710.4999… |
| 018 | grandTotal | 408.16 | 408.15 | follows vatAmount |

No mismatch is a runtime defect; `samples/` is unchanged.

### Validation oracle: 18 invalid records, 24 fields, all `errorCondition`s

The generator wrote values that break the form's own rules. `samples/own/README.md` does not
list them. The runtime is right in each case (values checked in the records):

| Form | Records | Fields | Message | Data |
|---|---|---|---|---|
| 10 timesheet | 001–005 | 7 | "Max 24" (`. > 24`) | `hoursWorked` 776.01, 487.85, … |
| 16 equipment loan | 004, 005 | 2 | "Before start" (`string-compare(., ../my:loanFrom) < 0`) | 004: from 2026-04-17, to 2025-09-07 |
| 17 vehicle log | 001, 002, 004 | 3 | "Lower than start" | 001: start 18, end 10 |
| 24 risk assessment | 001–005 | 8 | "1 to 5" | `likelihood` 6, 18, 9, 7 |
| 40 supplier scorecard | 001, 002, 005 | 4 | "1 to 10" | `scoreValue` 19, … |

No required, type or facet error appears in any record.

`pnpm check` (2026-11-11, after task 4): exit 0; core 3,778 passed (3 skipped), browser 337,
web 101. The perf test runs in the `perf` project (`pnpm --filter @afterlife/core test:perf`).

## Tasks 5–7: fill-in mode on the page (2026-11-11)

| Criterion | Oracle | Result |
|---|---|---|
| R1.3, R1.4, R1.5, R8.1 (Worker) | `apps/web/test/session.test.ts` › "spec 04 task 5" (2): fill form 02's empty form, total and render follow, download matches the template exactly; `FILL_PATH` for a calculated field, `FILL_STATE` without a session or for an unknown record | pass |
| R5.2, R5.3, R6.1–R6.3 | `apps/web/e2e/fill.spec.ts` › "form 02: type amounts…": the blank name is marked at once ("Cannot be blank", `aria-invalid`); Tab commits, Total shows `$12.50`, focus moved on, page did not scroll; Enter commits and keeps focus and caret ("Taxi" + " ride"); "Must be > 0" fires and clears; read-only Total and Receipt say why; X-ray outlines on hover | pass |
| R5.4, R8.1–R8.3, R11.5 | same file › "Download XML, drop it back": `02-expense-report-new.xml`, UTF-8 declaration then `mso-infoPathSolution`; dropped back it is record 31, matched, same values; local storage, session storage and IndexedDB empty; request guards on | pass |
| R6.4, D24 | same file › "leaving Fill with changes asks": `<dialog>` "Discard your changes?" on the switch and on the pager; Escape and "Keep filling" keep it; Back and Forward keep the session; print media shows the filled paper | pass |
| R1.5 | same file › "another version": the switch is `aria-disabled` and says why | pass |
| Review note: old records that break their rules | same file › "form 10": "Max 24" marked at once; "1 calculated field was empty in this record and has been worked out." in the status line; not an unsaved change | pass |
| R2.4 (Worker) | same file › "R2.4", 20 commits each, `ms` measured in the Worker from command in to render out; the 30 ms budget is asserted on form 04, form 08 is reported (E2) | spec alone: form 04 p50 2.80 ms, p95 8.30 ms; form 08 p50 17.20 ms, p95 20.90 ms. Full parallel `pnpm e2e:web`: form 04 p95 6.40 ms; form 08 p50 30.20 ms, p95 50.30 ms |

**Back and Forward:** the fill session is kept, not discarded. It belongs to one template and
record; leaving the form screen (Back, Forward, opening another form) keeps it in the Worker, and
coming back to that template and record shows Fill on with the values. The page asks before a
change would discard it: the Fill switch, the pager, turning Fill on for another form, and closing
the tab (the browser's own question).

**Number text** (decision taken in review): a calculation writes the `xpath` package's text
(`630.1800000000001`); the view's formatting draws it (`$630.18`). InfoPath's text for such sums
is unverified.

Bundle (`apps/web/test/budget.test.ts`, gzip): entry 72.8 → 76.3 KB of 100, Worker 133.7 → 139.7
KB of 160; no new chunk.

`pnpm check` (after task 7): exit 0; hooks 5, core 3,778 passed (3 skipped), browser 337, web 105.
`pnpm e2e:web`: 63 passed.

## Tasks 8–9: rows and optional sections (2026-11-11)

| Criterion | Oracle | Result |
|---|---|---|
| Task 8, D18 (spec 02 changed) | `packages/core/test/ir/golden.samples.test.ts`: `IrGroup.insert` on 21 groups in 17 forms (18 `xCollection`, 1 `xOptional`, 2 `xReplace`) | 17 FormIR goldens changed, +396 lines, additions only (the `insert` object); the Worker parity test reads the same files |
| Task 8, D20 (spec 03 changed) | `packages/core/test/render/golden.samples.test.ts` | 34 render goldens changed (17 forms × empty and first record): `rows` added (34 `row`, 1 `optional`, 38 `insert`); the HTML differs only by `data-afl-structure`, `data-afl-group`, `data-afl-node` on those elements, checked by a script that strips the three attributes and compares with `HEAD` |
| Triage, death certificate, X-ray, converter inputs unchanged | Triage goldens (`test/golden/triage`), coverage tests, web X-ray e2e | no file changed; all pass |
| R7.1–R7.3, D19 | `packages/core/test/runtime/structure.test.ts` (5): Insert item appends the manifest fragment, Total follows, remove restores the XML; insert above and below; focus paths; all rows removed then one inserted; form 05 Relocation inserts and removes; wrong targets are `FILL_PATH` | pass |
| R7.4, P3 | `packages/core/test/property/p3.property.test.ts`: 48 cases (16 forms with `xCollection`, empty form and 2 records each), up to 20 inserts per run at generated positions (append, above, below), removed in reverse | 200 runs, 858 rows inserted, XML equal to the start every run |
| R7.1–R7.3 on the page | `apps/web/e2e/fill.spec.ts` › "form 02: Insert item, the row menu by keyboard…": Insert item, focus in the new row's first control; the row menu by keyboard ("Insert a row below row 2 of Expenses"); remove gives focus to the row that took its place; Total $30.00 → $42.00 → $12.00 → $0.00; after the last row, focus on Insert item; a row change asks before Fill turns off | pass |
| R7.3 on the page | same file › "form 05: the optional Relocation section": "Insert Relocation" by Enter, focus in the section, "Remove Relocation" from its menu, focus back on the placeholder | pass |

No group stays read-only for a reason in our forms: every `xCollection` item has `minOccurs="0"`,
so "the last row cannot be removed" (`FILL_PATH lastRow`) never applies to them. Form 05's two
`xReplace` groups (Full time, Contractor) are recorded in FormIR but not editable: R7 covers
`xCollection` and `xOptional` only.

Bundle (gzip): entry 76.3 → 78.0 KB of 100, Worker 139.7 → 142.0 KB of 160; no new chunk.
`pnpm check` (after task 9): exit 0; hooks 6, core 3,784 passed (3 skipped), browser 337, web 105.
`pnpm e2e:web`: 65 passed.
