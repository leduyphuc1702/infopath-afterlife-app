# Spec 18 tasks

- [x] 1. Core `archiveRecords`, with P21
  - Requirements: R2–R7, R9
  - Done when: `packages/core/test/legacy/archive.test.ts` passes (form 02, P21 100 runs);
    P20 and P21 are in `.kiro/steering/testing.md`.
- [x] 2. Worker request, cancel
  - Requirements: R8, R10
  - Done when: `tsc` passes and the e2e of task 3 reaches the Worker.
- [x] 3. "Archive as web pages" on the form and Records screens
  - Requirements: R1, R8, R9
  - Done when: `e2e/archive.spec.ts` passes: download, contents, Records order, Cancel.
- [x] 4. Measure and verify
  - Done when: 30 and 1,000 records measured in `verification.md`; `pnpm check` and
    `pnpm e2e:web` green.
