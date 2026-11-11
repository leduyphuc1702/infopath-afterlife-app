# Spec 19 tasks

- [x] 1. Look: seven journeys through the MCP server; findings F1–F5 in `bugfix.md`, the record in `docs/kiro/mcp.md`
  - Done when: each finding has steps, expected, actual and the element.
- [x] 2. Core: list, archive, sanitiser, dossier
  - Bugfix: A1, A3, A4, R2, R3, P3, P4, F1
  - Done when: `test/bugfixes19.test.ts` and P21 on rich text pass.
- [x] 3. Page: Records, menus, focus, print, trace
  - Bugfix: A2, R1, R4, R5, P1, P2, P5, F2, F3, F4, F5
  - Done when: `e2e/bugfixes19.spec.ts`, `trace-keep.test.ts`, `records-find.test.ts` pass.
- [x] 4. Time limits
  - Bugfix: T1
  - Done when: the seven named core files pass under load; render-perf measures again once.
- [x] 5. Verification
  - Done when: `pnpm check` and `pnpm e2e:web` green; `verification.md` written.
- [x] 6. Leftovers after review
  - Bugfix: T2, R6
  - Done when: `bugfixes16.test.ts` passes ten runs in a row; e2e R6 passes.
