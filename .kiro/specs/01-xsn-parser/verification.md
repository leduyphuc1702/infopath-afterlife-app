# Verification: spec 01 .xsn parser

Evidence that the spec was met, written at task 28. Each row names the passing tests that prove a
criterion; a criterion with no passing test is not met.

- **Date:** 2026-11-10, 17:45 +07:00 (re-run after the task 28 count corrections).
- **Runtime:** Node v22.23.4, pnpm 12.18.0, Playwright Chromium (HeadlessChrome 158).
- **Tree:** commit `2877736` plus the uncommitted task 28 changes: R6.4, R6.6, R10.5, R20.1 and
  R20.2 wording; design §8.3, §8.4 and §13.3; the P12 enumerated-value change; the R10.5 totals
  test; `docs/feature-coverage.md`. This file is written after the run and holds no code.
- **Clean install:** the files git would commit (`git ls-files --cached --others
  --exclude-standard`) were copied to an empty folder with no `node_modules`, so nothing from an
  earlier install could take part. The working copy's `node_modules` was not touched.

## Commands and results

Run in the clean folder, in this order:

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | exit 0 |
| `pnpm check` (typecheck, lint, format check, node project, browser project) | exit 0; node project 49 files, 2,271 tests passed; browser project 4 files, 106 tests passed |
| `pnpm test:perf` | exit 0; 2 files, 51 tests passed; `08-big-form` p95 6.37 ms, the slowest of the 48 (budget 300 ms) |
| `vitest run --project node\|browser\|perf --reporter=json` | 2,271 + 106 + 51 = 2,428 tests, 2,428 passed, 0 failed, 0 skipped. The table below is checked against these reports |

Property logs from the `pnpm check` run: P1 bytes 1,000 runs (slowest `parseXsn` 1.8 ms), P1
cabinet 1,000 runs (7.3 ms), P1 xml 1,000 runs (7.4 ms); P12 500 runs with 715 `unexpectedValue`
entries, 708 changed attributes checked, and 161 `repeated` entries.

## Summary

114 of 114 criteria pass. The first run of task 28 left R10.5 open: its text said "38 error
conditions, all in own forms", true only for forms 01–42. Its numbers were corrected (approved
2026-11-10, with R6.4 and R6.6), and a test now asserts every total it names.

## R1.1–R20.3

| Criterion | Tests (file › test name or name prefix, passed/total) | Result |
|---|---|---|
| R1.1 | `test/cab/read.unit.test.ts` › "readCabinet returns name, size, date, time, attributes, folder and bytes (R1.1)" (1/1) | Pass |
| R1.2 | `test/cab/read.unit.test.ts` › "readCabinet two multi-block folders, history carried within each (R1.2)" (1/1)<br>`test/cab/read.unit.test.ts` › "readCabinet history starts fresh in each folder (R1.2)" (1/1) | Pass |
| R1.3 | `test/cab/read.unit.test.ts` › "readCabinet a type-0 folder is copied as is (R1.3)" (1/1) | Pass |
| R1.4 | `test/cab/read.unit.test.ts` › "readCabinet names: UTF-8 with attribute 0x80, Windows-1252 without (R1.4)" (1/1) | Pass |
| R1.5 | `test/cab/read.unit.test.ts` › "readCabinet files come back in CFFILE order, not by name or folder (R1.5)" (1/1) | Pass |
| R1.6 | `test/cab/read.samples.test.ts` › "samples/own: readCabinet equals forms/<slug>/ byte for byte" (47/47)<br>`test/cab/read.samples.test.ts` › "samples/own: xsn and forms folders pair up" (2/2)<br>`test/cab/read.samples.test.ts` › "samples/public: theill-weight-keeper equals Appendix B" (1/1) | Pass |
| R2.1 | `test/cab/unsupported.test.ts` › "compression types (R2.1, R2.2) typeCompress" (4/4)<br>`test/cab/unsupported.test.ts` › "compression types (R2.1, R2.2) a later folder is named by its index" (1/1) | Pass |
| R2.2 | `test/cab/unsupported.test.ts` › "compression types (R2.1, R2.2) type " (3/3) | Pass |
| R2.3 | `test/cab/unsupported.test.ts` › "header flags (R2.3, R2.4) flags " (4/4) | Pass |
| R2.4 | `test/cab/unsupported.test.ts` › "header flags (R2.3, R2.4) flag 0x0004 reads normally" (1/1)<br>`test/cab/read.unit.test.ts` › "readCabinet a reserve header (flag 0x0004) reads normally (R2.4)" (1/1)<br>`test/cab/structures.test.ts` › "synthetic structures reserve areas (flag 0x0004) are skipped" (1/1) | Pass |
| R2.5 | `test/cab/unsupported.test.ts` › (every test in the file) (14/14) | Pass |
| R3.1 | `test/cab/structures.test.ts` › "synthetic structures a cabinet that is not MSCF is CORRUPT_CAB at offset 0 (R3.1)" (1/1) | Pass |
| R3.2 | `test/cab/corrupt.test.ts` › "truncation of 02-expense-report at every structure boundary (R3.2)" (161/161) | Pass |
| R3.3 | `test/cab/corrupt.test.ts` › "damaged blocks (R3.3)" (4/4) | Pass |
| R3.4 | `test/cab/corrupt.test.ts` › "checksum mismatch (R3.4, R3.6)" (2/2) | Pass |
| R3.5 | `test/cab/corrupt.test.ts` › "file entries (R3.5)" (2/2)<br>`test/cab/structures.test.ts` › "synthetic structures a file in a folder that does not exist is CORRUPT_CAB at its CFFILE entry (R3.5)" (1/1) | Pass |
| R3.6 | `test/cab/corrupt.test.ts` › "truncation of 02-expense-report" (161/161)<br>`test/cab/corrupt.test.ts` › "checksum mismatch (R3.4, R3.6) one flipped checksum byte" (1/1)<br>`test/property/p1.property.test.ts` › "generator cabinet" (1/1) | Pass |
| R3.7 | `test/cab/hardening.test.ts` › "overlapping folders (R3.7)" (5/5) | Pass |
| R3.8 | `test/cab/hardening.test.ts` › "zero-length blocks (R3.8)" (2/2) | Pass |
| R4.1 | `test/limits.test.ts` › "uncompressed size and block limits (R4.1, R4.4) a declared 51 MiB" (1/1)<br>`test/limits.test.ts` › "uncompressed size and block limits (R4.1, R4.4) actual output past 50 MiB" (1/1)<br>`test/limits.test.ts` › "uncompressed size and block limits (R4.1, R4.4) exactly 50 MiB" (1/1) | Pass |
| R4.2 | `test/limits.test.ts` › "cabinet structure limits (R4.2, R4.3) 2,000 declared files pass" (1/1)<br>`test/limits.test.ts` › "cabinet structure limits (R4.2, R4.3) the entries limit applies before any CFFILE entry is read" (1/1) | Pass |
| R4.3 | `test/limits.test.ts` › "cabinet structure limits (R4.2, R4.3) 20 MiB passes the input check" (1/1) | Pass |
| R4.4 | `test/limits.test.ts` › "uncompressed size and block limits (R4.1, R4.4) cbUncomp 32,768 is accepted; 32,769 is CORRUPT_CAB" (1/1) | Pass |
| R4.5 | `test/xml/prescan.test.ts` › "depth (R4.5)" (5/5)<br>`test/xml/safety.test.ts` › "without a DOCTYPE 257 levels of nesting stop with LIMIT_EXCEEDED before the tree is built" (1/1) | Pass |
| R4.6 | `test/limits.test.ts` › "defaults and overrides (R4.6)" (5/5)<br>`test/limits.test.ts` › "cabinet structure limits (R4.2, R4.3) limits are options" (1/1)<br>`test/cab/hardening.test.ts` › "block count (R4.7) the limit is an option" (1/1) | Pass |
| R4.7 | `test/cab/hardening.test.ts` › "block count (R4.7)" (4/4) | Pass |
| R5.1 | `test/xml/safety.test.ts` › (every test in the file) (7/7)<br>`test/golden.samples.test.ts` › (every test in the file) (50/50) | Pass |
| R5.2 | `test/xml/prescan.test.ts` › "DOCTYPE (R5.2)" (5/5)<br>`test/xml/safety.test.ts` › "every DOCTYPE attack is UNSAFE_XML at the DOCTYPE" (4/4) | Pass |
| R5.3 | `test/xml/decode.test.ts` › (every test in the file) (20/20)<br>`test/xml/encoding-labels.test.ts` › (every test in the file) (4/4)<br>`test/browser/encodings.browser.test.ts` › (every test in the file) (4/4) | Pass |
| R5.4 | `test/xsn/parse.test.ts` › "R5.4: what is fatal" (4/4)<br>`test/xsd/schema-set.test.ts` › "broken schema files are issues, not fatal (R5.4)" (1/1) | Pass |
| R5.5 | `test/lint/restricted.test.ts` › "packages/core/src restrictions import '@xmldom/xmldom' is an error" (1/1)<br>`test/lint/restricted.test.ts` › "packages/core/src restrictions src/xml/parse.ts may import @xmldom/xmldom" (1/1)<br>`test/browser/worker-parity.browser.test.ts` › "the Worker bundle builds with no Node built-in (R17.1)" (1/1) | Pass |
| R5.6 | `test/xml/parse.test.ts` › "the tree line and column on elements, and on attribute values (R5.6)" (1/1)<br>`test/xml/parse.test.ts` › "errors (R5.4, R5.6)" (8/8) | Pass |
| R5.7 | `test/xml/safety.test.ts` › (every test in the file) (7/7)<br>`test/xml/decode.test.ts` › "legacy code pages" (4/4)<br>`test/xml/decode.test.ts` › "refused labels" (5/5) | Pass |
| R6.1 | `test/xsn/package.test.ts` › "R6.1 manifest discovery" (4/4) | Pass |
| R6.2 | `test/xsn/package.test.ts` › "R6.2–R6.3: each reference kind, missing in turn" (11/11) | Pass |
| R6.3 | `test/xsn/package.test.ts` › "R6.2–R6.3: each reference kind, missing in turn 0" (7/7)<br>`test/xsn/package.test.ts` › "R6.2–R6.3: each reference kind, missing in turn 4" (1/1) | Pass |
| R6.4 | `test/xsn/package.test.ts` › "R6.4 and R6.5 a file not in xsf:files is UNLISTED_FILE" (1/1)<br>`test/xsn/package.test.ts` › "every sample: none of the package issues" (1/1)<br>Count corrected to 0 of 48 at task 28; the test checks all 48 cabinets. | Pass |
| R6.5 | `test/xsn/package.test.ts` › "R6.4 and R6.5 duplicate names" (1/1)<br>`test/xsn/package.test.ts` › "R6.4 and R6.5 ../evil.xml" (1/1)<br>`test/xsn/package.test.ts` › "R6.4 and R6.5 dir" (1/1)<br>`test/xsn/package.test.ts` › "R6.4 and R6.5 C:evil.xml" (1/1)<br>`test/xsn/package.test.ts` › "R6.4 and R6.5 /etc/passwd" (1/1)<br>`test/xsn/package.test.ts` › "R6.4 and R6.5 \x.xml" (1/1)<br>`test/xsn/package.test.ts` › "R6.4 and R6.5 ".." inside a name is not a path segment" (1/1) | Pass |
| R6.6 | `test/xsn/package.test.ts` › "R6.6 URN check" (3/3)<br>`test/xsn/package.test.ts` › "every sample: none of the package issues" (1/1)<br>Count corrected to 0 of 48 at task 28. | Pass |
| R7.1 | `test/xsf/build.identity.test.ts` › "R7.1 identity" (1/1)<br>`test/xsf/vocabulary.coverage.test.ts` › (every test in the file) (177/177) | Pass |
| R7.2 | `test/xsf/build.identity.test.ts` › "R7.2 solution definition" (4/4) | Pass |
| R7.3 | `test/xsf/build.identity.test.ts` › "R7.3 and R7.4: upgrade, package, schemas, fileNew, parameters form 05" (1/1)<br>`test/xsf/build.identity.test.ts` › "R7.3 and R7.4: upgrade, package, schemas, fileNew, parameters the public sample keeps lastVersionNeedingTransform" (1/1) | Pass |
| R7.4 | `test/xsf/build.identity.test.ts` › "R7.3 and R7.4" (4/4) | Pass |
| R7.5 | `test/xsf/build.identity.test.ts` › "R7.1 identity form 05: every xDocumentClass attribute as written, absent ones absent" (1/1)<br>`test/xsf/walk.test.ts` › "modelled content absent attributes stay absent" (1/1)<br>`test/xsf/vocabulary.ms-ipff2.test.ts` › (every test in the file) (731/731) | Pass |
| R7.6 | `test/xsf/build.identity.test.ts` › "R7.6 oracle" (49/49)<br>`test/golden.samples.test.ts` › (every test in the file) (50/50) | Pass |
| R8.1 | `test/xsf/build.views.test.ts` › "form 05 (R8.5) 3 views in document order; HR is the default" (1/1)<br>`test/xsf/build.views.test.ts` › "synthetic: print settings, header, footer, merged print view, xsf3 view attributes" (1/1) | Pass |
| R8.2 | `test/xsf/build.views.test.ts` › "synthetic: print settings, header, footer, merged print view, xsf3" (5/5)<br>`test/xsf/build.views.test.ts` › "form 05 (R8.5) xsf2:viewExtension linked to each view by ref" (1/1) | Pass |
| R8.3 | `test/xsf/build.views.test.ts` › "form 05 (R8.5) editing controls, editWith and the chooseFragment payload" (1/1)<br>`test/xsf/build.views.test.ts` › "across forms 01–42 (R8.5) 21 fragmentToInsert" (1/1) | Pass |
| R8.4 | `test/xsf/build.views.test.ts` › "form 05 (R8.5) menu area buttons" (1/1)<br>`test/xsf/build.views.test.ts` › "synthetic: print settings, header, footer, merged print view, xsf3 toolbar buttons" (1/1)<br>`test/xsf/build.views.test.ts` › "form 05 (R8.5) 3 unbound buttons" (1/1)<br>`test/xsf/build.rules.test.ts` › "forms form 05: the three buttons run rule sets" (1/1) | Pass |
| R8.5 | `test/xsf/build.views.test.ts` › "form 05 (R8.5)" (5/5)<br>`test/xsf/build.views.test.ts` › "across forms 01–42 (R8.5)" (2/2)<br>`test/golden.samples.test.ts` › (every test in the file) (50/50) | Pass |
| R9.1 | `test/xsf/build.rules.test.ts` › "R9.6 oracle across the sample manifests 9 rules in 8 rule sets in 5 forms" (1/1)<br>`test/xsf/build.rules.test.ts` › "synthetic: every action kind" (4/4) | Pass |
| R9.2 | `test/xsf/build.rules.test.ts` › "synthetic: every action kind, exitRuleSet and a submit-free binding order every action with its attributes, in document order" (1/1)<br>`test/xsf/build.rules.test.ts` › "forms form 04: actions in document order across kinds, with all attributes" (1/1)<br>`test/xsf/build.rules.test.ts` › "forms form 04: the dialogBoxExpressionAction text, verbatim" (1/1) | Pass |
| R9.3 | `test/xsf/build.rules.test.ts` › "synthetic: every action kind, exitRuleSet and a submit-free binding order the exitRuleSet element is a container with its path" (1/1) | Pass |
| R9.4 | `test/xsf/build.rules.test.ts` › "R9.6 oracle across the sample manifests 8 ruleSetAction" (1/1)<br>`test/xsf/build.rules.test.ts` › "forms form 01: onLoad runs setToday" (1/1)<br>`test/xsf/build.rules.test.ts` › "forms form 03: a field change runs clearCity" (1/1)<br>`test/xsf/build.rules.test.ts` › "synthetic: every action kind, exitRuleSet and a submit-free binding order bindings in document order" (1/1) | Pass |
| R9.5 | `test/xsf/build.rules.test.ts` › "forms form 47: domEventHandlers with handlerObject and no rule set (R9.5)" (1/1)<br>`test/xsf/build.rules.test.ts` › "forms form 03: a field change runs clearCity" (1/1) | Pass |
| R9.6 | `test/xsf/build.rules.test.ts` › "R9.6 oracle across the sample manifests" (4/4)<br>`test/golden.samples.test.ts` › (every test in the file) (50/50) | Pass |
| R10.1 | `test/xsf/build.validation.test.ts` › "R10.5 oracle 19 calculated fields in own forms, 1 in the public sample" (1/1) | Pass |
| R10.2 | `test/xsf/build.validation.test.ts` › "R10.3: messages verbatim form 01: condition and message attributes" (1/1)<br>`test/xsf/build.validation.test.ts` › "R10.5 oracle 0" (9/9) | Pass |
| R10.3 | `test/xsf/build.validation.test.ts` › "R10.3: messages verbatim" (48/48)<br>`test/xsf/build.validation.test.ts` › "synthetic: whitespace, xsf3:errorBlank, schemaErrorMessages message text and shortMessage keep whitespace and case" (1/1) | Pass |
| R10.4 | `test/xsf/build.validation.test.ts` › "synthetic: whitespace, xsf3:errorBlank, schemaErrorMessages xsf3:errorBlank" (1/1)<br>`test/xsf/build.validation.test.ts` › "synthetic: whitespace, xsf3:errorBlank, schemaErrorMessages schemaErrorMessages with overrides" (1/1) | Pass |
| R10.5 | `test/xsf/build.validation.test.ts` › "R10.5 oracle totals: 19 + 1 calculated fields; 38 error conditions in forms 01–42, 44 in 01–47, 0 public" (1/1)<br>`test/xsf/build.validation.test.ts` › "R10.5 oracle" (50/50)<br>`test/golden.samples.test.ts` › (every test in the file) (50/50)<br>Totals corrected at task 28; the first cite asserts all five numbers of the criterion. | Pass |
| R11.1 | `test/xsf/build.connections.test.ts` › "R11.7 oracle form 04" (1/1)<br>`test/xsf/build.connections.test.ts` › "R11.7 oracle form 03" (1/1)<br>`test/xsf/build.connections.test.ts` › "synthetic: every adapter kind in each place it can sit (R11.3) data adapters" (1/1) | Pass |
| R11.2 | `test/xsf/build.connections.test.ts` › "R11.7 oracle form 01: submit attributes and the email fields" (1/1)<br>`test/xsf/build.connections.test.ts` › "synthetic: every adapter kind in each place it can sit (R11.3) submit:" (1/1)<br>`test/xsf/build.connections.test.ts` › "synthetic: every adapter kind in each place it can sit (R11.3) data adapters in document order" (1/1) | Pass |
| R11.3 | `test/xsf/build.connections.test.ts` › "synthetic: every adapter kind in each place it can sit (R11.3)" (5/5)<br>`test/xsf/build.connections.test.ts` › "synthetic: SharePoint list adapters" (3/3)<br>`test/xsf/build.connections.test.ts` › "synthetic: connectoid (fixtures/synthetic/connectoid.xsf) useHttpHandler in submit" (1/1)<br>`test/xsf/vocabulary.requirements.test.ts` › "xsf:grooveAdapter (named in R11.3)" (1/1)<br>`test/xsf/walk.test.ts` › "documented follows ms-ipff2.ts elements" (1/1) | Pass |
| R11.4 | `test/xsf/build.connections.test.ts` › "synthetic: connectoid" (3/3)<br>`test/xsf/build.connections.test.ts` › "synthetic: SharePoint list adapters (fixtures/synthetic/sharepoint-adapters.xsf) extensions linked by ref" (1/1)<br>`test/xsf/build.connections.test.ts` › "R11.7 oracle form 1 submits through emailAdapter, linked to its extension" (1/1) | Pass |
| R11.5 | `test/xsf/build.connections.test.ts` › "R11.5 containsCredential" (11/11) | Pass |
| R11.6 | `test/xsn/parse.test.ts` › "the result form 04: secondary trees keyed by data object name" (1/1)<br>`test/xsd/field-tree.test.ts` › "R15.7: form 04 has two myFields trees" (3/3) | Pass |
| R11.7 | `test/xsf/build.connections.test.ts` › "R11.7 oracle" (9/9)<br>`test/golden.samples.test.ts` › (every test in the file) (50/50) | Pass |
| R12.1 | `test/xsf/build.security.test.ts` › "R12.6 oracle public sample: 1 promoted field, Date" (1/1)<br>`test/xsf/vocabulary.coverage.test.ts` › (every test in the file) (177/177) | Pass |
| R12.2 | `test/xsf/build.security.test.ts` › "R12.6 oracle form 45: a countersigned signedDataBlock with its paths and message" (1/1)<br>`test/xsf/build.security.test.ts` › "synthetic: signature lines" (3/3)<br>`test/xsf/ms-ipff2.test.ts` › "known entries xsf:signedDataBlock/@mode is single, cosign, countersign" (1/1) | Pass |
| R12.3 | `test/xsf/build.security.test.ts` › "synthetic: roles" (2/2) | Pass |
| R12.4 | `test/xsf/build.security.test.ts` › "R12.6 oracle form 46: managedCode as written, projectPath included" (1/1)<br>`test/xsf/build.security.test.ts` › "R12.6 oracle form 47: JScript scripts with one script.js" (1/1)<br>`test/xsf/build.rules.test.ts` › "forms form 47: domEventHandlers with handlerObject" (1/1)<br>`test/xsn/parse.test.ts` › "the result form 47: codeFiles is ["script.js"]" (1/1)<br>`test/xsn/parse.test.ts` › "the result code files by extension, any case, listed or not" (1/1) | Pass |
| R12.5 | `test/xsf/build.security.test.ts` › "synthetic: allowed controls" (1/1) | Pass |
| R12.6 | `test/xsf/build.security.test.ts` › "R12.6 oracle" (6/6)<br>`test/golden.samples.test.ts` › (every test in the file) (50/50) | Pass |
| R13.1 | `test/xsf/walk.test.ts` › "unknown entries an unknown element is one entry for its whole subtree, with outer XML and line" (1/1)<br>`test/xsf/unknowns.test.ts` › "an unknown element and an unknown attribute" (2/2)<br>`test/property/p12.property.test.ts` › "500 runs" (1/1) | Pass |
| R13.2 | `test/xsf/walk.test.ts` › "unknown entries an unknown attribute on a modelled element is one entry with its value" (1/1)<br>`test/xsf/walk.test.ts` › "unknown entries comments, processing instructions, whitespace and namespace declarations give nothing" (1/1)<br>`test/property/p12.property.test.ts` › "500 runs" (1/1) | Pass |
| R13.3 | `test/xsf/walk.test.ts` › "unknown entries non-whitespace text in an element-only position is a text entry" (1/1)<br>`test/xsf/walk.test.ts` › "unknown entries an element inside text content is unknown" (1/1) | Pass |
| R13.4 | `test/xsf/walk.test.ts` › "unknown entries enum and yesNo values outside their list are kept and reported as unexpectedValue" (1/1)<br>`test/xsf/ms-ipff2.test.ts` › "known entries runtimeCompatibility is not an enumeration" (1/1)<br>`test/property/p12.property.test.ts` › "500 runs" (1/1) | Pass |
| R13.5 | `test/xsf/walk.test.ts` › "unknown entries comments, processing instructions, whitespace and namespace declarations give nothing" (1/1)<br>`test/xsf/walk.test.ts` › "modelled content rawXml content is kept verbatim as inner XML" (1/1)<br>`test/xsf/walk.test.ts` › "modelled content text content is kept verbatim" (1/1) | Pass |
| R13.6 | `test/unknowns.samples.test.ts` › (every test in the file) (49/49)<br>`test/xsf/walk.samples.test.ts` › (every test in the file) (49/49) | Pass |
| R13.7 | `test/xsf/walk.test.ts` › "unknown entries entries come out in document order" (1/1)<br>`test/xsf/unknowns.test.ts` › "an unknown element and an unknown attribute each appears once, at its path, in document order" (1/1)<br>`test/xsn/parse.test.ts` › "the result unknowns: manifest first, then schema files by name" (1/1) | Pass |
| R13.8 | `test/xsf/walk.test.ts` › "documented follows ms-ipff2.ts" (2/2)<br>`test/xsf/unknowns.test.ts` › "MS-IPFF2 elements left out on purpose report documented: true" (1/1) | Pass |
| R13.9 | `test/xsf/build.repeated.test.ts` › (every test in the file) (9/9)<br>`test/xsf/unknowns.test.ts` › "a second copy of a held-once element" (1/1)<br>`test/property/p12.property.test.ts` › "500 runs" (1/1) | Pass |
| R14.1 | `test/xsd/field-tree.test.ts` › "synthetic kinds: one element per row of the kind table" (1/1)<br>`test/xsd/schema-set.test.ts` › "in-repo samples main schema from rootSchema="yes" and the rootElement file property" (1/1)<br>`test/xsd/schema-set.test.ts` › "in-repo samples form 03: the secondary root is the first global element of locations.xsd" (1/1)<br>`test/golden.samples.test.ts` › (every test in the file) (50/50) | Pass |
| R14.2 | `test/xsd/field-tree.test.ts` › "R14.8 oracle (shape) form 04 line: repeating, raw "0" and "unbounded"" (1/1)<br>`test/xsd/groups.test.ts` › "model groups (group.xsd) cardinality multiplies through the ref; the ref is in raw.groups" (1/1)<br>`test/xsd/field-tree.test.ts` › "R14.8 oracle (required) attributes are never required, even with use="required" (raw.use keeps it)" (1/1) | Pass |
| R14.3 | `test/xsd/field-tree.test.ts` › "R14.8 oracle (shape) form 04 line" (1/1)<br>`test/xsd/field-tree.test.ts` › "R14.8 oracle (shape) form 05: relocation optional" (1/1)<br>`test/xsd/groups.test.ts` › "model groups (group.xsd) cardinality multiplies through the ref" (1/1)<br>`test/counts.samples.test.ts` › (every test in the file) (50/50) | Pass |
| R14.4 | `test/xsd/empty-string.test.ts` › (every test in the file) (50/50)<br>`test/xsd/field-tree.test.ts` › "R14.8 oracle (required)" (6/6)<br>Built-in families, lists, unions and facets in `empty-string.test.ts`; the R14.8 oracle cases in `field-tree.test.ts`. | Pass |
| R14.5 | `test/xsd/field-tree.test.ts` › "R14.8 oracle (shape) form 05: relocation optional, fullTime/contractor one choiceGroup" (1/1)<br>`test/xsd/groups.test.ts` › "model groups (group.xsd) a group inside a choice" (1/1) | Pass |
| R14.6 | `test/xsd/field-tree.test.ts` › "R14.8 oracle (shape) form 05" (1/1)<br>`test/xsd/field-tree.test.ts` › "R14.8 oracle (shape) form 45: signatures1 and signatures2 are groups; signatures2 has one XML-DSig wildcard" (1/1)<br>`test/xsd/field-tree.test.ts` › "every sample" (48/48) | Pass |
| R14.7 | `test/xsd/field-tree.test.ts` › "R14.8 oracle (shape) form 47: borrower through personType; assetTag pattern; assetCondition facets" (1/1)<br>`test/xsd/field-tree.test.ts` › "synthetic extension: base content first; facets base first" (1/1)<br>`test/xsd/groups.test.ts` › "lists (list.xsd)" (1/1)<br>`test/xsd/groups.test.ts` › "unions (union.xsd)" (1/1) | Pass |
| R14.8 | `test/xsd/field-tree.test.ts` › "R14.8 oracle" (11/11) | Pass |
| R15.1 | `test/xsd/field-tree.test.ts` › "synthetic extension" (1/1)<br>`test/xsd/groups.test.ts` › (every test in the file) (13/13)<br>`test/xsd/schema-set.test.ts` › "include and import (synthetic)" (3/3)<br>`test/xsd/schema-set.test.ts` › "in-repo samples form 04: Vendors.xsd imports Vendors1.xsd and Vendors2.xsd" (1/1) | Pass |
| R15.2 | `test/xsd/schema-set.test.ts` › "remote and absolute locations (R15.2)" (10/10)<br>`test/xsd/field-tree.test.ts` › "synthetic an unresolved type or ref keeps the node and records UNRESOLVED_REFERENCE" (1/1) | Pass |
| R15.3 | `test/xsd/field-tree.test.ts` › "synthetic recursion" (1/1)<br>`test/xsd/groups.test.ts` › "model groups (group.xsd) a self-referencing group is cut" (1/1) | Pass |
| R15.4 | `test/xsd/groups.test.ts` › (every test in the file) (13/13)<br>`test/xsd/unknown-constructs.test.ts` › (every test in the file) (11/11) | Pass |
| R15.5 | `test/xsd/schema-set.test.ts` › "in-repo samples form 04" (2/2)<br>`test/xsd/field-tree.test.ts` › "R14.8 oracle (shape) secondary schemas of forms 03 and 04 have attribute nodes" (1/1)<br>`test/xsd/field-tree.test.ts` › "R14.8 oracle (shape) form 47" (1/1)<br>`test/xsd/groups.test.ts` › (every test in the file) (13/13)<br>`test/xsd/unknown-constructs.test.ts` › (every test in the file) (11/11) | Pass |
| R15.6 | `test/unknowns.samples.test.ts` › (every test in the file) (49/49)<br>`test/xsd/schema-set.test.ts` › "in-repo samples every sample: no schema unknowns and no schema issues" (1/1) | Pass |
| R15.7 | `test/xsd/schema-set.test.ts` › "DUPLICATE_GLOBAL (R15.7)" (3/3)<br>`test/xsd/schema-set.test.ts` › "in-repo samples form 04: one table per root" (1/1)<br>`test/xsd/field-tree.test.ts` › "R15.7: form 04 has two myFields trees" (3/3) | Pass |
| R16.1 | `test/counts.samples.test.ts` › (every test in the file) (50/50)<br>One test per README row (47), plus the row/.xsn pairing test. | Pass |
| R16.2 | `test/counts.samples.test.ts` › "the public sample: Views 1, Fields 5, Rules 0, Calcs 1, Checks 0, Repeating/optional 4" (1/1) | Pass |
| R16.3 | `test/counts.samples.test.ts` › "every README row has an .xsn and every .xsn has a row" (1/1)<br>`test/oracles/readme-table.test.ts` › (every test in the file) (11/11) | Pass |
| R16.4 | `test/golden.samples.test.ts` › (every test in the file) (50/50)<br>`test/helpers/snapshot.test.ts` › (every test in the file) (11/11) | Pass |
| R17.1 | `test/browser/worker-parity.browser.test.ts` › "the Worker bundle builds with no Node built-in (R17.1)" (1/1)<br>`test/browser/worker-parity.browser.test.ts` › "the same build fails when an entry imports node:fs" (1/1)<br>`test/lint/restricted.test.ts` › (every test in the file) (8/8) | Pass |
| R17.2 | `test/cab/inflate.spike.test.ts` › (every test in the file) (59/59)<br>`test/browser/inflate.browser.test.ts` › (every test in the file) (50/50)<br>`test/lint/restricted.test.ts` › "packages/core/src restrictions import 'zlib' is an error" (1/1) | Pass |
| R17.3 | `test/browser/worker-parity.browser.test.ts` › (every test in the file) (51/51) | Pass |
| R17.4 | `test/golden.samples.test.ts` › (every test in the file) (50/50)<br>`test/lint/restricted.test.ts` › "packages/core/src restrictions fetch(…) is an error" (1/1)<br>`test/lint/restricted.test.ts` › "packages/core/src restrictions import 'node:fs' is an error" (1/1) | Pass |
| R18.1 | `test/perf/parse.perf.test.ts` › (every test in the file) (50/50) | Pass |
| R18.2 | `test/perf/parse.perf.test.ts` › "08-big-form" (1/1)<br>The test log prints `08-big-form (R18.2): p50 …, p95 …` on its own line. | Pass |
| R19.1 | `test/property/p1.property.test.ts` › "generator bytes" (1/1)<br>`test/property/p1.property.test.ts` › "generator cabinet" (1/1) | Pass |
| R19.2 | `test/property/p1.property.test.ts` › "generator xml" (1/1) | Pass |
| R19.3 | `test/property/p1.property.test.ts` › "generator" (3/3)<br>`test/property/p1.property.test.ts` › "regressions are replayed" (1/1)<br>1,000 runs per generator; `regressions.ts` is replayed every run (empty: no counterexample found). | Pass |
| R20.1 | `test/property/p12.property.test.ts` › "500 runs" (1/1)<br>Covers insertions and the enumerated-value changes added at task 28. | Pass |
| R20.2 | `test/property/p12.property.test.ts` › "500 runs" (1/1)<br>`test/property/p12.property.test.ts` › "every README manifest as it is" (1/1) | Pass |
| R20.3 | `test/property/p12.property.test.ts` › "500 runs" (1/1) | Pass |

## Brief acceptance criteria and P1

| Item | Brief text (short) | Evidence | Result |
|---|---|---|---|
| AC1 | MSZIP: every file byte-identical to `bsdtar -xf`, every `.xsn` in `samples/own/xsn/` and `samples/public/` | R1.1–R1.6: `test/cab/read.samples.test.ts` (47 forms equal `forms/<slug>/`, which equals `bsdtar -xf` output, checked 2026-11-10; the public sample equals the Appendix B SHA-256), `test/golden.samples.test.ts` (R16.4), `test/browser/worker-parity.browser.test.ts` (R17.3) | Pass |
| AC2 | LZX or Quantum: `UNSUPPORTED_COMPRESSION` naming the method | R2.1: `test/cab/unsupported.test.ts` › "compression types (R2.1, R2.2) typeCompress …" | Pass |
| AC3 | not a cabinet, or truncated: `CORRUPT_CAB` and the byte offset | R3.1, R3.2: `test/cab/structures.test.ts` › "… not MSCF is CORRUPT_CAB at offset 0 (R3.1)", `test/cab/corrupt.test.ts` › "truncation of 02-expense-report at every structure boundary (R3.2)" (161 tests); R3.3–R3.8 | Pass |
| AC4 | over 50 MiB decompressed, or over 2,000 entries: `LIMIT_EXCEEDED` | R4.1, R4.2: `test/limits.test.ts` | Pass |
| AC5 | manifest: views and XSL, rule sets, rules and actions, domEventHandlers, calculatedFields, errorConditions, dataObjects and adapters, submit, listProperties, fragmentToInsert, signedDataBlocks, publishUrl/solutionVersion/productVersion/trustLevel, code-behind file names | R8.1, R8.3; R9.1–R9.5; R10.1, R10.2; R11.1–R11.3; R12.1, R12.2, R12.4; R7.1, R7.6 (rows above). Completeness: `test/xsf/vocabulary.coverage.test.ts` (every table entry built with every attribute, 177 tests), R13, R20 | Pass |
| AC6 | field tree: name, namespace, XSD type, raw and effective cardinality, required (as amended 2026-11-10), repeating, optional, kind; `include`, `import`, `ref`, named complex types | R14.1–R14.8, R15.1, R15.5: `test/xsd/field-tree.test.ts`, `test/xsd/groups.test.ts`, `test/xsd/schema-set.test.ts`, `test/xsd/empty-string.test.ts` | Pass |
| AC7 | no external entity resolution, no DTD loading | R5.1, R5.2, R5.7: `test/xml/safety.test.ts` (billion laughs, `file:///etc/passwd`, external DTD, parameter entity all `UNSAFE_XML`; no entity is expanded), `test/xml/prescan.test.ts`; network stubbed to throw in `test/golden.samples.test.ts` | Pass |
| AC8 | each `.xsn` under 300 ms p95 on Node 22 | R18.1, R18.2: `test/perf/parse.perf.test.ts` (fails unless `v22.*`); slowest p95 6.37 ms (`08-big-form`) | Pass |
| P1 | random or mutated bytes up to 2 MiB: a result or a typed `AfterlifeError` within 1 s | R19.1–R19.3: `test/property/p1.property.test.ts`, three generators × 1,000 runs, slowest run 7.4 ms; `INTERNAL` and untyped errors fail the run | Pass |

## Notes

- R4.3 says the largest in-repo cabinet is 19.5 KB: `08-big-form.xsn` is 19,513 bytes. R4.7 says
  at most 9 blocks per folder: the golden files' `cabinet.folders[].blocks` maximum is 9.
- Rows citing `test/golden.samples.test.ts` rely on its 48 golden files holding the full result,
  so any change to the cited oracle values changes a golden file.
- "(every test in the file)" means the cite is every test of that file; the count shows how many.
