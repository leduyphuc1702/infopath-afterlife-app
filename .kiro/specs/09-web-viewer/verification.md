# Verification: spec 09 web viewer, phase A

Evidence that the spec was met, written at task 10. Each row names the passing tests that prove a
criterion; a criterion with no passing test is not met.

- **Date:** 2026-11-11, 02:55 +07:00.
- **Runtime:** Node v22.23.4, pnpm 12.18.0, `@playwright/test` 1.65.0 with Playwright Chromium
  (HeadlessChrome 158), macOS (Apple silicon).
- **Tree:** commit `8fc5af3` plus the uncommitted task 9 and 10 work (notices, budget, style,
  keyboard and fade tests, the landing copy, the workflow, the README rows, this file).
- **Not checked here:** the GitHub Pages workflow was written, not run (R10.2: the agent never
  runs it); `actionlint` is not installed. The site is not published.

## Commands and results

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile --offline` | exit 0; lockfile up to date |
| `pnpm check` (typecheck, lint, format check, core node, core browser, `test:web`) | exit 0; core node 90 files passed, 2 skipped (`AFTERLIFE_PRIVATE_SAMPLES` unset), 3,664 tests passed; core browser 12 files, 337 tests passed; web 12 files, 78 tests passed |
| `pnpm e2e:web` (builds, then `vite preview --base /infopath-afterlife-app/`) | exit 0; 27 passed, among them `smoke.spec.ts` › "the guards fail a test when the page breaks the CSP", a `test.fail` that is expected to fail and does |
| `pnpm --filter @afterlife/core exec vitest run --project node test/xsn/match.test.ts test/property/p14.property.test.ts` | 2 files, 8 tests passed |
| `npx lighthouse@13.6.0 http://localhost:4321/infopath-afterlife-app/ --preset=desktop --only-categories=performance,accessibility` (against `vite preview` under the sub-path, `CHROME_PATH` = Playwright's Chromium 158) | performance **100** (FCP 0.2 s, LCP 0.2 s, TBT 0 ms, CLS 0), accessibility **100**; report `/tmp/afl-web/lh-task10.json` |

Oracle lines printed by the runs:

```
R3.3: 0 of 558885 pixels differ
R7.2: 8 packages: @atlaskit/tokens, @fontsource/carlito, @xmldom/xmldom, react, react-dom, scheduler, xpath, xsltjs
R8.3: seed 20261111, 20 inputs: {"opened":20,"refused":0,"rendered":38,"renderFailed":2}; canary 0, dialogs 0, requests 0, violations 0
R10.1 (KB): entry 66.2 / 100, theme chunks 0 / 0, worker 123.1 / 160, samples 93.8 / 120, Latin fonts 120.3 raw / 260
```

`renderFailed` 2 is hostile input 16, whose XSL makes the engine raise `NamespaceError`; the view
shows the `RENDER_FAILED` message, which is R1.3's safe outcome, for both its empty form and its
record.

## Criteria

| Id | Evidence (all passing) | Result |
|---|---|---|
| R1.1 | `e2e/open.spec.ts` › "a template, three records and a text file…", "files dropped on the page open"; `offline.spec.ts` (files opened while offline) | Pass |
| R1.2 | `e2e/open.spec.ts` › "a damaged template gets a three-part message; the other template still opens"; `test/messages.test.ts` (18: every core and app code has three non-empty parts) | Pass |
| R1.3 | `e2e/open.spec.ts` › "forms 01 and 07 with all their records: two templates, 30 and 10 records" | Pass |
| R2.1 | `packages/core/test/xsn/match.test.ts` (7); `e2e/open.spec.ts` › "forms 01 and 07…" | Pass |
| R2.2 | `e2e/open.spec.ts` › "form 07 alone takes 01's records as another version", "records with no open template, and plain XML, are listed with their reasons" | Pass |
| R3.1 | `test/protocol.browser.test.ts` › "sample 02: session, then the default view, equal to core on the page"; `e2e/paper.spec.ts` › sample 05 (3 views), sample 03 (2 views) | Pass |
| R3.2 | `e2e/paper.spec.ts` › "sample 02 renders its default view…" ("Empty form", then "Record 1 of 30, 02-expense-report-001.xml") | Pass |
| R3.3 | `e2e/paper.spec.ts` › "sample 02 record 1 matches core baseline…" (0 of 558,885 pixels differ), "the paper computes the same styles in light and dark colour schemes" | Pass |
| R4.1 | `test/tree.test.ts` (12: forms 01–08 and weight-keeper; form 02: 12 fields, 4 groups, 1 repeating; form 08: 200 fields) | Pass |
| R4.2 | `test/markers.test.ts` (6: form 01's four Required fields, Required = `required` or blank check on forms 01–08, Validated without the blank check, form 02's one calculated field, form 04's rules and connections, form 03's lists) | Pass |
| R5.1 | `test/card.test.ts` (5, form 04 and form 02); `e2e/xray.spec.ts` › "paper → tree: pointing at the Total…" | Pass |
| R5.2 | `e2e/xray.spec.ts` › "tree → paper: selecting Amount outlines its control in both expense rows" | Pass |
| R5.3 | `test/geometry.browser.test.ts` (18: marks ↔ elements on forms 01–08, empty and first record; form 08's boxes within 1 px after scroll and resize; the paper is not hit-testable) | Pass |
| R6.1 | `test/connections.test.ts` (5: form 03 works offline; form 04 SQL `sql-legacy01` and web service `forms-legacy`, dead; forms 01, 02, 07 email submit, dead; forms 05, 06, 08 none; every use selectable); `e2e/connections.spec.ts` (2) | Pass |
| R7.1 | `test/samples.test.ts` (2: 9 templates and 153 records byte-equal to the sources; no other sample file and no `-000-empty.xml` in `dist`) | Pass |
| R7.2 | `test/notices.test.ts` (4: every package in the page and Worker module list has its version, licence and text; the app, `samples/own`, Peter Theill's notice, Carlito's OFL 1.1; same CSP); `e2e/smoke.spec.ts` › "the notices page opens from the footer, with no violation" | Pass |
| R8.1 | the request guard in every e2e test (`e2e/fixtures.ts`); `e2e/offline.spec.ts` (2: after `data-ready`, sample, paging, views and files with 0 requests and 0 failures; the system-font note offline) | Pass |
| R8.2 | `test/csp.test.ts` (2); the violation guard in every e2e test; `e2e/worker-csp.spec.ts` (2, design §6: the Worker does not get the `<meta>` policy; `_headers` covers it) | Pass |
| R8.3 | `e2e/hostile.spec.ts` (20 seeded P5 inputs, line above; the canary and dialog counters calibrated on a real `alert`) | Pass |
| R9.1 | Lighthouse at task 3 (100, 100; design §7) and task 10 (100, 100; above) | Pass |
| R9.2 | `e2e/keyboard.spec.ts` › "the whole X-ray flow from the keyboard" (every Tab stop shows a focus ring; none is inside the paper) | Pass |
| R9.3 | `test/style.test.ts` (2: no colour literal outside `paper.css`, and the oracle's self-check); `e2e/paper.spec.ts` › "the first render of a template fades from sepia to clean, once", "under reduced motion no filter is ever set"; sentence case and the copy pass by review (screenshots below) | Pass |
| R10.1 | `test/budget.test.ts` (line above); every e2e test runs under `/infopath-afterlife-app/` | Pass |
| R10.2 | `.github/workflows/web-pages.yml` by review: `workflow_dispatch` only, `pages: write` and `id-token: write`, the same `pnpm install --frozen-lockfile` and `pnpm --filter web build` as run locally above; not run | Pass (review) |
| R11.1 | `packages/core/test/property/p14.property.test.ts` (1,000 runs) | Pass |

## Screenshots (1280×800, not committed)

`/tmp/afl-web/`: `landing.png`, `landing-dark.png`, `notices.png`, `fade.png` (sample 05, about
300 ms into its first render), `connections.png`, `xray.png`, `xray-dark.png`, `open.png`.
