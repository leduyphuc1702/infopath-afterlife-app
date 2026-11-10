# Verification: spec 02 FormIR

Evidence that the spec was met, written at task 14. Each row names the passing tests that prove a
criterion; a criterion with no passing test is not met.

- **Date:** 2026-11-10, 20:45 +07:00.
- **Runtime:** Node v22.23.4, pnpm 12.18.0, Playwright Chromium (HeadlessChrome 158).
- **Tree:** commit `67c898a` plus the uncommitted task 13 change (`test/private-corpus.local.test.ts`)
  and the task 14 documents (this file, `tasks.md`, `docs/feature-coverage.md`).
- **Clean install:** the files git would commit (`git ls-files --cached --others
  --exclude-standard`) were copied to an empty folder under `/tmp` with no `node_modules`, and
  every command below ran there. The working copy's `node_modules` was not touched. The folder
  was deleted afterwards.

## Commands and results

Run in the clean folder, in this order:

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | exit 0 |
| `pnpm check` (typecheck, lint, format check, node project, browser project) | exit 0; node project 70 files passed, 1 skipped (`private-corpus.local.test.ts`, variable unset), 2,933 tests passed; browser project 4 files, 155 tests passed |
| `vitest run --project perf` (`pnpm test:perf`) | exit 0; 3 files, 101 tests passed; `parseXsn` + `buildFormIR` slowest p95 `08-big-form` 35.57 ms (p50 26.66 ms), budget 300 ms |
| `AFTERLIFE_PRIVATE_SAMPLES=$HOME/Desktop/infopath-afterlife/samples vitest run test/private-corpus.local.test.ts` | exit 0; 72 tests passed (read only, nothing written); lines below |
| `vitest run --project node\|browser\|perf --reporter=json` | 2,934 + 155 + 101 tests: 3,189 passed, 0 failed, 1 skipped (the local-only file). The table below is checked against these reports |

Local check summary (names and counts only; the folder holds the 29 private templates and a copy
of forms 01–42):

```
private corpus: 71 files, 71 parsed, 0 issues, 0 unknowns
FormIR built: 71
FormIR issues: UNRESOLVED_BINDING notInTree 3, UNRESOLVED_REFERENCE axis 3, UNRESOLVED_REFERENCE stringExpression 12
generation: 2003 4, 2007 10, 2010 2, 2013 55
labelSource: cell 19, columnHeader 26, leftCell 29, name 146, otherView 23, schemaDisplayName 60, title 818
UNRESOLVED_BINDING by reason and xctname: notInTree CheckBox 3
UNRESOLVED_REFERENCE by reason and role: axis actionExpression 3, stringExpression calcExpression 6, stringExpression submitValue 6
```

The FormIR issue counts equal the task 13 expectation exactly. `generation` is the R2.2 private
count (2003 ×4, 2007 ×10, 2010 ×2, 2013 ×13) plus the 42 own forms. `labelSource` minus the own
forms 01–42 (title 556, otherView 14, name 9) gives the maintainer's private counts.

## Summary

**39 of 40 criteria pass. R4.1 is open:** its `isPrint` rule and oracle contradict MS-IPFF2 (see
Notes). Brief items: 6 of 7 pass; AC1 is open for the same reason (it lists `isPrint`).

## R1.1–R15.1

| Criterion | Tests (file › test name or name prefix, passed/total) | Result |
|---|---|---|
| R1.1 | `test/ir/golden.samples.test.ts` › "matches its golden FormIR" (48/48); `test/lint/restricted.test.ts` › "packages/core/src/ir restrictions (spec 02 R1.1)" (28/28); `test/browser/worker-parity.browser.test.ts` › "FormIR JSON built in a Worker" (48/48) | Pass |
| R1.2 | `test/ir/golden.samples.test.ts` › "R1.2 every expression string equals its spec 01 source" (1/1) | Pass |
| R1.3 | `test/ir/golden.samples.test.ts` › "R1.3 every sample has zero FormIR issues" (1/1); `test/ir/build.test.ts` › "R1.3: no main schema …" (1/1); `test/ir/view-scan.test.ts` › "a missing view and a broken one …", "a mode never called, and a named template" (2/2) | Pass |
| R1.4 | `test/private-corpus.local.test.ts`: skipped in `pnpm check`; local run 72/72 with the counts above, including "spec 02 R1.4: FormIR issues are exactly the expected counts" | Pass (local) |
| R2.1 | `test/ir/meta.test.ts` › "R2.1 identity" (3/3) | Pass |
| R2.2 | `test/ir/meta.test.ts` › "R2.2 generation" (11/11); local generation line above | Pass |
| R3.1 | `test/ir/data-tree.test.ts` › "R3.1 fields and groups" (4/4) | Pass |
| R3.2 | `test/ir/data-tree.test.ts` › "R3.2 data paths and ids" (2/2); `test/ir/ids.test.ts` (6/6) | Pass |
| R3.3 | `test/ir/data-tree.test.ts` › "R3.3 README counts" (48/48) | Pass |
| R4.1 | `test/ir/view-scan.test.ts` › "R4.1 views" (3/3): README Views column, 53 views, form 05 `HR` default. **No test for "the spec 01 synthetic print-settings manifest gives `isPrint` true", and it would fail** (Notes) | **Open** |
| R4.2 | `test/ir/view-scan.test.ts` › "R4.2 bound controls in the samples" (4/4), "R4.3 synthetic views" (`GetDOM`, `DropDown`, dynamic `title`, ActiveX `{{…}}`) | Pass |
| R4.3 | `test/ir/view-scan.test.ts` › "R4.3 synthetic views" (9/9) | Pass |
| R4.4 | `test/ir/view-scan.test.ts` › "R4.4 choicesFrom" (2/2), "a text box bound into a secondary source with GetDOM; a filtered list" (1/1) | Pass |
| R4.5 | `test/ir/view-scan.test.ts` › "R4.5 ActiveX" (1/1), "an unbound object …", "ActiveX with {{…}} …" (2/2); `test/ir/elements.test.ts` › "allowed ActiveX controls from the manifest" (1/1) | Pass |
| R5.1 | `test/ir/labels.samples.test.ts` › "R5.1 labelSource counts over the 606 main-tree fields" (5/5): `title` 585, `leftCell` 2, `otherView` 14, `name` 5; › "forms 01–08, default views" (2/2): 290 of 290 | Pass |
| R5.2 | `test/ir/labels.test.ts` › "R5.2 cleanLabel" (5/5); `test/ir/labels.samples.test.ts` › "public sample" (1/1) | Pass |
| R5.3 | `test/ir/labels.test.ts` (evidence asserted in 6 layouts); `test/ir/labels.samples.test.ts` › "290 fields …, with the evidence" (1/1); golden files (48/48) | Pass |
| R5.4 | `test/ir/labels.test.ts` › "R5.4 layouts" (12/12); local `labelSource` line above | Pass |
| R6.1 | `test/ir/elements.test.ts` › "README Rules, Calcs and Checks" (48/48), "R6 rules and triggers" (3/3) | Pass |
| R6.2 | `test/ir/elements.test.ts` › "8 trigger links over 9 rules …" (1/1); `test/ir/dependencies.samples.test.ts` › "…Id properties are filled" (1/1) | Pass |
| R7.1 | `test/ir/elements.test.ts` › "README Rules, Calcs and Checks" (48/48) | Pass |
| R7.2 | `test/ir/elements.test.ts` › "R7.2 validations" (2/2), README Checks (48/48) | Pass |
| R8.1 | `test/ir/connections.test.ts` › "R8.1 connections" (8/8) | Pass |
| R8.2 | `test/ir/connections.test.ts` › "R8.2–R8.3 publishUrl and synthetic adapters" (3/3), form 04 (1/1); `test/ir/endpoints.test.ts` › "connection strings" (8/8) | Pass |
| R8.3 | `test/ir/endpoints.test.ts` › "liveness, one case per row" (34/34, boundaries and `x-soln` included); `test/ir/connections.test.ts` › "46 publishUrls …" (1/1) | Pass |
| R8.4 | `test/xsf/credentials.test.ts` (25/25); `test/ir/endpoints.test.ts` › "redaction (R8.4)" (6/6); `test/ir/connections.test.ts` › "R8.4 the secret appears nowhere in FormIR" (2/2), "every sample: credentialRedacted false" (1/1) | Pass |
| R9.1 | `test/ir/elements.test.ts` › "form 46 …", "form 47 …", "the other 46 samples …" (3/3) | Pass |
| R9.2 | `test/ir/elements.test.ts` › "form 45 …", "signature lines …" (2/2) | Pass |
| R10.1 | `test/ir/build.test.ts` › "R10: manifest unknowns …", "R10: schema unknowns …" (2/2) | Pass |
| R11.1 | `test/ir/xpath-tokens.test.ts` (21/21); `test/ir/dependencies.samples.test.ts` › "per Evidence row" (1/1): manifest rows 49 + 98 + 14 + 5 = 166 | Pass |
| R11.2 | `test/ir/xpath-resolve.test.ts` › "contexts (R11.2)" (4/4); `test/ir/dependencies.samples.test.ts` › "form 03: ../my:destCity …" (1/1); `test/ir/dependencies.test.ts` (3/3, button contexts) | Pass |
| R11.3 | `test/ir/dependencies.samples.test.ts` › "R11.3 oracles" (5/5) | Pass |
| R11.4 | `test/ir/xpath-resolve.test.ts` › "one case per unresolved reason (R11.4)" (17/17); `test/ir/dependencies.samples.test.ts` › "0 unresolved references and 0 FormIR issues" (1/1) | Pass |
| R11.5 | `test/ir/dependencies.samples.test.ts` › "per Evidence row" (1/1): 1,566 of 1,566 | Pass |
| R12.1 | `test/property/p13.property.test.ts` › "500 runs …" (1/1); each shape (GetDOM, `..`, predicate, literal) over 20 times; regressions list empty | Pass |
| R13.1 | `test/ir/json.test.ts` › "serialiseFormIR" (5/5); `test/browser/worker-parity.browser.test.ts` › "one golden FormIR file per cabinet" (1/1), "FormIR JSON built in a Worker equals the golden file" (48/48) | Pass |
| R13.2 | `test/ir/golden.samples.test.ts` › "matches its golden FormIR" (built twice, 48/48), "R13.2 ids are unique …", "R13.2 forms 01 and 07 …" (2/2); `test/ir/ids.test.ts` (6/6) | Pass |
| R13.3 | `test/ir/golden.samples.test.ts` › "48 samples", "matches its golden FormIR" (49/49) | Pass |
| R14.1 | `test/property/p6.property.test.ts` (51/51: 500 generated runs, 48 golden files, `__proto__`); `test/ir/json.test.ts` › "parseFormIR" (13/13) | Pass |
| R15.1 | `test/perf/formir.perf.test.ts` (50/50): every sample p95 under 300 ms, form 08 reported; `test/ir/view-scan.test.ts` › "R15 viewXmlBytes" (1/1) | Pass |

## Brief acceptance criteria and properties

| Item | Brief text (short) | Evidence | Result |
|---|---|---|---|
| AC1 | the FormIR parts, including `views[]` with `isPrint` | R1.1, R2–R4, R6–R10; `promotedFields[]` moved to spec 05 (decision 6a). `isPrint` as R4.1 defines it is wrong (Notes) | **Open** |
| AC2 | label guess in the 8-step order, with the step recorded | R5.1–R5.4 | Pass |
| AC3 | dependency index: who reads or writes each field | R11.1–R11.5, R12.1 | Pass |
| AC4 | `internal` endpoints, no network | R8.2, R8.3; `src/ir/**` lint bans `fetch`; spec 01 network stub | Pass |
| AC5 | stable JSON, deterministic ids | R13.1–R13.3 | Pass |
| P6 | round trip for every sample and any generated FormIR | R14.1 | Pass |
| Completeness | every field in a rule expression lists that rule | R11.5 (1,566 of 1,566), R12.1 (P13) | Pass |

## Notes

- **R4.1 `isPrint`.** R4.1 says `isPrint` is true when `printView` is `yes`, and its oracle says
  spec 01's synthetic manifest gives `isPrint` true. MS-IPFF2 (`xsf:view`, checked 2026-11-10)
  defines `printView` as "the name of another form view to be used for printing the form view";
  it is never `yes`. Spec 01's fixture (`test/xsf/build.views.test.ts`) writes
  `printView="Print"` on view `Main`, so today `isPrint` is false for it and the oracle cannot
  pass. No sample manifest has `printView`. This needs a decision before the row can pass.
- The R11.5 "Absolute paths" row counts `signedDataBlock/@signatureLocation`, a `DepRole` since
  task 10.
- `inRepeat` comes from the data tree since task 10; five sample controls changed (forms 06, 23).
- "(n/m)" counts the tests of that name or prefix in the JSON reports.
