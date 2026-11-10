# Verification: spec 12 Triage and death certificate, phase A

Evidence that the spec was met, written at task 10. Each row names the passing tests that prove a
criterion; a criterion with no passing test is not met.

- **Date:** 2026-11-11, 04:10 +07:00.
- **Runtime:** Node v22.23.4, pnpm 12.18.0, `@playwright/test` 1.65.0 with Playwright Chromium
  (HeadlessChrome 158), macOS (Apple silicon).
- **Tree:** commit `f34e4b6` plus the task 10 work: sample display names in Triage, the print
  view's cause list, the coverage and README rows, and this file.
- **Not checked here:** nothing is published; the private corpus was run by the human, not the
  agent (R8.1 below).

## Commands and results

| Command | Result |
|---|---|
| `pnpm check` | exit 0; core node 99 files passed, 3 skipped (the private tests, variable unset), 3,697 tests passed; core browser 12 files, 337 passed; web 15 files, 88 passed |
| `pnpm e2e:web` | exit 0; 38 passed, among them the expected-to-fail guard test in `smoke.spec.ts` |
| `npx lighthouse@13.6.0 http://localhost:4321/infopath-afterlife-app/ --preset=desktop --only-categories=performance,accessibility` (spec 09's command, `CHROME_PATH` = Playwright's Chromium 158) | landing page: performance **100** (FCP 0.2 s, LCP 0.2 s, TBT 0 ms, CLS 0), accessibility **100** |
| axe-core 4.14.0 (the copy Lighthouse 13.6.0 bundles), `wcag2a`, `wcag2aa`, `best-practice`, run in a temporary Playwright spec | after "Triage all samples": 0 violations; form 46's death certificate: 0 violations |

The Lighthouse CLI measures a page load and Triage has no URL of its own, so the Triage screen and
the certificate were checked with Lighthouse's accessibility engine (axe-core) instead; it has no
performance score there.

Oracle lines printed by the runs:

```
R7.1: 40 templates, drop to table 909 ms
R10.1 (KB): entry 69.8 / 100, theme chunks 0 / 0, worker 127.7 / 160, samples 118.8 / 120, Latin fonts 120.3 raw / 260
R8.3: seed 20261111, 20 inputs: {"opened":20,"refused":0,"rendered":38,"renderFailed":2}; canary 0, dialogs 0, requests 0, violations 0
```

## Criteria

| Id | Evidence (all passing) | Result |
|---|---|---|
| R1.1 | `core/test/coverage/classify.test.ts` › "every element of the 48 samples once…", "per-form counts, forms 01–08 and 43–47", decisions 1–4 | Pass |
| R1.2 | `classify.test.ts` › "an unknown control, action and adapter are Manual and unlisted"; `DropDown` and `useQueryAdapter` fixtures; private run: `unlisted: none` | Pass |
| R1.3 | `core/test/coverage/table-doc.test.ts` (3: every cited row exists and names the class; keys unique, controls without case; App ↔ Emulated) | Pass |
| R1.4 | `core/test/property/p11.property.test.ts` (200 runs, under 2 s) | Pass |
| R2.1 | `core/test/triage/causes.test.ts` › "which in-repo forms show each template cause", form 04, form 47 | Pass |
| R2.2 | `causes.test.ts` › "exactly three causes carry a date and a source" | Pass |
| R2.3 | `causes.test.ts` › form 05 and the workflow line; `e2e/triage.spec.ts` › form 46's certificate | Pass |
| R2.4 | `core/test/property/p9.property.test.ts` (48 forms; 200 variants; the oracle's self-check) | Pass |
| R2.5 | `causes.test.ts` › form 46 Native submit, the mixed variant, every replacement against its class; `e2e/triage.spec.ts` (chips, form 46, form 44) | Pass |
| R3.1 | `core/test/triage/triage.test.ts` › forms 01–08 with their 153 records (golden `test/golden/triage/forms-01-08.json`) | Pass |
| R3.2 | `triage.test.ts` › truncated template; `e2e/triage.spec.ts` › damaged template row | Pass |
| R3.3 | `triage.test.ts` (golden waves); `p8.property.test.ts` | Pass |
| R3.4 | `triage.test.ts` › order checks, "unknown record counts sort last…" | Pass |
| R3.5 | `core/test/property/p8.property.test.ts` (1,000 runs) | Pass |
| R3.6 | `core/test/property/p10.property.test.ts` (100 runs) | Pass |
| R3.7 | `apps/web/test/copy.test.ts` (2, with the oracle's self-check) | Pass |
| R4.1 | `e2e/triage.spec.ts` › four templates; `e2e/open.spec.ts` › forms 01 and 07 | Pass |
| R4.2 | `e2e/triage.spec.ts` › "the Wave rules are reachable by keyboard" | Pass |
| R4.3 | `e2e/triage.spec.ts` › form 46 (certificate, Open form, back), form 44 | Pass |
| R4.4 | `apps/web/test/protocol.browser.test.ts` › progress per file in order; a sample's progress | Pass |
| R4.5 | `e2e/triage.spec.ts` › "Triage all samples": 14 forms, wave 1: 2, wave 2: 4, wave 3: 8, display name "Weight keeper"; `test/samples.test.ts` (14 templates, 153 records); `test/budget.test.ts` (samples 118.8 KB, budget 120 unchanged) | Pass |
| R5.1 | `core/test/triage/csv.test.ts` (2); `e2e/export.spec.ts` › CSV download, 48 lines, no request | Pass |
| R5.2 | `e2e/export.spec.ts` › one A4 page, one Letter page, 47 forms | Pass |
| R6.1 | `triage.test.ts` › unknown vs 0; `e2e/triage.spec.ts` (— and 0); `protocol.browser.test.ts` | Pass |
| R6.2 | `causes.test.ts` › synthetic `xml-stylesheet` record, none of the 348, the 4 KB window | Pass |
| R7.1 | `e2e/triage.spec.ts` › 40 templates in 909 ms (limit 60 s) | Pass |
| R7.2 | `eslint.config.js` (no clock, randomness or Intl in `src/coverage/` and `src/triage/`; core's import rules); `pnpm check` lint step | Pass |
| R7.3 | spec 09's guards in every e2e test; `e2e/offline.spec.ts` › Triage, certificate and form offline; "Triage all samples" offline | Pass |
| R8.1 | below | Pass (run by the human) |

`xml-stylesheet` in the in-repo records: 0 of 348 (`causes.test.ts`); `browser-xslt` 0 in the
private corpus too.

## Addendum: all 48 forms in "Triage all samples" (review, 2026-11-11)

| Check | Result |
|---|---|
| `e2e/triage.spec.ts` › "Triage all samples" | 48 rows, "48 forms, wave 1: 23, wave 2: 17, wave 3: 8", equal to core over the 48 templates; click to table **329 ms** (48 templates, 153 records) |
| `e2e/offline.spec.ts` › Triage all samples offline | 48 rows and a form 27 certificate with the network off after `data-ready`, no request |
| `test/samples.test.ts` | forms 09–42: 34 templates, byte-equal, no records, own chunk |
| `test/budget.test.ts` | forms 09–42 chunk 172.1 KB / 200; samples 118.8 / 120 unchanged; entry 70.3 / 100 |
| Lighthouse 13.6.0, same command | performance 100, accessibility 100; both sample chunks requested after load |

## R8.1: private corpus (the human's runs, 2026-11-11)

### First run, before the fixes

Run by the human on the private corpus with `AFTERLIFE_PRIVATE_SAMPLES` set; counts only, as
the test prints them (`packages/core/test/triage-private.local.test.ts`). The files never enter
the repo and were not read by the agent.

```
Spec 12 private triage: 29 templates, 63 records
rows 29, error rows 0 (none)
waves: 1 1, 2 10, 3 18
causes: forms-services-spo 12, infopath-client 29, browser-xslt 0, internal-sql 3, internal-service 2, code-behind 3, activex 2, signatures 3
items: native 391, emulated 104, manual 20, unsupported 7
unlisted: connection:useQueryAdapter 3, control:DropDown 2
records matched: 26
```

Settled after this run (design §3): `control:DropDown` is the drop-down list box, Native, matched
without case; `connection:useQueryAdapter` is classed as the adapter it reuses, else Manual by its
own row in `docs/feature-coverage.md` G. Both have synthetic in-repo tests. These counts are from
before that change.

### Second run, after the fixes

```
Spec 12 private triage: 29 templates, 63 records
rows 29, error rows 0 (none)
waves: 1 2, 2 10, 3 17
causes: forms-services-spo 12, infopath-client 29, browser-xslt 0, internal-sql 3, internal-service 2, code-behind 3, activex 2, signatures 3
items: native 393, emulated 104, manual 18, unsupported 7
unlisted: none
records matched: 26
```

The two `DropDown` controls moved from Manual to Native (manual 20 → 18, native 391 → 393), and
one form moved from wave 3 to wave 1. The `useQueryAdapter` submits resolve to their database
adapter and stay Manual, so no other count changed.
