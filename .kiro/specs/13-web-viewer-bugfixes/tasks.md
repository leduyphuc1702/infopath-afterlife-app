# Spec 13: tasks

Each task: write the regression test, run it on the unfixed code and record the failure in
`verification.md`, then fix and run it again.

- [x] 1. Print the form and the certificate
  - Bugfix: B1
  - Test `e2e/bugfixes.spec.ts` "B1" (two tests); fix `triage.css`, `app.css`, `Paper.tsx`,
    `Certificate.tsx`, `App.tsx` (`data-screen`, caption).
  - Done when: both B1 tests and `e2e/export.spec.ts` print tests pass.
- [x] 2. One history entry per screen change
  - Bugfix: B2
  - Test P13 `test/history.test.ts`, e2e "B2"; fix `src/shell/history.ts`, `restore` in
    `store.ts`, `App.tsx`.
  - Done when: P13 (300 runs) and e2e "B2" pass.
- [x] 3. The same bytes open once
  - Bugfix: B3
  - Test `test/session.test.ts` (P12 and two examples), e2e "B3"; fix `session.ts`,
    `protocol.ts` (`duplicates`), `App.tsx`, `announce.ts`.
  - Done when: P12 (25 runs) and e2e "B3" pass; `triage.spec.ts` "40 templates" uses 40
    distinct forms.
- [x] 4. Show the first record that arrived
  - Bugfix: B4
  - Test `test/store.test.ts`, e2e "B4"; fix `showArrived` in `store.ts`.
  - Done when: they pass and the e2e tests that clicked Next to reach record 1 are updated.
- [x] 5. Menus, focus and title
  - Bugfix: B5, B6, B7
  - Tests e2e "B5", "B6", "B7"; fix `src/shell/menu.ts`, `Header.tsx`, `ExportMenu.tsx`,
    `App.tsx`, `PaperToolbar.tsx` (heading), `Certificate.tsx`, `TriageTable.tsx`.
  - Done when: the three tests pass.
- [x] 6. Narrow screens and announcements
  - Bugfix: B8, B9, B10
  - Tests e2e "B8", "B9", "B10"; fix `TriageTable.tsx`, `triage.css`, `app.css`, `App.tsx`.
  - Done when: the three tests pass.
- [x] 7. Whole suite
  - Done when: `pnpm check` and `pnpm e2e:web` are green.
- [x] 8. Menus inside the viewport
  - Bugfix: B11
  - Test e2e "B11" (two widths); fix `src/shell/menu.ts`, `app.css`.
  - Done when: both B11 tests pass, with the other B tests.
