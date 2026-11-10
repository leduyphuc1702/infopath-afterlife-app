# Spec 09: standalone web viewer, phase A — tasks

Requirements: `requirements.md`. Design: `design.md`. Status: **approved, 2026-11-11**.

Every task from 3 on leaves `pnpm --filter web build` producing a working, shippable `dist`.
"Green" means the task's command plus `pnpm check` (which runs `test:web` from task 1).

- [x] 1. Harness: `apps/web` scaffold, shared host helpers, CSP, guards
  - `apps/web`: `package.json` (React 18.3.1, `@vitejs/plugin-react` 6.3.0, `@atlaskit/tokens`
    20.11.0, `@fontsource/carlito` 5.3.0, `@playwright/test` 1.65.0, all exact), `tsconfig.json`
    (strict), `vite.config.ts`, `vitest.config.ts` (node + browser), `playwright.config.ts`, a
    placeholder `App.tsx`.
  - `packages/core/host/vite.ts` and `host/carlito.ts` (design D3), package exports; core's
    `test/helpers/xsltjs-stubs.ts` and `test/browser/carlito.ts` become imports of them.
  - `plugins/csp.ts` (meta at build, `_headers`), `test/csp.test.ts`; lint rule: type-only core
    imports outside `src/worker/`; `e2e/fixtures.ts` with the three guards; root scripts.
  - Measure `setGlobalTheme` (D5) and `base: './'` (§8); record both in `design.md`.
  - Requirements: R8.2, R10.1 (harness)
  - Done when: `pnpm check` green (core's 337 browser tests unchanged), and
    `pnpm --filter web build && pnpm --filter web e2e` passes a smoke test (page loads, no
    violation, no foreign request).

- [x] 2. Core: `matchRecord` and P14
  - `packages/core/src/xsn/match.ts`, exported from `src/index.ts` with its types.
  - Requirements: R2.1, R2.2, R11.1
  - Done when: `pnpm --filter @afterlife/core exec vitest run --project node test/xsn/match.test.ts test/property/p14.property.test.ts` green.

- [x] 3. Walking skeleton: "Try a sample" for form 02, from the Worker, in `dist`, under the CSP
  - `src/worker/` (protocol, session, client with watchdog), `plugins/samples.ts`, `Paper.tsx`
    (shadow root), `shell/fonts.ts`, `shell/theme.ts`, a minimal header with "Try a sample".
  - `test/protocol.browser.test.ts`; `e2e/paper.spec.ts` first case (sample 02 renders, its
    marks count equals core's golden) and the core baseline comparison (R3.3).
  - First Lighthouse run (R9.1), scores noted in `design.md` §7.
  - `Changed in task 3:` a minimal Previous/Next record pager came forward from task 4, because
    R3.3's oracle is form 02's first record (the template's own empty form holds a blank expense
    row that core's `-000-empty.xml` baseline does not).
  - Requirements: R3.1 (default view), R3.3, R7.1, R9.1 (first measure)
  - Done when: `pnpm --filter web test && pnpm --filter web e2e` green.

- [x] 4. Open files, record matching, pager and views
  - `files/collect.ts`, `store.ts`, `messages.ts`, `ErrorBanner.tsx`, `TemplateList.tsx`,
    `Unmatched.tsx`, `PaperToolbar.tsx`, `Landing.tsx`.
  - `test/messages.test.ts`; `e2e/open.spec.ts`; the rest of `e2e/paper.spec.ts`.
  - Requirements: R1.1, R1.2, R1.3, R2.1, R2.2, R3.1, R3.2
  - Done when: `pnpm --filter web test && pnpm --filter web e2e` green.

- [x] 5. Field tree and markers
  - `side/tree.ts`, `side/markers.ts`, `FieldTree.tsx` (ARIA tree, roving `tabindex`).
  - `test/tree.test.ts`, `test/markers.test.ts`.
  - Requirements: R4.1, R4.2
  - Done when: `pnpm --filter web test` green.

- [x] 6. X-ray
  - `paper/geometry.ts`, `XrayOverlay.tsx`, `side/card.ts`, `DetailsCard.tsx`, the X-ray switch.
  - `test/geometry.browser.test.ts` (scroll, resize, font load; marks ↔ elements on forms 01–08;
    inert hit-through), `test/card.test.ts`, `e2e/xray.spec.ts`.
  - Requirements: R5.1, R5.2, R5.3
  - Done when: `pnpm --filter web test && pnpm --filter web e2e` green.

- [x] 7. Data connections panel
  - `side/connections.ts`, `Connections.tsx`, the "Fields" | "Data connections" tabs.
  - `test/connections.test.ts`.
  - `Changed in task 7:` the component is `DataConnections.tsx` (a case clash with
    `connections.ts` on macOS), the tabs are `SideTabs.tsx`, and `e2e/connections.spec.ts` checks
    the links: card → panel entry, panel field → tree.
  - Requirements: R6.1
  - Done when: `pnpm --filter web test` green.

- [x] 8. Trust: offline, hostile input, Worker CSP
  - Warm-up and `data-ready` (D7); `e2e/offline.spec.ts`; `e2e/hostile.spec.ts`.
  - Check whether the Worker gets the page's `<meta>` policy (design §6) and record it.
  - `Changed in task 8:` the check is `e2e/worker-csp.spec.ts` (it does not; design §6). D7's
    offline font note under the paper is in `shell/fonts.ts` and tested in `e2e/offline.spec.ts`.
  - Requirements: R8.1, R8.2, R8.3
  - Done when: `pnpm --filter web e2e` green.

- [x] 9. Look, notices, budget, workflow
  - Tokens everywhere, dark mode, the sepia fade, sentence-case copy pass, `Notices.tsx`,
    `plugins/notices.ts`, README "Third-party licences" rows, `.github/workflows/web-pages.yml`.
  - `test/style.test.ts`, `test/notices.test.ts`, `test/budget.test.ts`, `e2e/keyboard.spec.ts`,
    the fade cases of `e2e/paper.spec.ts`.
  - `Changed in task 9:` `notices.html` is a static page the build writes (same CSP), so
    `Notices.tsx` is the footer that links to it; `pnpm --filter web test` builds first, because
    the `dist` tests (samples, notices, budget, CSP) read it.
  - Requirements: R7.2, R9.2, R9.3, R10.1, R10.2
  - Done when: `pnpm --filter web test && pnpm --filter web e2e` green.

- [x] 10. Verification
  - Re-check every criterion; second Lighthouse run; `verification.md` with each oracle's
    output; `Status` in `docs/feature-coverage.md` for the viewer rows.
  - Requirements: all
  - Done when: `pnpm check && pnpm --filter web e2e` green and Lighthouse ≥ 90 on both categories.

## Coverage check

| Requirement | Tasks |
|---|---|
| R1.1, R1.2, R1.3 | 4 |
| R2.1, R2.2 | 2, 4 |
| R3.1 | 3, 4 |
| R3.2 | 4 |
| R3.3 | 3 |
| R4.1, R4.2 | 5 |
| R5.1, R5.2, R5.3 | 6 |
| R6.1 | 7 |
| R7.1 | 3 |
| R7.2 | 9 |
| R8.1, R8.3 | 8 |
| R8.2 | 1, 8 |
| R9.1 | 3, 10 |
| R9.2, R9.3 | 9 |
| R10.1 | 1, 9 |
| R10.2 | 9 |
| R11.1 | 2 |
