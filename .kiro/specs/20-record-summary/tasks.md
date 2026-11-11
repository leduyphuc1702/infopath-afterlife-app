# Spec 20 tasks

- [x] 1. Core: `parts` and `format` in `recordList`; `summarize` and `summaryColumns`
  - Requirements: 2, 3, 4, 5, 6, 9, 11
  - Done when: `test/legacy/summary.test.ts` (form 02, both examples) passes.
- [x] 2. P22 property
  - Requirements: 12
  - Done when: `test/property/p22.property.test.ts` passes (200 runs).
- [x] 3. Worker: `summary` request
  - Requirements: 10
  - Done when: web `tsc` clean; the e2e measure below.
- [x] 4. Page: Summarize panel, pick, CSV
  - Requirements: 1, 6, 7, 8, 9
  - Done when: `e2e/summary.spec.ts` passes at 1280 and 390 px.
- [x] 5. Measure and verify
  - Requirements: 10
  - Done when: 5,000 generated records measured; `pnpm check` and `pnpm e2e:web` green;
    `verification.md` written.
