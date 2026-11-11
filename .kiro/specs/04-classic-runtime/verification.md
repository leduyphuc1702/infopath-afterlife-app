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
