# Spec 04 tasks: Classic runtime

Every task ends with the app working and `pnpm check` green. Test first where a test is named.

- [ ] 1. Expression evaluator and function table
  - `runtime/evaluate.ts`, `runtime/functions.ts` (D5–D8), on `xpath` and `xpath-fns`.
  - Requirements: R3.1, R3.2, R3.3, R3.4
  - Done when: `test/runtime/evaluate.test.ts` covers every function in D6, an unknown function,
    `GetDOM` on forms 03 and 04.
- [ ] 2. `FillSession` and the change cycle; P7, P18
  - `runtime/session.ts`, `runtime/graph.ts` (D9–D11), `runtime/cycle.ts` (D12–D14); onLoad
    (E3); P18 added to `testing.md`.
  - Requirements: R1.1, R1.2, R1.4, R2.1, R2.2, R2.3, R11.1, R11.2
  - Done when: `cycle.test.ts` (form 02 total, form 04 chain in rows, form 01 onLoad, loop
    entry), P7 300 runs, P18 100 runs green.
- [ ] 3. Calculation oracle and the cycle budget in Node
  - `test/runtime/calc-oracle.test.ts` (E1), `test/perf/fill.perf.test.ts` (forms 04, 08).
  - Requirements: R11.3, R2.4
  - Done when: matches counted over the 95 records, every mismatch listed with its expression
    and explained; p95 logged.
- [ ] 4. Validation and its oracle
  - `runtime/validate.ts` (D16): required, types, facets, errorConditions.
  - Requirements: R5.1, R11.4
  - Done when: `validate.test.ts` (one case per kind) and `validate-oracle.test.ts` over every
    own record green; invalid records listed.
- [ ] 5. Worker protocol
  - `fillOpen`, `fill`, `fillClose`, `download` in `protocol.ts`, `session.ts`, `worker.ts`,
    `client.ts`; codes `FILL_PATH`, `FILL_STATE` (§9).
  - Requirements: R1.3, R1.5, R8.1
  - Done when: `apps/web/test/session.test.ts` fills form 02 through the Worker session and
    downloads bytes that `matchRecord` matches to the template.
- [ ] 6. Fill toggle and editing on the paper
  - `paper/fill.ts`, toolbar toggle, not-`inert` root, text, dropdown, check box, option button,
    date (D21), read-only controls (D23), focus restore (D22), invalid styling and summary line
    (D17).
  - Requirements: R5.2, R5.3, R6.1, R6.2, R6.3, R6.4
  - Done when: e2e on form 02: type an amount, Total updates, focus stays; a blank name shows
    the dashed border and its message; X-ray still works.
- [ ] 7. Download XML and reopen
  - "Download XML" with processing instructions, file name, count of invalid fields; leave-Fill
    prompt (D24).
  - Requirements: R5.4, R8.1, R8.2, R8.3, R11.5
  - Done when: e2e downloads form 02 after edits, drops the file back, sees it matched and the
    same values; the request guards see nothing; Worker p95 logged for R2.4.
- [ ] 8. Fragments in FormIR and row marks in render
  - `IrGroup.insert` from `xmlToEdit`/`fragmentToInsert` (spec 02 builder, D18); row,
    optional and collection marks (spec 03 marks, D20); goldens of both specs re-run.
  - Requirements: R7.1, R7.3
  - Done when: FormIR of the 17 forms with fragments carries them; spec 02 and 03 suites green
    with reviewed golden changes only.
- [ ] 9. Repeating rows and optional sections; P3
  - `insertRow`, `removeRow`, `insertOptional`, `removeOptional` (D19); "Insert item" and the
    row menu on the paper.
  - Requirements: R7.1, R7.2, R7.3, R7.4
  - Done when: P3 200 runs; e2e on form 02 inserts and removes an expense row and the Total
    follows; form 05's optional section inserts and removes.
- [ ] 10. Rules, buttons and dialogs
  - `runtime/rules.ts` (D15), `press`, `switchView`, `<dialog>` for messages, notices for
    submit and close.
  - Requirements: R4.1, R4.2, R4.3, R4.4
  - Done when: `rules.test.ts` (form 03 clear city, form 04 buttons and skipped query, form 05
    view switches); e2e clicks form 04 "Check approval" and sees the dialog.
- [ ] 11. Rule Trace tab
  - Side tab, entry list (D25), field filter, hover outline, 500-entry cap.
  - Requirements: R9.1, R9.2
  - Done when: e2e on form 04: an edit shows the calculation chain in order with before and
    after values; hovering outlines the field; the filter keeps one field.
- [ ] 12. Undo and redo
  - Snapshot stack (D26), keys and toolbar buttons.
  - Requirements: R10.1
  - Done when: unit (cap, redo cleared) and e2e (type, undo, redo on form 02).
- [ ] 13. Verification and docs
  - `verification.md`; `docs/feature-coverage.md` rows for rules, calculations, validation,
    repeating, Rule Trace; README status row and section; budgets re-read.
  - Requirements: all
  - Done when: `pnpm check` and `pnpm e2e:web` green; R2.4 numbers written into the requirement.

| Requirement | Tasks |
|---|---|
| R1.1, R1.2, R1.4 | 2 |
| R1.3, R1.5 | 5 |
| R2.1–R2.3 | 2 |
| R2.4 | 3, 7 |
| R3.1–R3.4 | 1 |
| R4.1–R4.4 | 10 |
| R5.1 | 4 |
| R5.2, R5.3 | 6 |
| R5.4 | 7 |
| R6.1–R6.4 | 6 |
| R7.1, R7.3 | 8, 9 |
| R7.2, R7.4 | 9 |
| R8.1 | 5, 7 |
| R8.2, R8.3 | 7 |
| R9.1, R9.2 | 11 |
| R10.1 | 12 |
| R11.1, R11.2 | 2 |
| R11.3 | 3 |
| R11.4 | 4 |
| R11.5 | 7 |
