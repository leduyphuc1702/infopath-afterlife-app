# Verification: spec 03 view renderer

Evidence that the spec was met, written at task 14. Each row names the passing tests that prove a
criterion; a criterion with no passing test is not met.

- **Date:** 2026-11-11, 01:10 +07:00.
- **Runtime:** Node v22.23.4, pnpm 12.18.0, Playwright Chromium (HeadlessChrome 158), macOS.
- **Tree:** commit `3746c6b` plus the uncommitted task 14 review work: the quirks layout
  (`own-css.ts`), Carlito line metrics (`test/browser/carlito.ts`), NUMBERFMT `grouping`, the
  attachment block, the containment assertion, the regenerated goldens, the 16 baselines, the
  R10.2 threshold, the coverage rows and this file.
- **Clean install:** the files git would commit (`git ls-files --cached --others
  --exclude-standard`) were copied to an empty folder under `/tmp` with no `node_modules`, and
  `pnpm check` ran there. The working copy's `node_modules` was not touched. The folder was
  deleted afterwards. The first clean run failed one test: `sanitise.test.ts` › "keeps the title,
  class and xd:binding attributes" counted the `title` the attachment block now adds (21 against
  the engine's 19). The test now counts the view's attributes only; the second run is the one
  below.

## Commands and results

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` (clean folder) | exit 0 |
| `pnpm check` (typecheck, lint, format check, node project, browser project; clean folder) | exit 0; node project 88 files passed, 2 skipped (`private-corpus.local.test.ts`, `render-private.local.test.ts`, variable unset), 3,656 tests passed; browser project 12 files, 336 tests passed |
| `pnpm test:perf` (working copy, after the last code change) | exit 0; 4 files, 208 tests passed; `renderView` slowest p95 `08-big-form` 21.61 ms (first record), other forms at most 3.95 ms, budget 100 ms |
| `vitest run --project browser test/browser/render-perf.browser.test.ts` (task 13) | 49 passed; Worker p95 form 08 17.70 / 13.30 ms, others at most 3.20 ms |
| `AFTERLIFE_PRIVATE_SAMPLES=$HOME/Desktop/infopath-afterlife/samples vitest run test/render-private.local.test.ts` | exit 0; 30 tests passed (read only, nothing written); lines below |

Local check summary (names and counts only; the 29 private templates, `own/` skipped):

```
private renders: 29 templates, 36 named views, 36 rendered with the empty form
issues by code: SECONDARY_DATA_UNAVAILABLE 4, UNSUPPORTED_CONTROL 6
CONTENT_REMOVED by kind: none; by name: none
unknown functions by name (calls): none
guards by name (function-available answer): {…/xslt/formatting}formatString true (27 views); {…/xslt/xDocument}GetDOM true (17 views); {…/xslt/xDocument}GetNamedNodeProperty true (3 views); {…/xslt/xImage}getImageUrl true (12 views); {…/ipApp}GetMajorVersion false (3 views)
FormIR controls: 423, with a mark 372, without 51; CONTROL_NOT_MARKED elements 0
marks 372, asterisks drawn 2
slowest render: spjeff/2007/Asset Tracking.xsn view1.xsl 19.56 ms
.xsl files no mainpane names: 22 (upgrade.xsl 19, other 3)
```

The 51 controls without a mark are in parts of the views the empty form does not render.

## Summary

**34 of 34 criteria pass, and 14 of 14 brief items.** R10.2's baselines are written and the
threshold is set; R10.2 also asks that each baseline be committed only after the maintainer
approves it beside its screenshot, which happens at commit (side-by-side page:
`/tmp/afl-visual/index.html`).

**Total: 3,656 + 336 = 3,992 tests in `pnpm check`, all passed (2 local-only files skipped);
plus 208 perf tests and 30 local-only, all passed.**

## R1.1–R10.3

| Criterion | Tests (file › test name or prefix) | Result |
|---|---|---|
| R1.1 | `test/render/golden.samples.test.ts` › 106 renders matching their goldens, "53 views, 106 renders, none throws" | Pass |
| R1.2 | `test/render/prepare.test.ts` › "with no view name, the FormIR default view is prepared", "a named view is prepared"; `test/render/input.test.ts` › "with no record, the empty form (initialXmlDocument) is rendered" | Pass |
| R1.3 | `test/render/prepare.test.ts` › "an unknown view name is VIEW_NOT_RENDERABLE", "spec 02's missing and broken views are VIEW_NOT_RENDERABLE, with no partial result" | Pass |
| R1.4 | `test/render/input.test.ts` › "now is required by the type, and checked at run time too", "a render is synchronous and returns frozen results", the `now` and locale cases; `test/lint/restricted.test.ts` › "packages/core/src/ir, render and xpath-fns restrictions"; `test/browser/render-slice.browser.test.ts`, `render-parity.browser.test.ts` › Worker bundles with only the stubs | Pass |
| R1.5 | `test/render/input.test.ts` › "a record with %s is %s, and nothing is fetched", "the record limits are spec 01 limits" | Pass |
| R2.1 | `test/render/data.test.ts` › "a form 01 record rendered with form 07 … gives one issue", "every own record, with its own template, gives none (395 records)" | Pass |
| R2.2 | `test/render/data.test.ts` › "form 03's country list holds the countries of locations.xml", "form 04's Vendors list is empty, with one SECONDARY_DATA_UNAVAILABLE"; `functions.test.ts` › "xdXDocument:GetDOM …" | Pass |
| R3.1 | `test/render/golden.samples.test.ts` (106, no engine error); local check 36/36 | Pass |
| R3.2 | `test/render/loaders.test.ts` (6 tests: default-loader control, 53 views with no fs or fetch call, blocked URIs, package include/import, `document()`) | Pass |
| R3.3 | `test/render/limits.test.ts` (13: seven bombs, nested `Eval`, `RangeError` split, sample views within defaults); `test/browser/render-limits.browser.test.ts` (128 levels render, 129 give `LIMIT_EXCEEDED`) | Pass |
| R3.4 | `test/render/licences.test.ts`; `test/lint/restricted.test.ts` › "spec 03 engine adapter (D1)"; `test/render/engine-guard.test.ts` (7) | Pass |
| R4.1 | `test/render/functions.test.ts` (one test per function: GetDOM, GetNamedNodeProperty, getImageUrl, Today/Now, Avg, Nz, Eval, get-UserName, node-set, string-compare); "the 53 views call no unimplemented function"; local check: unknown functions none | Pass |
| R4.2 | `test/render/functions.test.ts` › "function-available is true exactly for the implemented set", "in fallback mode no extension function is available"; local guard line | Pass |
| R4.3 | `test/xpath-fns/format.test.ts` (12 tests, every corpus pattern, order tables, `grouping` as NUMBERFMT, `FORMAT_UNSUPPORTED`, unparseable unchanged); `functions.test.ts` › "form 02 and form 01 show amounts and dates as InfoPath does" | Pass |
| R4.4 | `test/render/functions.test.ts` › "an unguarded unknown function gives '' and one UNKNOWN_FUNCTION per name"; `golden.samples.test.ts` › "no render calls an unimplemented function" | Pass |
| R4.5 | `test/render/functions.test.ts` › "xdDate:Today and xdDate:Now come from now", "two renders with different now differ only in the Today and Now values", "GetNamedNodeProperty returns the caller's default", "xdUser:get-UserName is the userName input" | Pass |
| R5.1 | `test/render/sanitise.test.ts` (steps 1, 5, 8; one case per item), `css.test.ts` (declaration filter, at-rules), `nesting.test.ts` (6); `sanitise.test.ts` › "form 02 … contains none of the R5.1 items"; P5 | Pass |
| R5.2 | `test/render/sanitise.test.ts` › "form 02 (R5.2 oracle)" (3), "xd:inline, xd:num and xd:value (record data) go silently", "xml:base and an empty src go silently" | Pass |
| R5.3 | `test/browser/render-parity.browser.test.ts` (106 of 106 byte-identical, `fetch` 0 calls) | Pass |
| R5.4 | `test/browser/render-dom.browser.test.ts` › "no element inside the root takes focus, and typing changes nothing", "%s %s record: no element inside the root takes focus" (16) | Pass |
| R5.5 | `test/browser/render-dom.browser.test.ts` › "elements outside the root keep their computed style"; `css.test.ts` › "scoping (R5.5)" (6) | Pass |
| R6.1 | `test/render/resources.test.ts` › "R6.1: package images" (2), "R6.1: inline pictures" (3, form 06's scene photo) | Pass |
| R6.2 | `test/render/resources.test.ts` › "R6.2: ActiveX" (form 44 placeholder, one `UNSUPPORTED_CONTROL`) | Pass |
| R6.3 | `test/browser/render-dom.browser.test.ts` › "form 01's empty PlainText controls are each at least one line high", the date-picker test, "every control box lies inside its nearest td" (16) | Pass |
| R6.4 | `test/render/resources.test.ts` › "R6.4: InfoPath resources" (3: calendar, picture, signature icons; unknown box; no `res:` left) | Pass |
| R6.5 | `test/render/marks.test.ts` › "form 02 first record: one mark per my:amount row"; `golden.samples.test.ts` › "every control the view binds gets a mark" | Pass |
| R6.6 | `test/render/marks.test.ts` › "form 01 (R6.6 oracle)" (4), synthetic `errorBlank` and non-nillable date (3); `render-dom.browser.test.ts` › "the four asterisks sit inside the right edge" | Pass |
| R6.7 | `test/render/attachment.test.ts` (7: header, form 02's receipts with name, type and size, unreadable headers, escaped name, type line) | Pass |
| R7.1 | `test/property/p4.property.test.ts` › "200 runs: same bytes twice, in any view order, prepared once or afresh" (non-BMP 200, long 278, markup 53, quotes 144, non-en-US 191); Worker identity is R5.3 | Pass |
| R8.1 | `test/browser/p5.browser.test.ts` › "500 runs: no render result holds an R5.1 item, as Chromium parses it", the oracle self-test, 2 regressions, 13 parser-escape cases; a 5,000-run local pass at task 12 | Pass |
| R9.1 | `test/perf/render.perf.test.ts` (107: every render p95 under 100 ms, form 08 on its own line); `test/browser/render-perf.browser.test.ts` (49) | Pass |
| R10.1 | `test/render/xsltproc.test.ts` (106 equal after normalisation, 106 hooks-on equal to a bare `XSLT.run`, no `xsltproc` needed) | Pass |
| R10.2 | `test/browser/visual.browser.test.ts` (16 renders against 16 macOS Chromium baselines, pixelmatch `threshold: 0.1`, `allowedMismatchedPixelRatio: 0.001`; skips elsewhere) | Pass (baselines approved at commit) |
| R10.3 | `test/render-private.local.test.ts`: skipped in `pnpm check`; local run 30/30 with the lines above | Pass (local) |

## Brief items

| Item | Evidence | Result |
|---|---|---|
| Summary: pure-JS engine, shims | R3, R4 | Pass |
| User story: auditor | R2.1, R6, R10.2 | Pass |
| User story: Tim | R6, R10 | Pass |
| AC1 render within 100 ms p95 | R1.1, R9.1 | Pass |
| AC2 functions | R4.1–R4.5 | Pass |
| AC3 sanitise | R5.1–R5.3 | Pass |
| AC4 package images as data URLs | R6.1 | Pass |
| AC5 ActiveX placeholder | R6.2 | Pass |
| AC6 empty fields visible | R6.3 | Pass |
| AC7 calendar icon | R6.4 | Pass |
| P4 deterministic | R7.1 | Pass |
| P5 sanitiser | R8.1 | Pass |
| Visual acceptance | R10.1–R10.2 | Pass |
| Added items | R1.2–R1.5, R2, R3.2–R3.4, R5.4–R5.5, R6.5–R6.7, R10.3 | Pass |

## Fidelity against the InfoPath screenshots (task 14 review)

Row-border pitches, first record, in pixels (InfoPath's first border is missed by the measuring
threshold, so our extra leading values are left out):

| Form | InfoPath | Before the review | After |
|---|---|---|---|
| 01 | 28 30 30 27 30 30 28 28 28 | 34 30 30 29 30 30 34 34 34 | 28 30 30 28 30 30 28 28 28 |
| 02 | 28 30 6 28 30 42 23 61 3 61 18 28 28 | 34 30 6 34 30 50 25 27 3 27 18 34 34 | 28 30 6 28 30 42 23 61 3 61 18 28 28 |
| 04 | 28 28 6 30 30 42 23 18 3 18 28 28 28 28 28 27 | 34 34 6 30 30 50 25 20 7 18 34 34 34 34 | 28 28 6 30 30 42 23 18 3 18 28 28 28 28 28 28 |
| 06 | 28 6 30 30 28 27 79 129 42 | 34 6 30 30 34 29 87 132 | 28 6 30 30 28 28 82 129 42 |
| 08 | 30 28 27 28 28 27 28 28 28 30 30 28 27 28 | 30 34 29 34 34 29 34 34 34 30 30 34 | 30 28 28 28 28 28 28 28 28 30 30 28 28 28 |

Every row is within ±1 px except form 06's multi-line "What happened" row (+3).

Pixel difference from the screenshots, information only (% of pixels whose largest channel
differs at all / by more than 25):

| Form, view | Empty | First |
|---|---|---|
| 01 Request | 7.34 / 6.91 | 6.00 / 5.60 |
| 02 Claim | 6.79 / 6.42 | 10.40 / 9.76 |
| 03 Employee | 4.38 / 3.83 | 6.83 / 6.15 |
| 04 Request | 10.19 / 8.48 | 10.82 / 9.82 |
| 05 HR | 7.36 / 6.81 | 7.14 / 6.72 |
| 06 Report | 6.29 / 6.00 | 10.68 / 10.23 |
| 07 Request | 5.68 / 5.31 | 6.44 / 6.02 |
| 08 All fields | 10.39 / 9.94 | 11.26 / 10.75 |

## Known visual differences

Kept on purpose or outside the renderer:

- **Insert item:** InfoPath draws a small icon before the link text; we do not.
- **Calendar icon:** ours is drawn in CSS and differs from InfoPath's bitmap.
- **Calculated defaults:** InfoPath ran the calculations when it opened the empty form (form
  04's VAT and Total show `$0.00`). The renderer does not run calculations; spec 04's runtime
  does.
- **Focus and caret:** the screenshots show a caret and focus in the first text box.
- **Document Recovery pane:** the left 247 px of `01-leave-request-Request-empty.png` are white
  (`samples/own/README.md`).
- **Clipped text:** Chromium writes an ellipsis where a text box's value does not fit (the view
  sets `text-overflow: ellipsis`); InfoPath cut the text at the edge.
- **Glyphs:** Carlito has Calibri's metrics, but anti-aliasing differs from Windows ClearType.

## Notes

- **Quirks layout.** No view has a DOCTYPE, so MSHTML laid them out in quirks mode. Design
  §8.1 step 9 lists each rule and its evidence. The heading margin (14pt) is `[VERIFY]`: IE's
  default style sheet is not published, and 14pt reproduces the measured rows.
- **Grouping.** `grouping` is a NUMBERFMT group size (design §7.1); form 08 shows `4,3` and
  `7,0`, form 07 `1,0`. 15 own views use `grouping:1`, so their goldens show values such as
  `7,7,6.01`; no screenshot shows a three-digit value under it.
- **Attachment type line.** `Text Document` for `txt` is seen; `<EXT> File` for other
  extensions is `[VERIFY]`.
- `docs/feature-coverage.md`: `render: spec 03` on 25 rows of sections A, B, D, F and I.
