# Spec 09: standalone web viewer, phase A — requirements

Brief: `docs/spec-briefs/09-web-viewer.md`. Status: **approved, 2026-11-11** (drafts committed as `4c13ec8`).

Changed at review (2026-11-11): `connect-src 'none'` instead of brief AC5's `'self'` (R8.2);
open questions answered (end of file).

## Introduction

Phase A ships `apps/web`, a static site that is the product's public app URL (Kiroween). Anyone
drops `.xsn` templates and `.xml` records, or presses "Try a sample", and gets the form drawn as
InfoPath drew it, its field tree, an X-ray between paper and tree, and the list of its data
connections with what dies after migration. Everything runs in the browser; nothing is uploaded.

It uses core as it is after specs 01–03 (`parseXsn`, `buildFormIR`, `prepareView`,
`renderView`) plus one small addition, `matchRecord` (R2, R11).

**Later** (not in phase A; brief numbering, owning spec):

| Brief item | What | Owner |
|---|---|---|
| AC1 | rules in plain English (phase A shows expressions as written) | spec 09 phase B, with the Rovo agent's explainer |
| AC1 | the coverage summary | spec 09 phase B, after spec 05 (converter) |
| AC1, AC2 | Triage table, death certificate card, "Export plan" (phase A: a simple template list) | spec 12 |
| AC4 | CSV/XLSX export, attachments in a `.zip` | spec 09 phase B |
| AC7 | Classic fill with Rule Trace, filled XML download | spec 09 phase B, after spec 04 (runtime) |
| AC8 | "Bring this form into Jira Service Management" call to action | spec 09 phase B, when an install URL exists |
| AC10 | 1,000-record export timing | spec 09 phase B, with AC4 |

## Glossary

- **Paper:** the area that shows one view of one template with one record, as core renders it.
- **Empty form:** the template's own `initialXmlDocument` (`template.xml`), shown before any record.
- **Record:** a filled `.xml` file. Its `<?mso-infoPathSolution?>` processing instruction names the
  template URN (`name`) and version (`solutionVersion`).
- **Matched record:** a record whose URN is the URN of an open template.
- **Control:** a rendered element carrying `data-afl-ctrl` (spec 03 design §9), with its mark.
- **X-ray:** the mode that links controls on the paper with fields in the tree, both ways.
- **Data connection:** a FormIR `IrConnection` (InfoPath's word; shown as "Data connection").
- **Ready:** the page has loaded, the Worker has started, and the samples and Latin font faces are
  in memory (`<html data-ready>`).
- **Three-part message:** what happened, why, and what to do (ux-principles.md 5).
- **Hostile template:** a `.xsn` built from spec 03's P5 generator (`p5-inputs.ts`).

## Requirements

### R1. Open files

Traces: brief AC1, AC3 (input); Added: human decision 1 (phase A list instead of Triage).

As Mai, I want to drop a folder of templates and records, so that I see what I have without
installing anything.

- **R1.1** WHEN the user drops files or folders on the page, or chooses files, THE SYSTEM SHALL
  read every `.xsn` and `.xml` file (extension in any case, folders walked recursively), open them
  in the Worker, and list every other file as ignored with the reason. Oracle: `e2e/open.spec.ts`
  drops form 02's `.xsn`, three of its records and a `.txt`: one template, three records, one
  ignored file.
- **R1.2** IF a file exceeds core's input limit (`inputBytes` 20 MiB for `.xsn`, `xmlBytes` 4 MiB
  for `.xml`), or more than 1,000 files arrive at once, or core throws an `AfterlifeError`, THEN THE
  SYSTEM SHALL show a three-part message naming the file and keep every other file open. Oracle:
  `test/messages.test.ts` (every core `ERROR_CODES` entry and every app code has three non-empty
  parts); `e2e/open.spec.ts` drops a truncated copy of form 02 with form 03: one message, form 03
  open.
- `Changed in spec 12 (2026-11-11):` with two or more templates open, the Triage table (spec 12
  R4.1) replaces the template list below; its Records column keeps R1.3's oracle counts.
- **R1.3** WHILE more than one template is open, THE SYSTEM SHALL list them (form name, file name,
  version, number of views, number of matched records) and show one at a time. Oracle:
  `e2e/open.spec.ts` drops forms 01 and 07 with all their records: two rows, 30 and 10 records.

### R2. Match records to templates

Traces: brief AC3; Added: human decision 2.

As the auditor, I want each old record opened with the template that made it, so that I read it
as it was filled in.

- **R2.1** WHEN records are open, THE SYSTEM SHALL match each one with core's `matchRecord` by the
  `mso-infoPathSolution` `name` and `solutionVersion`: same URN and version first; else same URN
  and another version, labelled "Made with version X"; else unmatched. Oracle:
  `packages/core/test/xsn/match.test.ts` on forms 01 and 07, which share one URN with versions
  `1.0.0.1` and `1.0.0.2` (checked 2026-11-11 in all 31 and 11 record files): with both templates,
  01's 30 records go to 01 and 07's 10 to 07; with 07 alone, 01's 30 match 07 as another version.
- **R2.2** WHEN a record matches no open template, THE SYSTEM SHALL list it under "Records not
  matched" with its reason: no `mso-infoPathSolution` instruction, or no open template with its
  URN (the URN shown). Oracle: `match.test.ts`; `e2e/open.spec.ts` drops 01's records alone and a
  plain XML file.

### R3. Paper

Traces: brief AC1 (rendered view, view selector), AC3 (paging); Added: human decisions 2 and 7.

As Hung, I want to see the form "like paper", so that I trust what I read.

- **R3.1** WHEN a template opens, THE SYSTEM SHALL render its default view with the empty form in
  a Web Worker and show it on the paper, with a view selector listing every view by caption;
  choosing a view re-renders it with the same record. Oracle: `test/protocol.browser.test.ts` (the
  Worker's result for form 02 equals `renderView` on the test page with the same `now`);
  `e2e/paper.spec.ts` on samples 05 (3 views) and 03 (2 views).
- **R3.2** THE SYSTEM SHALL page through the empty form first, then each matched record in file
  name order, showing the record's file name and the version that made it, with Previous and Next
  buttons. Oracle: `e2e/paper.spec.ts` on sample 02: "Empty form", then "Record 1 of 30,
  02-expense-report-001.xml".
- **R3.3** THE SYSTEM SHALL draw the paper with the form's own styling only: a white page in a
  shadow root, Calibri mapped to Carlito through the `@font-face` rules shared with core's visual
  test, and no page style or colour scheme reaching it. Oracle: `e2e/paper.spec.ts`: form 02's
  first record matches core's baseline `02-expense-report-Claim-first` at core's threshold (macOS
  Chromium only, as in core); the computed style of every paper element is identical in light and
  dark colour schemes.

### R4. Field tree

Traces: brief AC1 (field tree); Added: human decision 3.

As Tim, I want to see every field my form holds, so that I know nothing was lost.

- **R4.1** THE SYSTEM SHALL show the FormIR field tree: the main data source, then each secondary
  data source; groups, repeating groups marked "Repeating", and fields with their label, type and
  required flag. Oracle: `test/tree.test.ts`: node counts equal FormIR's for forms 01–08 and
  weight-keeper (form 02: 12 fields, 4 groups, 1 repeating; form 08: 200 fields).
- **R4.2** `Changed at review (2026-11-11):` "Required" follows the asterisk's rule (spec 03
  §9.2), which is what an InfoPath user calls required: FormIR `required`, or a blank-check
  validation on the field; the details card's "Required" line follows the same rule, and
  "Validated" means a validation other than the blank check. THE SYSTEM SHALL mark a field
  "Required" by that rule, "Rule" when a rule reads or writes it, "Calculated" when a
  calculation targets it, "Validated" when such a validation matches it, and "From data connection"
  when a control bound to it takes its choices from a connection or a connection uses an element
  that writes it. Oracle: `test/markers.test.ts` on forms 01–04 against counts taken from FormIR
  (form 01: Employee name, Employee ID, First day of leave and Last day of leave are Required;
  form 02: `my:totalAmount` is the one calculated field; form 04: both rule assignments read
  `BudgetService`).

### R5. X-ray

Traces: Added: human decision 4; PLAN pains N2 and N7.

As Tim, I want to point at a box and see what it is bound to and which rules touch it, so that the
knowledge in the form does not leave with its author.

- **R5.1** WHILE X-ray is on, WHEN the pointer is over the paper, THE SYSTEM SHALL outline the
  innermost control under it, select its field in the tree and show the details card: path, type,
  required flag, each rule, calculation and validation in the field's `readBy` and `writtenBy`
  with its expression as written, and the data connections it uses. Oracle: `test/card.test.ts`
  on form 04; `e2e/xray.spec.ts` on sample 02 (pointing at the total shows its calculation).
- **R5.2** WHEN the user selects a field in the tree while X-ray is on, THE SYSTEM SHALL outline
  every rendered control bound to it, one per repeating row, and scroll the first into view.
  Oracle: `e2e/xray.spec.ts`: form 02's first record, expense amount → 2 outlines (2 rows in
  `02-expense-report-001.xml`).
- **R5.3** THE SYSTEM SHALL hit-test and draw outlines from the boxes of the `[data-afl-ctrl]`
  elements (the paper root is `inert`), recomputed after each render, resize and font load, and
  each outline SHALL stay within 1 px of its control after the paper scrolls. Oracle:
  `test/geometry.browser.test.ts` on form 08 (242 controls).

### R6. Data connections

Traces: brief AC1 (data lineage, dead and internal connections); Added: human decision 5; PLAN
pain N11.

As Mai, I want to see which connections die when SharePoint goes, so that I plan the move.

- **R6.1** THE SYSTEM SHALL list every data connection with its name, kind in plain words, query or
  submit, its targets as FormIR redacted them, a status ("Works offline" when every endpoint is a
  package file, else "Dead after migration" with the reason), and the fields and controls that use
  it, each selectable. Oracle: `test/connections.test.ts`: form 03, one file connection
  (`locations.xml`) that works offline; form 04, SQL (`sql-legacy01`) and web service
  (`forms-legacy`), both dead, internal host; forms 01, 02, 07, one email submit, dead; forms 05,
  06, 08, "This form has no data connections".

### R7. Samples and notices

Traces: brief AC6; Added: human decisions 6 and 7.

As a judge with no `.xsn` at hand, I want one button that shows the product working.

- **R7.1** THE SYSTEM SHALL offer "Try a sample" for forms 01–08 with their 153 records and
  theill's weight-keeper, copied from `samples/` at build time; the `-000-empty.xml` files and
  everything else under `samples/` stay out of `dist`. Oracle: `test/samples.test.ts` after a
  build: 9 templates and 153 records, names and bytes equal to the sources; no other sample file.
- **R7.2** THE SYSTEM SHALL ship a notices page with every licence that applies: MIT for the app
  and `samples/own`, Peter Theill's MIT notice for weight-keeper, SIL OFL 1.1 for Carlito with its
  licence text, and the licence of every package in the built bundles. Oracle:
  `test/notices.test.ts`: every package in the build's module list appears in the notices.

### R8. Trust

Traces: brief AC5; Added: human decision 8.

As Quang, I want proof that no form data leaves the machine, so that I can let staff use it.

- **R8.1** THE SYSTEM SHALL make no request to another origin and include no analytics, and WHEN
  the network goes offline after the page is ready, opening a sample, paging, switching views and
  dropping a file SHALL still work. Oracle: every e2e test fails on a non-same-origin request;
  `e2e/offline.spec.ts`.
- **R8.2** `Changed at review:` `connect-src 'none'`, against brief AC5's `'self'`: nothing
  fetches, so the strictest value wins. THE SYSTEM SHALL carry the CSP of design §6 as a `<meta>` tag in `dist/index.html`, and
  `dist/_headers` SHALL send the same policy plus `frame-ancestors 'none'`; no page SHALL raise a
  CSP violation. Oracle: `test/csp.test.ts` compares the two policies; every e2e test fails on a
  `securitypolicyviolation` event.
- **R8.3** WHEN a hostile template and its record are dropped, THE SYSTEM SHALL run no script from
  them and request nothing. Oracle: `e2e/hostile.spec.ts`: 20 seeded P5 inputs; the canary global,
  dialogs, requests and violations all stay at zero.

### R9. Quality and look

Traces: brief AC9; Added: human decisions 9 and 10; ux-principles.md 1, 7, 9, 10.

As any visitor, I want a page that is fast, readable and works from the keyboard.

- **R9.1** THE SYSTEM SHALL score at least 90 for accessibility and for performance in Lighthouse
  desktop. Oracle: `npx lighthouse@13.6.0 --preset=desktop --only-categories=performance,accessibility`
  against `vite preview`, once at task 3 and once at task 10; scores recorded in `verification.md`.
- **R9.2** THE SYSTEM SHALL make every control outside the paper reachable and usable from the
  keyboard with visible focus (the tree by arrow keys), and keep the paper out of the tab order.
  Oracle: `e2e/keyboard.spec.ts`: open a sample, switch view, page, turn X-ray on, select a field
  and read its card, without the mouse.
- **R9.3** THE SYSTEM SHALL take every page colour from `@atlaskit/tokens`, follow the light or
  dark preference outside the paper, use sentence case, and fade the paper from sepia to clean
  within 1.2 s the first time a template renders; WHERE `prefers-reduced-motion: reduce` applies,
  no filter is ever set. Oracle: `test/style.test.ts` (no colour literal in `src/**/*.css` outside
  `paper.css`); `e2e/paper.spec.ts` reads the computed `filter` under both motion settings.

### R10. Ship

Traces: brief "Hosting"; Added: human decision 11.

As the human publishing the site, I want a static folder and a workflow I run myself.

- **R10.1** `pnpm --filter web build` SHALL produce a static `apps/web/dist` that works from any
  path, under the gzip budgets of design §7. Oracle: e2e runs against
  `vite preview --base /infopath-afterlife-app/`; `test/budget.test.ts` reads `dist`.
- **R10.2** THE SYSTEM SHALL include `.github/workflows/web-pages.yml`, which builds `apps/web`
  and deploys `dist` to GitHub Pages on manual dispatch; the agent never runs it. Oracle: review,
  and the same install and build commands run locally.

### R11. Property P14: record matching is a function of the PI and the template set

Traces: Added: human decision 2 (core `matchRecord`), testing.md (core logic gets properties).

- **R11.1** `Changed in task 2:` a version missing on either side counts as equal (as render's
  mismatch check does), and a record whose first 4 KB hold no instruction with a `name` is
  `noSolution`. For any bytes (random, and XML with zero, one or two `mso-infoPathSolution`
  instructions whose `name` and `solutionVersion` come from a pool of 3 URNs and 3 versions, in
  either quote style, before or after the 4 KB window) and any list of up to 5 template keys from
  the same pools, `matchRecord` SHALL return without throwing; the result SHALL be the same for
  every order of the list (compared by the matched key); it SHALL be `exact` exactly when a key
  has the record's URN and its version (or either version is missing); and it SHALL be
  `noSolution` when the first instruction in the first 4 KB has no `name`, or there is none. Bound: 1,000 runs, under 2 s, in
  `packages/core/test/property/p14.property.test.ts`.

## Traceability

| Brief item | Requirements |
|---|---|
| AC1 rendered view, view selector | R3.1, R3.3 |
| AC1 field tree | R4.1, R4.2 |
| AC1 data lineage, dead and internal connections | R6.1 (lineage of fields and controls; Later: the SQL table and list names) |
| AC1 rules in plain English, coverage, death certificate | Later |
| AC2 | R1.3 (phase A list); Triage Later |
| AC3 | R1.1, R2.1, R2.2, R3.2, R11.1 |
| AC4, AC7, AC8, AC10 | Later |
| AC5 | R8.1, R8.2, R8.3 |
| AC6 | R7.1, R7.2 |
| AC9 | R9.1 |
| Hosting | R10.1, R10.2 |
| Added (human decisions 4, 9, 10) | R5.1–R5.3, R9.2, R9.3 |

## Open questions (answered 2026-11-11)

1. **Host.** Cloudflare Pages is recommended for the public URL; the human picks when publishing.
   Both deliverables stay: `_headers` and the GitHub Pages workflow.
2. **Workflow trigger.** `workflow_dispatch` only.
3. **`connect-src`.** `'none'` (R8.2, design §6).
4. **Sample empty records.** Left out; the pager starts with the template's empty form.
5. **Weight-keeper notice.** `samples/public/theill-weight-keeper/LICENSE` is the upstream file,
   unchanged; the notices page reads that file.
6. **Host helpers in core.** `packages/core/host/` with package exports, approved; structure.md
   updated.
7. **Locale.** `en-US`.

---

# Phase B: Keep (export records, `.zip` input)

Brief AC 4 and AC 10, testing.md P11; pains N4 (records trapped) and N9 (no reporting). Decisions
from the human, 2026-11-11 (turn prompt): the export formats, the Worker, the zip writer and
reader in core with no new dependency, and `.zip` input. Fill-in mode, Triage changes and the
Jira call to action are not in this phase.

### R12. Export records and open `.zip` files

As Mai or the auditor, I want every filled-in record of a form in a spreadsheet, with its
attachments beside it, and I want to drop the `.zip` a SharePoint library download gives me.

- **R12.1** WHEN the open template has at least one matched record, THE SYSTEM SHALL show an
  "Export records" menu after the pager, with "Excel workbook (.xlsx)" and "CSV files and
  attachments (.zip)"; WHEN it has none, THE SYSTEM SHALL NOT show it. Oracle: e2e.
- **R12.2** THE workbook's sheet `Records` SHALL have one row per matched record, in pager order:
  `Record file`, `Template version` (the record's `solutionVersion`), then one column per
  non-repeating field of the main data source, headed with its InfoPath field path. Oracle: unit.
- **R12.3** THE SYSTEM SHALL add one sheet per repeating group (and per repeating field), one row
  per item: `Record file`, `Row` (1-based within the record), `Parent row` when the group sits in
  another repeating group, then its fields' paths. Oracle: unit (forms 02 and 06).
- **R12.4** Cell values: a numeric field whose text is a decimal number SHALL be a number cell
  with the text as written; `xsd:boolean` SHALL be the text `TRUE` or `FALSE`; rich text SHALL be
  its plain text; dates, times and every other value SHALL be the text InfoPath wrote; `xsi:nil`
  and missing nodes SHALL be empty. Oracle: unit, P11.
- **R12.5** THE CSV export SHALL be a `.zip` with one CSV per sheet (`Records.csv`,
  `<sheet>.csv`), UTF-8 with BOM, CRLF, each text cell written by core's `csvCell` (quotes and
  the formula guard); number cells SHALL be written as their text. Oracle: unit, P11.
- **R12.6** WHEN a base64 field holds a file attachment (the InfoPath header), THE SYSTEM SHALL
  put the file in the `.zip` as `attachments/<record>/<field>/<file name>` and the path in the
  cell; a picture (no header) SHALL be `picture-<n>.<ext>` by magic number, other bytes
  `file-<n>.bin`. Each segment SHALL be made safe (no separators, `..`, control characters or
  reserved device names; at most 100 characters); a repeated path SHALL get ` (2)`, ` (3)`. THE
  workbook SHALL carry the same path text and an `About` sheet saying the files are in the CSV
  export. Oracle: unit.
- **R12.7** IF a record cannot be read, THEN THE SYSTEM SHALL keep its row with the file name
  and version, and add a last `Read error` column with the reason. Oracle: unit.
- **R12.8** THE export SHALL run in the Worker, which reports progress per record (as opening
  files does) and transfers the finished bytes; the page SHALL save them through a `blob:` URL
  and say in the status line what it wrote. No request is made. Oracle: e2e (guards).
- **R12.9** WHEN 1,000 records of one template are exported, THE export SHALL finish in under
  5 s in the Worker, from the click to the saved file. Measured 2026-11-11 (MacBook, Chromium,
  form 02, 1,000 records made from its 30, 2,700 attachments): `.xlsx` 266 ms and CSV `.zip`
  509 ms with the spec alone; 587 ms and 876 ms in the full parallel e2e run. The brief's placeholder was 30 s. Oracle: e2e (`records-export.spec.ts`).
- **R12.10** Core's zip writer SHALL write local headers, a central directory and its end
  record, CRC-32 and UTF-8 names, deflating each entry through `CompressionStream('deflate-raw')`
  and storing it when that is not smaller. Oracle: P15, `unzip -t` when present.
- **R12.11** Core's zip reader SHALL check the central directory before inflating anything
  (entry count, declared total, input size, and `zipRatio` for entries of 1 MiB or more, all from
  `Limits`), inflate through `DecompressionStream('deflate-raw')` never past the declared size,
  check each CRC, refuse ZIP64, encryption, multi-disk and other methods with `UNSUPPORTED_ZIP`,
  and raise `CORRUPT_ZIP` for bad structure or a name that could leave its folder. Oracle: unit,
  P15.
- **R12.12** WHEN the user drops or picks a `.zip`, THE SYSTEM SHALL open the `.xsn` and `.xml`
  files in it (folders walked, nested zips not opened) exactly as if they had been dropped, and
  list other entries as not opened (`<zip> › <entry>`). Oracle: unit, e2e.
- **R12.13** Property P11 (testing.md). For any of our own forms with records and any subset of
  its records in any order, parsing the exported CSVs SHALL give back every non-repeating field
  value of every record, and each repeating sheet SHALL have as many rows per record as the
  record has items. Oracle: xmldom + XPath, not core's tables. 100 runs.
- **R12.14** Property P15 (new; P14 is taken by R11.1). For any list of entries,
  `readZip(writeZip(x))` SHALL give the same names and bytes; for any mutated or truncated
  archive, the reader SHALL return entries or a typed error within 1 s and never a name that is
  absolute or has a `..` segment. 200 and 500 runs.

| Brief item | Requirements |
|---|---|
| AC4 export records | R12.1–R12.8 |
| AC10 budget | R12.9 |
| Zip writer, reader, `.zip` input (human decisions) | R12.10–R12.12 |
| P11, P15 | R12.13, R12.14 |
