# Spec 19 design

Root causes at `6d27aab`. Tests: `packages/core/test/bugfixes19.test.ts`,
`packages/core/test/legacy/archive.test.ts` (P21 on rich text), `apps/web/test/trace-keep.test.ts`,
`apps/web/test/records-find.test.ts`, `apps/web/e2e/bugfixes19.spec.ts`.

| Bug | Root cause | Fix | Test |
|---|---|---|---|
| T1 | default 5 s vitest limit on tests of hundreds of runs; perf budget failed on one sample | `test/helpers/time.ts` `HEAVY_MS` (30 s) on the seven tests; render-dom R5.4 at 45 s; render-perf measures again once on a miss, with a "machine may be busy" message | the seven files under 12 busy processes (load 13): 98 pass |
| A1 | `render/html/sanitise.ts` keeps `a[href]` (http, https, mailto) and form controls wherever they are; `legacy/archive.ts` writes the render as is | sanitiser drops controls inside `xd:xctname="RichText"` (button keeps its words); archive turns every `<a>` into its words plus `(address)` as text | core A1 (2), P21 on form 06 |
| A2 | `App.tsx` put `ArchiveMenu` in the toolbar | the views' checkboxes and "Web pages to keep (.zip)" in `ExportRecords`; `ArchiveMenu` only on Records | e2e A2, B3 back to one row |
| A3 | `archive.ts` index CSS gives no cell a width | `td.long { min-width: 24em }` for cells over 40 characters | core A3 |
| A4, R3 | `legacy/list.ts` puts Failed checks last, blank for 0 | column 1, "None" for 0 | core R3, e2e R2/R3 |
| R1 | `App.tsx` `onOpen` called `leaveFill` only when `fillOn`, which is false off the form screen | always `leaveFill()` | e2e R1 |
| R2 | `list.ts` reads only the Records sheet | `ListRow.more` ("Label: value" of the repeating sheets); `find.ts` searches it; `whereFound` names the place | core R2, unit R2, e2e |
| R4 | `Records.tsx` draws an empty table | sentence and "Clear Find" | e2e R4 |
| R5 | sticky file-name column with no width limit | at ≤ 40rem the name button is at most 40vw, with an ellipsis | e2e R5 |
| P1 | `docs.css` `.afl-doc { overflow-wrap: anywhere }` lets the table squeeze words | in print, `normal` for the table's cells; `anywhere` for paths only | e2e P1 |
| P2 | `side/trace-keep.ts` used `new Date().toISOString()` | `localNow()` | unit P2 |
| P3 | `dossier/markdown.ts` LINKY knew schemes, `www.` and `@` only; leading spaces kept; any leading number escaped | dotted names are code spans (trailing punctuation outside); leading white space dropped; `1.` escaped only before a space or the end | core P3 |
| P4 | `dossier/build.ts` pasted `issue.message` | `issueItem`: a sentence per code, file and line; path, id and text under it; UNRESOLVED_REFERENCE left to the per-element sentence | core P4 |
| P5 | `trace-keep.ts` copied the value text | numbers with 12 or more decimals shown with 15 significant digits | unit P5 |
| F1 | `list.ts` showed the stored value | `viewChoices(t)` reads each `select`'s static options from the view XSL | core F1, e2e |
| F2, F3 | the menu's button and Cancel are removed while they hold focus | the menu's `summary` is passed as `opener`; focused after the archive ends or stops | e2e A2/F2, archive.spec F3 |
| F4 | headers are buttons, one Tab each | Enter or Down in Find focuses the first file name; Up and Down in the body | e2e F4 |
| F5 | `max-height: calc(100vh - 16rem)` | `max(calc(100vh - 16rem), 70vh)` | e2e F5 |

## Existing tests changed

- `apps/web/e2e/fill-bugfixes.spec.ts` B3: back to one row at 1280 px and three at 390 px (A2
  undoes spec 18's loosening).
- `apps/web/e2e/archive.spec.ts`: the form screen's archive is in "Export records" (A2); Find
  "pound" instead of "gbp" (F1); asserts focus after Cancel (F3).
- `apps/web/e2e/records.spec.ts`: header order (R3); Find "pound" (F1).
- `packages/core/test/legacy/list.test.ts`: Failed checks at column 1 (R3).
- `packages/core/test/dossier/bugfixes16.test.ts`: a file name is a code span (P3a); the K6
  property drops leading white space (P3b).
- `apps/web/test/records-find.test.ts` P20: `searchText` names the column it skips (R3).
