# Spec 12: Triage and death certificate, phase A — tasks

Requirements: `requirements.md`. Design: `design.md`. Status: **approved, 2026-11-11**.

"Green" means the task's command plus `pnpm check`.

- [x] 1. Core: coverage table and `classify`
  - `packages/core/src/coverage/` (`table.ts`, `classify.ts`), exported from `src/index.ts`;
    `structure.md` gains `src/coverage/`; lint rules extended to it (R7.2).
  - `test/coverage/classify.test.ts`, `test/coverage/table-doc.test.ts`,
    `test/property/p11.property.test.ts`.
  - Requirements: R1.1–R1.4, R7.2
  - Done when: `pnpm --filter @afterlife/core exec vitest run --project node test/coverage test/property/p11.property.test.ts` green.

- [x] 2. Core: causes and record evidence
  - `src/triage/catalogue.ts`, `causes.ts`, `record.ts` (`recordEvidence`).
  - `test/triage/causes.test.ts`, `test/property/p9.property.test.ts`.
  - Requirements: R2.1–R2.4, R6.2
  - Done when: `vitest run --project node test/triage/causes.test.ts test/property/p9.property.test.ts` green.

- [x] 3. Core: rows, waves, order, CSV
  - `src/triage/triage.ts`, `wave.ts`, `csv.ts`.
  - `test/triage/triage.test.ts` (golden), `test/triage/csv.test.ts`,
    `test/property/p8.property.test.ts`, `test/property/p10.property.test.ts`.
  - Requirements: R3.1–R3.6, R5.1 (core), R6.1
  - Done when: `vitest run --project node test/triage test/property/p8.property.test.ts test/property/p10.property.test.ts` green.

- [x] 4. Private-corpus run
  - `test/triage-private.local.test.ts`; run it once with the human's variable set; counts into
    `verification.md`; propose table changes for any `[VERIFY]` row the counts settle.
  - Requirements: R8.1
  - Done when: skipped without the variable; with it, exit 0 and counts only.
  - `Changed at review (2026-11-11):` written and checked skipped; the human runs it on the
    private corpus and reports the counts for `verification.md`. File names are replaced by an
    index before triage, so nothing from the corpus can reach the output.

- [x] 5. Worker: triage in the session, progress, CSV request
  - `src/worker/protocol.ts`, `session.ts`, `client.ts`.
  - `test/protocol.browser.test.ts` gains the progress and CSV cases.
  - Requirements: R4.4, R5.1 (Worker)
  - Done when: `pnpm --filter web test` green.

- [x] 6. Triage screen
  - `src/triage/TriageTable.tsx`, `waves.ts`, `triage.css`, store `screen`; spec 09 R1.3 note.
  - `Changed in task 6:` `waves.ts` is `words.ts` (wave rules, workflow line, Emulated tooltip,
    cause titles, `shortPath`), checked equal to core's strings by `test/words.test.ts`.
    `TemplateList.tsx` is removed; the header's "Triage" button goes back from a form.
  - `e2e/triage.spec.ts` (table, tooltip, keyboard, unknown record counts).
  - Requirements: R4.1, R4.2, R6.1
  - Done when: `pnpm --filter web test && pnpm --filter web e2e` green.

- [x] 7. Death certificate
  - `src/triage/Certificate.tsx`; "Open form" and the way back.
  - `e2e/triage.spec.ts` gains the certificate cases.
  - Requirements: R2.3, R4.3
  - Done when: `pnpm --filter web e2e` green.

- [x] 8. Export plan
  - `ExportMenu.tsx`, `PrintPlan.tsx`, print CSS.
  - `e2e/export.spec.ts` (CSV download, no request or violation; one page on A4 and Letter).
  - Requirements: R5.1, R5.2
  - Done when: `pnpm --filter web e2e` green.

- [x] 9. Copy, offline, performance, "Triage all samples"
  - R4.5: forms 43–47 into `plugins/samples.ts` (templates only); the landing button; measure the
    samples chunk (budget at most 150 KB if over 120 KB, reason in spec 09 design §7).
  - `test/copy.test.ts`; `e2e/offline.spec.ts` Triage case; the 40-template measurement;
    screenshots (Triage, certificate, print preview) at 1280×800.
  - Requirements: R3.7, R4.5, R7.1, R7.3
  - Done when: `pnpm --filter web test && pnpm --filter web e2e` green.

- [x] 10. Verification
  - Re-check every criterion; `verification.md`; `docs/feature-coverage.md` rows J (Triage, death
    certificate) and the coverage-classification note; README Status row.
  - Requirements: all
  - Done when: `pnpm check && pnpm e2e:web` green.

## Coverage check

| Requirement | Tasks |
|---|---|
| R1.1–R1.4 | 1 |
| R2.1–R2.4 | 2 |
| R2.5 | review fixes before task 8 |
| R3.1–R3.6 | 3 |
| R3.7 | 9 |
| R4.1, R4.2 | 6 |
| R4.3 | 7 |
| R4.4 | 5 |
| R4.5 | 9 |
| R5.1 | 3, 5, 8 |
| R5.2 | 8 |
| R6.1 | 3, 6 |
| R6.2 | 2 |
| R7.1, R7.3 | 9 |
| R7.2 | 1 |
| R8.1 | 4 |
