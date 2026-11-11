# Spec 15 tasks

- [x] 1. Words in core
  - Move the Rule Trace wording to `packages/core/src/dossier/words.ts`; add the static
    sentences. Requirements: R2.1. Done when: `trace-words.test.ts` passes unchanged.
- [x] 2. Dossier and Markdown
  - `buildDossier`, `dossierMarkdown`, escaping. Requirements: R1.1–R1.6, R2.2, R3.4.
  - Done when: `test/dossier/dossier.test.ts` passes (P19, escaping property).
- [x] 3. Worker
  - `documentation`, `documentationZip`. Requirements: R3.3. Done when: a session test reads
    the zip back with `readZip`.
- [x] 4. Screen
  - Documentation screen, buttons on the form, certificate and Triage, print CSS.
    Requirements: R3.1–R3.3. Done when: `e2e/dossier.spec.ts` passes; budgets pass.
- [x] 5. Verification
  - `verification.md`; P19 in `testing.md`. Done when: `pnpm check` and `pnpm e2e:web` green.
