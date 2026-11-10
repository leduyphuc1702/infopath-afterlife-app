# Tasks: 02 FormIR

Phase 3 of 3. Requirements: `requirements.md` (approved 2026-11-10). Design: `design.md`
(approved). Status: **approved 2026-11-10** (checkpoint `89930d3`).

Changed at review (2026-11-10): tasks 6 and 7 gain fixtures for the private-corpus view shapes
(ExpressionBox expressions, `GetDOM` bindings, `xctname` case, ActiveX attribute value templates,
group bindings, `xd:server`); task 13 prints unresolved counts by reason and `xctname`.

## How every task is run and checked

As spec 01 (`tasks.md`, "How every task is run and checked"): Node 22.23.4 via
`PATH=/opt/homebrew/opt/node@22/bin:$PATH`, `pnpm check` green before a task is ticked, paths
relative to `packages/core/`, one task at a time, no commits. Prettier runs from the repo root on
the changed files only. Golden FormIR files go to `test/golden/formir/`; each regeneration is
reported as a key-level diff. Tasks are grouped in batches of three (1–3, 4–6, 7–9, 10–12, 13–14);
every task ends green, so every batch does.

## Tasks

- [x] 1. Types, ids and JSON
  - `src/ir/types.ts` (design §5), `src/ir/ids.ts` (§4: field, group, manifest and view ids,
    compact paths, the `#n` suffix with `DUPLICATE_ID`), `src/ir/json.ts` (§9: `serialiseFormIR`,
    `parseFormIR` with `INVALID_IR` and `UNSUPPORTED_IR_VERSION`); new error and issue codes in
    `src/errors.ts`; exports in `src/index.ts` (`buildFormIR` is a stub that throws `INTERNAL`
    until task 2).
  - Tests: `test/ir/ids.test.ts` (the §4 worked examples, prefix choice, `{uri}local`, no
    namespace, attributes, the suffix); `test/ir/json.test.ts` (key order, refusals, every error
    path on a hand-built FormIR, `__proto__` in `attrs`).
  - Requirements: R13.1 (serialiser), R13.2 (id functions), R14 (error cases).

- [x] 2. Build skeleton: meta, fields and groups, pass-through
  - `src/ir/build.ts` (pipeline of §3.2 with stages 3–7 empty), `src/ir/meta.ts`,
    `src/ir/data-tree.ts` (fields, groups, data paths, `NameIndex`). Labels are the Title Case
    name (step 8) until task 8.
  - Tests: `test/ir/meta.test.ts` (R2 oracles, generation unit cases); `test/ir/data-tree.test.ts`
    (form 04 two `myFields` roots, form 01 `reason`, form 04 `line`, README Fields and
    Repeating/optional for every row through `test/oracles/readme-table.ts`);
    `test/ir/build.test.ts` (unknowns deep-equal for the spec 01 synthetic fixtures, spec 01
    issues first, synthetic `ParsedTemplate` with no main schema).
  - Requirements: R1.1, R1.3, R2, R3, R10.

- [x] 3. Rules, calculations, validations, code-behind, signatures
  - `src/ir/elements.ts` (stage 3), with `PendingExpr` records for stage 7.
  - Tests: `test/ir/elements.test.ts` (README Rules, Calcs, Checks per row; 8 triggers; form 01
    `endDate` two validations; `errorBlank` and signature-line synthetic fixtures; forms 45, 46, 47).
  - Requirements: R6, R7, R9.

- [x] 4. Endpoints, liveness and redaction
  - `src/ir/endpoints.ts` (design §8).
  - Tests: `test/ir/endpoints.test.ts`: one case per liveness row and its boundary
    (`172.15.0.1`, `172.32.0.1`), UNC, drive letters, `file:`, connection-string forms (`tcp:`,
    `,port`, `\instance`, quoted values), redaction of `Password` and `Pwd` with the rest kept byte
    for byte.
  - Requirements: R8.2, R8.3, R8.4.

- [x] 5. Data connections
  - `src/ir/connections.ts` (stage 4): every adapter, `isQuery`/`isSubmit`, children, endpoints,
    `credentialRedacted`, submit-value `PendingExpr`s; `meta.publishEndpoint`.
  - Tests: `test/ir/connections.test.ts` (forms 01, 02, 03, 04, 07, 44, 46; the R8.3 sample
    oracle: 46 `publishUrl`s internal, forms 43 and 44 unknown; spec 01 synthetic SharePoint and
    connectoid fixtures; every sample `credentialRedacted: false`).
  - Requirements: R8.1, R8.2, R8.3, R8.4.

- [x] 6. XPath tokenizer and resolver
  - `src/ir/xpath/tokens.ts`, `src/ir/xpath/resolve.ts` (design §7.1–§7.3).
  - Tests: `test/ir/xpath-tokens.test.ts` (`div`, `mod`, `and` as operators and as names, `*` both
    ways, literals, nested predicates, `GetDOM`, `current()`, `xdMath:Eval`);
    `test/ir/xpath-resolve.test.ts` (one case per unresolved reason; prefix scope from a manifest
    map and from an XSL element; a `GetDOM("src")/z:row/@ows_x` binding with `z` from the XSL
    scope; an ExpressionBox-style expression `xdMath:Avg(<repeating path>)` and `string("…")`
    with no path).
  - Requirements: R11.1, R11.2, R11.4.

- [ ] 7. View scan
  - `src/ir/views/scan.ts` (design §6.1): contexts, bound controls, `choicesFrom`, ActiveX,
    `viewXmlBytes`; `FormIROptions`.
  - Fixtures: `test/fixtures/synthetic/views/` (a mode called twice, a mode never called,
    `call-template`, a missing view, a view that is not well-formed, an unbound `object`; and, for
    the private-corpus shapes: an ExpressionBox over a repeating field and one over a string
    literal, a text box bound into a secondary source with `GetDOM`, `DropDown` next to
    `dropdown`, an ActiveX object with `{{…}}` in `xd:xctname`, a dynamic `title`, a group
    binding with `xd:boundProp="xd:inline"` and an `xd:server` on a single-label host), written
    for this project.
  - Tests: `test/ir/view-scan.test.ts` (707 of 707 bindings resolve, 0 issues; form 02 `my:amount`;
    form 03 and 04 `choicesFrom`; form 44 ActiveX; each synthetic case, including read-only
    `readBy`-only references, `dynamicAttrs`, a group `targetId` and the `xd:server` endpoint
    `internal`/`singleLabel`; the limit as an option).
  - Requirements: R4, R15 (limit).

- [ ] 8. Labels
  - `src/ir/views/labels.ts` (stage 6, requirements R5.1 steps 1–8, option-button rule).
  - Fixtures: `test/fixtures/synthetic/views/labels/`, one per R5.4 layout, our own wording.
  - Tests: `test/ir/labels.test.ts` (each fixture: label, `labelSource`, `labelEvidence`);
    `test/ir/labels.samples.test.ts` (forms 01–08 default views 290 of 290; the four `labelSource`
    counts over 606 fields; public sample `Date`, `Weight`). If the counts differ from R5.1,
    stop and report.
  - Requirements: R5.

- [ ] 9. Dependency index and FormIR golden files
  - `src/ir/dependencies.ts` (stage 7, design §7.4): references, `readBy`/`writtenBy`,
    `unresolvedRefs`, lineage.
  - Tests: `test/ir/dependencies.samples.test.ts` (1,566 of 1,566; form 04 `grandTotal`; form 03
    `destCountry`; 0 unresolved, 0 issues); `test/ir/golden.samples.test.ts` (one golden file per
    sample; built twice gives equal JSON; ids unique; forms 01 and 07 share common field ids;
    every expression string equals its spec 01 source, R1.2; every sample has zero FormIR issues).
  - Requirements: R11.3, R11.5, R1.2, R1.3, R13.2, R13.3.

- [ ] 10. Property P6: JSON round trip
  - Test: `test/property/p6.property.test.ts` (generator of design §10; 500 runs; the 48 golden
    FormIRs round-trip; `serialise(parse(s)) === s`).
  - Requirements: R14.

- [ ] 11. Property P13: dependency completeness
  - Test: `test/property/p13.property.test.ts` (generator of design §10; 500 runs).
  - Requirements: R12.

- [ ] 12. Worker parity, performance and purity
  - Extend `test/browser/worker-parity.browser.test.ts` to build FormIR in the Worker and compare
    with the golden files; add `test/perf/formir.perf.test.ts` (`parseXsn` + `buildFormIR`, 20
    runs, p95 under 300 ms, form 08 reported); extend `test/lint/restricted.test.ts` to
    `src/ir/**`.
  - Requirements: R13.1, R15, R1.1 (purity).
  - Done when: `pnpm check` and `pnpm test:perf` green.

- [ ] 13. Local private check
  - Extend `test/private-corpus.local.test.ts` (design §10): `buildFormIR` returns for every file;
    `afterAll` prints FormIR issue codes, generations, `labelSource` counts, and
    `UNRESOLVED_BINDING` and `UNRESOLVED_REFERENCE` counts by reason and by `xctname`. Run once
    with `AFTERLIFE_PRIVATE_SAMPLES=$HOME/Desktop/infopath-afterlife/samples` and paste the lines.
    The aim is 0 for the review shapes; if anything else remains, list it (shapes and counts only)
    and stop, without modelling more.
  - Requirements: R1.4.

- [ ] 14. Verification pass
  - Clean install in an empty copy of the tracked files, as spec 01 task 34: `pnpm check`,
    `pnpm test:perf`, and the local check.
  - Write `verification.md` in spec 01's style: commands and results, one row per criterion
    R1.1–R15.1 with its passing tests, the brief items (AC1–AC5, P6, completeness), the final
    pass count.
  - `docs/feature-coverage.md`: add `ir: spec 02` to the Status of rows FormIR now carries
    (dependency map, data lineage, dead-connection check inputs, label guess).
  - Requirements: all (re-check).
  - Done when: `pnpm check`, `pnpm test:perf` and the local check green; every row passes.

Unless a task says otherwise, it is done when `pnpm check` is green.

## Coverage check

| Requirement | Tasks |
|---|---|
| R1.1 | 2, 12 |
| R1.2 | 9 |
| R1.3 | 2, 9 |
| R1.4 | 13 |
| R2.1, R2.2 | 2 |
| R3.1, R3.2, R3.3 | 2 |
| R4.1–R4.5 | 7 |
| R5.1–R5.4 | 8 |
| R6.1, R6.2 | 3 |
| R7.1, R7.2 | 3 |
| R8.1 | 5 |
| R8.2, R8.3, R8.4 | 4, 5 |
| R9.1, R9.2 | 3 |
| R10.1 | 2 |
| R11.1, R11.2, R11.4 | 6 |
| R11.3, R11.5 | 9 |
| R12.1 (P13) | 11 |
| R13.1 | 1, 12 |
| R13.2 | 1, 9 |
| R13.3 | 9 |
| R14.1 (P6) | 1, 10 |
| R15.1 | 7, 12 |

Every requirement id appears at least once; task 14 re-checks all of them. **Total: 14 tasks.**
