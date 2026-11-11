# Spec 17 tasks

- [x] 1. Core `recordList` and `viewFormats`
  - Requirements: R2, R3, R4, R12
  - Done when: `packages/core/test/legacy/list.test.ts` passes on forms 02 and 10.
- [x] 2. `findRows` and the walk, with P20
  - Requirements: R5, R7, R10
  - Done when: `apps/web/test/records-find.test.ts` passes (P20, 200 runs).
- [x] 3. Worker request and the Records screen
  - Requirements: R1, R2, R5–R9, R11, R12
  - Done when: `e2e/records.spec.ts` passes for find, sort, open, back and keyboard.
- [x] 4. Previous and Next on the found list
  - Requirements: R10
  - Done when: the e2e walk test passes.
- [x] 5. Measure and verify
  - Requirements: R11
  - Done when: 5,000-record e2e passes, times in `verification.md`; `pnpm check` and
    `pnpm e2e:web` green.
