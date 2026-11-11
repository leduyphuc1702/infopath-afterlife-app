# Spec 16 design

Root causes at `1f2ac50`. Tests: `packages/core/test/dossier/bugfixes16.test.ts` (core),
`apps/web/e2e/bugfixes16.spec.ts` (page), `packages/core/test/runtime/submit-close.test.ts`
(R4.3, D1), `apps/web/test/trace-keep.test.ts` (R9.2, N1).

| Bug | Root cause | Fix | Test |
|---|---|---|---|
| K1 | `apps/web/src/docs/docs.css:2`: fixed padding and a six-column table with no narrow layout | under 40rem the table becomes labelled blocks (`data-label`); `.afl-doc` wraps anywhere | e2e K1 |
| K2 | `packages/core/src/dossier/words.ts:241` `buttonName` has only the control id: FormIR records bound controls, and buttons are unbound | `dossier/buttons.ts` `buttonCaptions(parsed)` reads each `input` Button's `value` from the view XSL; the Worker passes it to `buildDossier`; `FillSession.press` marks its rule and skipped entries with `button` | core K2 (2) |
| K3 | `dossier/build.ts:156` copies the schema flag | blank check (`isBlankCheck`) or required non-boolean schema type | core K3 |
| K4 | `words.ts:246` never reads the condition | `conditionWords`: a small parser for comparisons, blank, `string-compare`, `and`/`or`/`not` (De Morgan); `undefined` otherwise | core K4 |
| K5 | `docs.css:23` `break-before: page` | removed; `break-after: avoid` on headings, `break-inside: avoid` on items and rows | e2e K5 (computed styles, PDF pages) |
| K6 | `dossier/markdown.ts:32` escapes all ASCII punctuation | escape `\ \` * [ ] < ~` anywhere, `_` at a word's edge, `&` before an entity, `\|` in cells, and block starters at the start | core K6 (examples and property) |
| K7 | `App.tsx:723` saves without a notice; the zip button sat in a `<details>` that closed under focus | notice "Saved …"; the zip button is a plain button (K8), so focus stays | e2e K7, K8 |
| K8 | `triage/ExportMenu.tsx:55` | button beside "Export plan" | e2e K7, K8 |
| K9 | `build.ts:108` falls to "Not known" for every connection without an address | a sentence per adapter kind (e-mail, hosting page, SharePoint, workflow, XML file) | core K9, K10 |
| K10 | `build.ts:94` appends the cause's `replacement` | own sentences per case | core K9, K10 |
| K11 | `words.ts:143` `nodeName` returns the id | `localName`; `unnamedPaths` puts the path under the sentence | core K11 |
| K12 | `docs/Documentation.tsx:35` tools before the heading | heading first | e2e K12 |
| K13 | `runtime/session.ts:405` gives open-time calculations the first changed input as `trigger`; `App.tsx:383` counts only empty values | open-time entries carry `opened` and no trigger, and say the stored value differs from the formula; the Worker counts `corrected`; the status line says it | core K13, e2e K13 |
| N1 | `App.tsx:342`: Undo's answer has no trace | `side/trace-keep.ts` `stepEntry` writes an `undo`/`redo` entry from the values before and after | e2e N1, unit |
| N2 | `App.tsx:643` shows `s.notice` only outside Fill | the Fill line shows it; each command clears it | e2e N2 |
| N3 | `paper/fill.ts:295`: no print rule inside the paper's shadow root | `PRINT_CSS` in both modes | e2e N3 |
| D1 | `runtime/rules.ts:130` pushes the notice per action | once per command | core R4.3 |

## Existing tests that asserted a defect

- `apps/web/e2e/dossier.spec.ts`: "button CTRL901" (K2) and `break-before: page` on sections 2–6 (K5).
- `packages/core/test/dossier/dossier.test.ts`: form 04's rule sentence "a condition on Total incl. VAT is true" (K4); the property "no unescaped punctuation outside code spans" and the hostile test's `!` and `>` (K6). The property is replaced by K6's in `bugfixes16.test.ts`.
