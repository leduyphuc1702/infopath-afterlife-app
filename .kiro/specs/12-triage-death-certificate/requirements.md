# Spec 12: Triage and death certificate, phase A — requirements

Brief: `docs/spec-briefs/12-triage-death-certificate.md`. Status: **approved, 2026-11-11**, with the review decisions below.

## Introduction

Mai drops a folder of InfoPath templates, and their records if she has them, on the web viewer.
She gets a Triage table with one row per form, a death certificate per form, and a plan in waves
that Quang can export as CSV or print on one page.

Phase A is the web viewer only. The logic lives in `packages/core` (`src/coverage/`,
`src/triage/`) with no DOM or Forge imports, so the Forge Studio, the Rovo actions and spec 05's
converter reuse it later.

**Human decisions (2026-11-11):**

1. Coverage classification belongs to spec 05, which does not exist yet. This spec owns a small
   core module that classifies FormIR elements, based on `docs/feature-coverage.md` and citing its
   rows; spec 05 reuses it. Rows whose class is a judgement call are marked `[VERIFY]`.
2. Only three causes carry a date and a source, each checked by the human on 2026-11-11 (R2.2).
   The others show "—".
3. Triage is the screen after opening two or more templates; the certificate opens from a row.
   CSV export and the one-page print view are in phase A. Everything runs in the existing Worker,
   with no network.
4. A local-only private-corpus test, opt-in through `AFTERLIFE_PRIVATE_SAMPLES`, prints counts
   only.
5. No effort or time estimates.

**Review decisions (2026-11-11):**

1. Views beyond the default count as App (Emulated).
2. `Changed at review (2026-11-11):` code-behind is Manual, and so is its certificate entry,
   against the brief's "Unsupported": "Manual: the logic must be rewritten by hand. The event
   names it handled are listed." ActiveX stays Unsupported.
3. A blank check with an authored message is Native.
4. Section and nested section are Native.
5. Record date range: Later (spec 11). `Changed at review (2026-11-11):` against the brief's
   per-form metrics.
6. `.zip` input: Later. `Changed at review (2026-11-11):` against the brief's inputs.
7. `src/coverage/` is a core folder, in `structure.md` from task 1.
8. The UI, the CSV header and the print view say **Emulated**, with the tooltip "Afterlife runs it
   in Classic mode"; `docs/feature-coverage.md` keeps "App"; `CLASS_WORDS` maps the two.
9. CSV injection: cells starting with a tab or a carriage return are prefixed too (OWASP).
10. "Triage all samples" on the landing page (R4.5).

**Facts checked for this draft (2026-11-11):**

- None of the 348 records in `samples/own/records/` carries an `xml-stylesheet` processing
  instruction (none of the 395 files, `-000-empty.xml` included; `grep -l '<?xml-stylesheet'`).
  `browser-xslt` therefore never fires on the in-repo set; R2.1 tests it on a synthetic record.
- The in-repo templates show each other cause at least once: form 43 is browser-compatible; form
  04 has a SQL connection and a web service on an internal host; form 46 has a SharePoint library
  submit to an internal host and C# code-behind; form 44's ActiveX control names an `xd:server`
  whose liveness is `unknown`; form 47 has script; form 44 has an ActiveX
  control; form 45 has a signed block. All 48 templates (47 own plus weight-keeper) get
  `infopath-client`.

## Glossary

- **Element:** one classifiable thing in FormIR: a control, a view beyond the default, a rule
  action, a calculation, a validation, a data connection, the code-behind, an ActiveX control or
  a signature (design §3).
- **Class:** Native, Emulated (shown as "App", as in `docs/feature-coverage.md`), Manual or
  Unsupported (product principle 1).
- **Cause (of death):** one entry of the brief's catalogue, with evidence in a file.
- **Evidence:** a FormIR `Located` (`file`, then `xpath` or `line`) in the template or a record.
- **Wave:** 1, 2 or 3, from the coverage counts (R3.3).

## Requirements

### R1. Coverage classification (core)

Traces: brief "Per-form metrics" (coverage counts); human decision 1; product principle 1.

As Quang, I want every element of a form put in exactly one class, so that "Native %" and the
waves mean something.

- **R1.1** THE SYSTEM SHALL give every element of a FormIR exactly one class, with the
  `docs/feature-coverage.md` row it comes from (section letter and the row's first cell) and the
  element's `source`. Oracle: `packages/core/test/coverage/classify.test.ts` on forms 01–08 and
  43–47, against per-form counts written from FormIR in the test.
- **R1.2** IF an element's kind or subtype has no row (an `xctname`, action or adapter the table
  does not list), THEN THE SYSTEM SHALL class it Manual with `unlisted: true`, never skip it.
  Oracle: `classify.test.ts`, synthetic FormIR with an unknown `xctname`, action and adapter.
- **R1.3** THE classification table SHALL be data exported from core, and each entry SHALL cite a
  row that exists in `docs/feature-coverage.md` whose Coverage cell names the entry's class (or
  carry a `verify` note saying why it differs). Oracle:
  `packages/core/test/coverage/table-doc.test.ts`, which reads the Markdown.
- **R1.4** Property **P11**: for any FormIR built from the in-repo templates with elements removed
  or duplicated, the number of classified items equals the number of elements (design §3), and
  the four counts sum to it. Bound: 200 runs, under 2 s,
  `packages/core/test/property/p11.property.test.ts`.

### R2. Causes of death (core)

Traces: brief "Causes of death", AC3; human decision 2; product principle 5.

As Mai, I want each form's causes of death with the file evidence, so that I can show my manager
why it has to move.

- **R2.1** THE SYSTEM SHALL detect each cause of the brief's catalogue by the rule in design §4,
  and only then. Oracle: `packages/core/test/triage/causes.test.ts`: `forms-services-spo` on form
  43 only; `internal-sql` on form 04; `internal-service` on forms 04 (`forms-legacy`) and 46 (`Changed in task 2:` not 44: FormIR
  gives its ActiveX `xd:server`, `intranet.contoso-fictional.example`, liveness `unknown`, reason
  `public`, so the draft's claim was wrong);
  `code-behind` on forms 46 and 47 with their handler names; `activex` on form 44; `signatures` on
  form 45; `infopath-client` on all 48 templates; `browser-xslt` on a synthetic record with an
  `xml-stylesheet` instruction and on none of the 348 in-repo records.
- **R2.2** Every cause SHALL show its id, its date or "—", its source, its evidence and its
  replacement. Only these carry a date and a source:

  | Cause | Date shown | Source |
  |---|---|---|
  | `forms-services-spo` | after July 14, 2026 | techcommunity.microsoft.com, "Support update for InfoPath Forms Services in Microsoft 365" (June 2023) |
  | `infopath-client` | July 14, 2026 (last day of extended support); `Changed at review (2026-11-11):` the page's "7/15/2026 6:59:59 AM" Pacific stays in design §4 as the evidence, not in the UI | learn.microsoft.com, InfoPath 2013 lifecycle |
  | `browser-xslt` | Chrome 158, November 17, 2026 (Origin Trial and Enterprise Policy: Chrome 176, August 17, 2027) | developer.chrome.com, "Deprecating XSLT" |

  Oracle: `causes.test.ts` compares the catalogue with this table; the URLs are design §4's.
- **R2.5** `Added at review (2026-11-11):` a cause's replacement SHALL agree with the class of the
  element its evidence comes from: an `internal-service` piece from a submit whose class is Native
  says "The JSM request takes its place"; one from an ActiveX control's server says it goes with
  the control (Unsupported); queries keep "Manual: rebind or replace with a JSM field". When the
  pieces differ, each says its own. ActiveX reads "Unsupported: nothing replaces it. The control's
  class ID is listed so someone can find what it did."; signatures read "Manual: use a JSM
  approval. …". The Triage chips show short words, the id in the tooltip and the CSV. Oracle:
  `causes.test.ts` (form 46, form 04, a mixed variant, every replacement against its class);
  `e2e/triage.spec.ts`.
- **R2.3** THE death certificate SHALL list no cause without evidence, and SHALL end with the line
  "Workflows attached outside the form cannot be detected from the file. Ask the library owner."
  Oracle: `causes.test.ts` (form 05: `infopath-client` only); `e2e/triage.spec.ts`.
- **R2.4** Property **P9**: every cause's evidence names a file in the template's package (or the
  record it came from), and its `xpath` selects a node in that file, or its `line` is within it.
  `Changed in task 2:` a code file named in the manifest (`script.js`) is evidence as a whole,
  path `/`; a record's instruction has the path `/processing-instruction(xml-stylesheet)[1]`.
  Bound: forms 01–47 and weight-keeper, plus 200 generated FormIR variants,
  `packages/core/test/property/p9.property.test.ts`.

### R3. Triage rows and waves (core)

Traces: brief "Per-form metrics", AC1, AC2; P8, P10.

As Quang, I want one row per form and a wave for each, by public rules.

- **R3.1** WHEN the user supplies N templates, THE SYSTEM SHALL produce one row per template with:
  name, URN, generation, browser-compatible or client-only, counts (fields, repeating groups,
  views, rules as actions plus calculations plus validations, data connections), the four
  coverage counts, Native % (Native over all items, rounded down; "—" when there are none), the
  record count, the cause ids and the wave. Oracle: `packages/core/test/triage/triage.test.ts` on
  forms 01–08 (golden JSON, reviewed once).
- **R3.2** IF a template fails to parse, THEN THE SYSTEM SHALL produce an error row with its code
  and the batch SHALL continue. Oracle: `triage.test.ts` (a truncated form 02 among forms 01–03).
- **R3.3** THE SYSTEM SHALL assign the wave by the brief's rules: 1 when there are no Emulated,
  Manual or Unsupported items; 2 when there is at least one Emulated and no Manual or
  Unsupported; 3 when there is at least one Manual or Unsupported. Oracle: `triage.test.ts`.
- **R3.4** THE SYSTEM SHALL order rows by wave, then record count descending with unknown counts
  last, then name, then file name; error rows come after all others, by file name. Oracle:
  `triage.test.ts`.
- **R3.5** Property **P8**: the wave is a function of the four counts alone, and adding a Manual
  or Unsupported item never gives an earlier wave. Bound: 1,000 runs,
  `packages/core/test/property/p8.property.test.ts`.
- **R3.6** Property **P10**: the same templates and records in any order give the same rows, in
  the same order, byte-equal as JSON. Bound: 100 runs over forms 01–08 and their records,
  `packages/core/test/property/p10.property.test.ts`.
- **R3.7** THE SYSTEM SHALL show no time, effort, cost or man-hour estimate anywhere. Oracle:
  `apps/web/test/copy.test.ts` (no such words in the Triage, certificate, CSV header and print
  strings).

### R4. Triage screen and death certificate (web viewer)

Traces: brief AC1, AC3; human decision 3.

As Mai, I want to see the whole folder at once, then one form's certificate.

- **R4.1** WHEN two or more templates are open, THE SYSTEM SHALL show the Triage table instead of
  the phase A template list (spec 09 R1.3); with one template it opens the paper as today.
  Oracle: `e2e/triage.spec.ts` (forms 01, 04, 44, 46 dropped together).
- **R4.2** THE Wave column header SHALL have a tooltip, reachable by keyboard, with the three rules
  in plain words. Oracle: `e2e/triage.spec.ts`.
- **R4.3** WHEN the user activates a row, THE SYSTEM SHALL show that form's death certificate:
  each cause with its date, a link to its source, its evidence (file and path) and its
  replacement, the workflow line, and "Open form" to the paper. Oracle: `e2e/triage.spec.ts`
  (form 46: `internal-service`, `code-behind`, `infopath-client`).
- **R4.4** WHILE files are being opened, THE SYSTEM SHALL show per-file progress ("Reading 12 of
  40: 08-big-form.xsn"). Oracle: `test/protocol.browser.test.ts` (progress messages in order,
  one per file).

- **R4.5** `Added at review (2026-11-11):` THE landing page SHALL offer "Triage all samples",
  which opens every bundled template in Triage with no records: forms 01–08, weight-keeper, and
  forms 43–47 (code-behind, ActiveX, signatures, dead services), which the samples chunk gains.
  The notices page and README keep saying forms 43–47 were generated and never opened in
  InfoPath. IF the samples chunk goes over 120 KB gzip, THEN its budget (spec 09 design §7) MAY
  rise to at most 150 KB, with the reason recorded. Oracle: `e2e/triage.spec.ts` (14 rows);
  `apps/web/test/samples.test.ts`, `budget.test.ts`.
  `Changed at review (2026-11-11):` "Triage all samples" opens all 47 own forms plus
  weight-keeper (48 templates) with the 153 records of forms 01–08, and the table reads "48 forms,
  wave 1: 23, wave 2: 17, wave 3: 8", core's split. Forms 09–42 (34 templates, no records) are a
  second lazy chunk, `virtual:sample-more`, budget at most 200 KB gzip (spec 09 design §7), not in
  the first load; the warm-up prefetches it after the samples chunk, so it works offline. They keep
  core's names; "Try a sample" stays forms 01–08 and weight-keeper. Oracle: `e2e/triage.spec.ts`
  (48 rows, the split, timing), `e2e/offline.spec.ts`, `test/samples.test.ts`, `test/budget.test.ts`.

### R5. Export

Traces: brief AC4.

As Quang, I want the plan on paper and in a spreadsheet.

- **R5.1** WHEN the user chooses "Export plan" → CSV, THE SYSTEM SHALL save a UTF-8 CSV (RFC 4180,
  CRLF) with one row per form: every R3.1 metric, the wave and the cause ids; a cell that starts
  with `=`, `+`, `-` or `@` SHALL be prefixed with `'`. The file is made in the browser.
  Oracle: `packages/core/test/triage/csv.test.ts`; `e2e/export.spec.ts` (a download, no request).
- **R5.2** THE print view SHALL fit one page on both A4 and Letter: totals, forms per wave, the
  five most common causes, and the wave rules in plain words. Oracle: `e2e/export.spec.ts`
  (`page.pdf` in A4 and in Letter, one page each, for forms 01–47).

### R6. Records

Traces: brief "Inputs", "Per-form metrics".

- **R6.1** THE record count SHALL be the number of open records `matchRecord` gives the template,
  `exact` or `otherVersion`; WHEN no record at all is open, it SHALL be unknown ("—"), not 0
  (`Changed in task 3:` once any record is open, a template none matches shows 0). Oracle:
  `triage.test.ts`; `e2e/triage.spec.ts`.
- **R6.2** `browser-xslt` SHALL come from records: a record whose first 4 KB hold an
  `xml-stylesheet` instruction adds the cause to its template, with the record as evidence.
  Oracle: `causes.test.ts` (R2.1).

### R7. Performance and trust

Traces: brief AC5, AC6, AC7.

- `Changed in task 9:` spec 09 R7.1's sample set gains the templates of forms 43–47 (14
  templates, still 153 records); they are in "Triage all samples" only, not in "Try a sample".
- **R7.1** THE triage of 40 templates (forms 01–08, five copies each under different names) SHALL
  finish in under 60 s in the Worker, measured in Chromium from drop to table; the measured time is
  recorded in `verification.md`. Oracle: `e2e/triage.spec.ts`.
- **R7.2** `packages/core/src/coverage/` and `src/triage/` SHALL import no DOM, Forge or Node API.
  Oracle: the lint rules core already has (`no-restricted-globals`, `no-restricted-imports`),
  extended to these folders; the private-corpus test runs them in Node.
- **R7.3** No template, record or Triage result SHALL leave the browser. Oracle: spec 09's guards
  in every new e2e test; `e2e/offline.spec.ts` gains a Triage case.

### R8. Private corpus

Traces: human decision 4; spec 01 R21.

- **R8.1** WHERE `AFTERLIFE_PRIVATE_SAMPLES` is set, `packages/core/test/triage-private.local.test.ts`
  SHALL triage every template there and print counts only: rows, error rows by code, causes per
  id, forms per wave, items per class, and `unlisted` items per kind and subtype. It SHALL print
  no file name, form name, host or path, and write nothing. Without the variable it is skipped.
  Oracle: the run itself; its output goes into `verification.md`.

## Traceability

| Brief item | Requirements |
|---|---|
| Inputs (.xsn, folder, records) | R4.1, R6.1; .zip: Later (open question 2) |
| Per-form metrics | R3.1, R6.1; record date range: Later (open question 1) |
| Coverage counts from spec 05 | R1.1–R1.4 (human decision 1) |
| Causes of death | R2.1–R2.3, R6.2 |
| AC1 | R3.1, R3.2, R4.1 |
| AC2 | R3.3, R3.4, R3.7, R4.2 |
| AC3 | R2.2, R2.3, R4.3 |
| AC4 | R5.1, R5.2 |
| AC5 | R4.4, R7.1 |
| AC6 | R7.2 |
| AC7 | R7.3 |
| P8, P9, P10 | R3.5, R2.4, R3.6; P11 added: R1.4 |
| Forge Studio, Rovo actions | Later (phase B) |

## Open questions

1. **Record date range.** A record holds no date of its own; the only source in the browser is
   `File.lastModified`, which a copy, an unzip or a `git clone` resets. Recommendation: leave it
   out of phase A and say so; add it in spec 11, where records come from SharePoint with their
   metadata.
2. **`.zip` input.** The brief lists it. Folder drop already covers "a whole folder".
   Recommendation: Later; reading a zip needs only `DecompressionStream`, but it adds another
   hostile-input surface (zip bombs, paths) that deserves its own criteria.
3. The `[VERIFY]` rows of design §3.
