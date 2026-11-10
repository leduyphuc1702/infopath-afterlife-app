# Tasks: 03 view renderer

Phase 3 of 3. Requirements: `requirements.md` (approved 2026-11-10, second review the same day).
Design: `design.md` (approved). Status: **approved, 2026-11-10** (draft committed as `5290271`).

Changed at review (2026-11-10): task 1 adds pnpm overrides, the idempotent `applyStep` mark and
the installed-`package.json` licence test; task 2 adds the string charge to the `find` override;
task 4 renders the slice in a Worker; task 5 adds the string-doubling and fragment-doubling bombs
and the `RangeError` split; task 8 makes the R6.3 rule work on inline controls; task 9 reports
`CONTENT_REMOVED` by kind (0 expected).

## How every task is run and checked

As spec 01 and spec 02 (`tasks.md`, "How every task is run and checked"):

- Node 22.23.4 via `PATH=/opt/homebrew/opt/node@22/bin:$PATH`; paths relative to
  `packages/core/`; one task at a time; no commits.
- Prettier runs from the repo root on the changed files only.
- `V` below stands for `pnpm --filter @afterlife/core exec vitest run`.
- Every task ends with `pnpm check` green before it is ticked.
- Golden regenerations are reported as a key-level diff.

**Thin slice first.** After task 4, form 01's default view goes through the whole pipeline, with
the empty record and with `-001.xml`: the adapter, `formatString`, the sanitiser, marks, the
asterisk and scoped styles. Spec 09's viewer demo can start then. Tasks 5–14 add fidelity,
limits, properties, references and performance.

## Tasks

- [x] 1. Engine adapter, dependencies and guards
  - Add `xsltjs` 1.0.0 and `xpath` 0.0.36 to `packages/core` dependencies, pinned exactly, and
    `parse5` 7.3.0 as a devDependency. Root `pnpm-workspace.yaml` `overrides`: `@xmldom/xmldom`
    0.9.12, `xpath` 0.0.36 (design §5.3). List them in README "Third-party licences" and add the
    `fs`/`path` alias note to the README's build section (design §5.2).
  - `src/render/engine/xsltjs.ts`: compile with the package-only `loader` and `EMPTY_XSL`; a
    `Processor` per run with the `documentLoader`, the silent logger, the `find`/`isAvailable`
    overrides, fallback mode and test-only `engineHtml()` (§5.1, §5.3, §7.2). The `applyStep`
    wrapper with its `Symbol.for('afterlife.applyStep')` mark (counting starts in task 5).
  - `src/render/engine/stubs/fs.ts` and `path.ts`. `src/xml/parse.ts`: `parseXmlDom()`.
  - `eslint.config.js`: `xsltjs`/`xpath` imports only in the adapter; `XSLTProcessor` banned in
    core; the clock ban extended to `render/**` and `xpath-fns/**`.
  - `test/helpers/worker-bundle.ts` and the browser project in `vitest.config.ts`: map `fs` and
    `path` to the stubs for `node_modules/xsltjs/` importers; pre-bundle `xsltjs` and `xpath`.
  - Tests:
    - `test/render/engine-guard.test.ts` (§11 guard row): same xmldom and xpath instances,
      `applyStep` wrapped exactly once after a re-import;
    - `test/render/loaders.test.ts`: the default-loader test (§5.1), and synthetic `http:`,
      `file:`, absolute and package `xsl:include`/`xsl:import`/`document()`;
    - `test/render/licences.test.ts`: the `license` of every production dependency, transitive
      ones included, from its installed `package.json`, offline;
    - `test/lint/restricted.test.ts`: the new cases;
    - a Worker bundle of the adapter builds with no other built-in.
  - Requirements: R3.2, R3.4, R1.4 (Worker build).
  - Oracle:
    - every fs/fetch spy at 0 calls while the 53 views render in fallback mode, 106/106;
    - one `EXTERNAL_RESOURCE_BLOCKED` per blocked URI;
    - the guard passes on 1.0.0 and fails on a renamed method.
  - Done when: `V --project node test/render test/lint`, then `pnpm check`.

- [x] 2. `prepareView` and `renderView`, with `formatString`
  - `src/render/prepare.ts` and `render.ts` (design §1, §3.1, §4):
    - view lookup and default view;
    - the empty form when there is no record;
    - `now` and locale checks;
    - record parse through `parseXmlDom`;
    - `RECORD_TEMPLATE_MISMATCH`;
    - the raw serialised result.
  - New codes in `src/errors.ts` (§4.1); `RenderLimits` and `DEFAULT_RENDER_LIMITS` in
    `src/limits.ts`; exports in `src/index.ts`.
  - `src/render/functions.ts`: the allowed set, the unknown-function stub, and the
    `formatString` binding. The `find` override charges string results to the budget (design
    §6; the limit itself is enforced from task 5).
  - `src/xpath-fns/format.ts`: the 5 patterns of the 53 views (requirements Evidence).
  - Tests: `test/render/prepare.test.ts`, `test/render/input.test.ts`, `test/render/data.test.ts`
    (R2.1 part), `test/render/functions.test.ts` (availability, unknown functions),
    `test/xpath-fns/format.test.ts`.
  - Requirements: R1.2, R1.3, R1.4, R1.5, R2.1, R4.2, R4.3 (5 patterns), R4.4.
  - Oracle:
    - form 05 renders `HR` and form 03 renders `Employee`;
    - form 01 with no record equals form 01 with `template.xml`;
    - an unknown view name, and spec 02's missing-view and broken-view fixtures, each throw
      `VIEW_NOT_RENDERABLE`;
    - spec 01's XML safety fixtures, used as records, throw;
    - a form 01 record with form 07 gives 1 issue, every own record with its own template 0;
    - `2026-11-03` → `11/3/2026` and `350.3` → `$350.30`;
    - the synthetic guard view, and `ipApp:GetMajorVersion()` called unguarded.
  - Done when: `V --project node test/render test/xpath-fns`, then `pnpm check`.

- [x] 3. Sanitiser, serialiser and scoped CSS
  - `src/render/html/sanitise.ts`, `serialise.ts`, `css.ts` and `own-css.ts` (root rules): §8.1
    steps 1, 5, 8 and 9; §8.2–§8.4; `OUTPUT_ESCAPING_IGNORED` (D6).
  - Tests: `test/render/sanitise.test.ts` and `test/render/css.test.ts`, one case per rule:
    every R5.1 item, entity-encoded and whitespace-split schemes, `e\78pression`, `@import`,
    selector scoping of `BODY{…}` and `TABLE{…}`, `data-afl-*` from a view.
  - Requirements: R5.1, R5.2, R5.4 (attributes and `inert`), R5.5 (scoping).
  - Oracle: form 02's render keeps its `title`, `class` and `xd:binding` attributes and its
    table structure, and contains none of the R5.1 items.
  - Done when: `V --project node test/render`, then `pnpm check`.

- [x] 4. Control marks, required asterisk, and the form 01 slice
  - `src/render/marks.ts` and the `literalResultElement` hook (§9); §8.1 steps 6 and 7; the
    asterisk rule in `own-css.ts`.
  - Golden: form 01's default view with the empty record and with `-001.xml`, through
    `toMatchFileSnapshot`. The other goldens follow in task 9.
  - `test/browser/render-dom.browser.test.ts`, form 01 only for now:
    - no focusable element inside the root, and typing changes nothing;
    - an element outside the root keeps its computed style;
    - the four asterisks sit inside the right edge of their controls.
  - Tests: `test/render/marks.test.ts`.
  - Requirements: R6.5, R6.6, R1.1 (form 01), R5.4 and R5.5 (form 01).
  - Oracle:
    - form 02's first record has one mark per `my:amount` row, each with its row's position;
    - form 01's empty record marks Employee name, Employee ID, First day of leave and Last day
      of leave, and not Department or Working days; its first record has no mark;
    - a synthetic `errorBlank` and a non-nillable `xsd:date` are each marked when empty;
    - with hooks on, form 01's fallback `engineHtml()` equals a bare `XSLT.run`.
  - `Changed at review:` `test/browser/render-slice.browser.test.ts`: form 01's two records
    rendered in a Chromium Worker built with the stubs are byte-identical to the Node goldens.
  - Done when: `V --project node test/render` and `V --project browser
    test/browser/render-dom.browser.test.ts test/browser/render-slice.browser.test.ts`, then
    `pnpm check`. **Slice complete.**

- [x] 5. Limits
  - `src/render/engine/budget.ts`; the depth, step and output hooks; the `applyStep` wrapper;
    the abort slot; mapping `RangeError` to `LIMIT_EXCEEDED` (§5.3, §6).
  - Tests:
    - `test/render/limits.test.ts`: infinite recursion, a nested `for-each` bomb, an output bomb,
      a `copy-of` bomb, nested `xdMath:Eval`, overrides, and (`Changed at review:`) a
      string-doubling bomb (`concat($s, $s)`) and a fragment-doubling bomb (`copy-of $x` twice
      into a new variable), each stopped with `LIMIT_EXCEEDED` before 64 MiB is built; a
      non-stack `RangeError` gives `RENDER_FAILED`;
    - `test/browser/render-limits.browser.test.ts`: 128 nested templates render in a Chromium
      Worker, and 129 give `LIMIT_EXCEEDED` (`Changed at task 5:` was 256 and 257; design §6).
  - Measure the time each bomb takes to reach the default. If one exceeds 1 s in Node, lower
    `evaluationSteps` and update design §6.
  - Requirements: R3.3.
  - Oracle: each bomb throws `LIMIT_EXCEEDED` naming its limit, with no partial HTML; the 53
    views stay within the defaults.
  - Done when: `V --project node test/render/limits.test.ts` and `V --project browser
    test/browser/render-limits.browser.test.ts`, then `pnpm check`.

- [x] 6. Secondary data and the other extension functions
  - `src/render/functions.ts` and `src/xpath-fns/values.ts`: `GetDOM`, `GetNamedNodeProperty`,
    `getImageUrl`, `Today`, `Now`, `Avg`, `Nz`, `Eval`, `get-UserName`, `node-set`,
    `string-compare` (§7.1).
  - Tests: `test/render/functions.test.ts` (one case per row and per edge case) and
    `test/render/data.test.ts` (R2.2).
  - `Changed at review:` R6.7: `src/render/attachment.ts` and the attachment display in
    `marks.ts` (design §9.3); `test/render/attachment.test.ts`. Oracle: form 02's first record
    shows `receipt-01-1.txt`, `109 bytes` and `receipt-01-2.txt`, `110 bytes`; a truncated header
    and a name-length overflow show the icon alone with `ATTACHMENT_UNREADABLE`; a name holding
    markup is escaped.
  - `Changed at review:` the nested `xdMath:Eval` bombs left over from task 5, in
    `test/render/limits.test.ts`.
  - Requirements: R2.2, R4.1, R4.5, R6.7.
  - Oracle:
    - form 03's country list holds the countries of `locations.xml`;
    - form 04's `Vendors` list is empty, with one `SECONDARY_DATA_UNAVAILABLE`;
    - two renders with different `now` differ only in the `Today` and `Now` values;
    - `GetNamedNodeProperty(., 'IsValidSignature', 'false')` gives `false`;
    - an `Eval` expression never runs as JavaScript, shown by a probe expression that would call
      a global if it did.
  - Done when: `V --project node test/render test/xpath-fns`, then `pnpm check`.

- [x] 7. `formatString` in full
  - `src/xpath-fns/format.ts`: the 12 corpus patterns (`docs/feature-coverage.md` D):
    - `negativeOrder` and `positiveOrder`;
    - `currencyLocale`;
    - `auto` digits and grouping;
    - `percentage`, `time` and `string` with `plainMultiline`;
    - `FORMAT_UNSUPPORTED` and `LOCALE_UNSUPPORTED`.
  - Settle the rounding `[VERIFY]` in design §7.1 against a screenshot value, or record it as
    still open.
  - Tests: `test/xpath-fns/format.test.ts`, one case per pattern, per edge case and per
    negative order.
  - Requirements: R4.3.
  - Oracle: `docs/infopath-ux.md` §3–4 values; an unparseable value is returned unchanged.
  - Done when: `V --project node test/xpath-fns`, then `pnpm check`.

- [x] 8. What InfoPath showed that the XSL does not
  - `src/render/html/resources.ts` and `own-css.ts`: §8.1 steps 2–4 (ActiveX placeholder,
    `res:` icons, package images) and the R6.3 rule.
  - Tests: `test/render/resources.test.ts`. Extend `render-dom.browser.test.ts` to forms 01–08.
  - Requirements: R6.1, R6.2, R6.3, R6.4, R5.4, R5.5.
  - Oracle:
    - a synthetic template with a package PNG gets a `data:image/png` source;
    - form 44 shows the placeholder, with one `UNSUPPORTED_CONTROL`;
    - form 02's date pickers and form 06's picture control show the icons, and no `res:` URL is
      left (`Changed at task 8:` the picture control is in form 06; R6.4);
    - `Changed at task 8:` each date picker of forms 01 and 02 is one line inside its cell, with
      its button at the right edge;
    - every empty `PlainText` control in form 01's empty record is at least one line high,
      including `span`s the view leaves inline (`Changed at review:`);
    - forms 01–08 have no focusable element.
  - Done when: `V --project node test/render` and `V --project browser
    test/browser/render-dom.browser.test.ts`, then `pnpm check`.

- [x] 9. Goldens for the 53 views, and Worker parity
  - `test/render/golden.samples.test.ts`: 106 files under `test/golden/render/` (§10).
  - `test/browser/render-parity.browser.test.ts`: the 106 renders in a Chromium Worker, built
    with the stubs and a throwing `fetch`, are byte-identical to the goldens.
  - Requirements: R1.1, R3.1, R5.3.
  - Oracle: 106 goldens with no engine error; 106/106 identical in the Worker; 0 calls to an
    unimplemented function; `CONTENT_REMOVED` counts by kind reported, 0 on every own render
    (`Changed at review:`).
  - `Changed at review:` `xd:inline` is dropped silently (design §8.4, R5.2). `Changed at task
    9:` so are `xd:num` and `xd:value`, the other `xd:` attributes holding record data; and
    inline pictures (`msoxd:;inline;`) become data URLs (R6.1, design §8.1 step 4), since form
    06's first record otherwise lost its photo with one `CONTENT_REMOVED {kind: url}`.
  - Done when: `V --project node test/render/golden.samples.test.ts` and `V --project browser
    test/browser/render-parity.browser.test.ts`, then `pnpm check`.

- [x] 10. `xsltproc` references
  - `scripts/gen-xsltproc-refs.ts` and a package script `gen:xsltproc-refs`. Its output: 106
    references and `VERSION.txt` under `test/golden/render/xsltproc/` (§10).
  - `test/render/xsltproc.test.ts`: the normalisation list in design §10, steps 1–8.
  - Requirements: R10.1.
  - Oracle:
    - 106/106 equal after normalisation;
    - with hooks on, the fallback `engineHtml()` is byte-identical to a bare `XSLT.run` for all
      106;
    - the test passes with no `xsltproc` on `PATH`.
  - Done when: `pnpm --filter @afterlife/core run gen:xsltproc-refs` (run once, by the agent)
    and `V --project node test/render/xsltproc.test.ts`, then `pnpm check`.

- [x] 11. Property P4: rendering is deterministic
  - `test/property/p4-inputs.ts` and `test/property/p4.property.test.ts`. Inputs: the 53 views
    with sample records whose text values are replaced by generated strings (quotes, `<`, `&`,
    non-BMP characters, whitespace runs, long values), and generated `now`, locale and user
    name.
  - Claims: rendering twice gives the same bytes, and a permuted view order changes no result.
    At least 200 runs; failing seeds go to `regressions.ts`.
  - Requirements: R7.1.
  - Done when: `V --project node test/property/p4.property.test.ts`, then `pnpm check`.

- [x] 12. Property P5: sanitised output never holds executable content
  - `test/browser/p5-inputs.ts` and `test/browser/p5.browser.test.ts`. The generator covers the
    R8.1 shapes: literal elements and `xsl:element`/`xsl:attribute` with the R5.1 names, `on*`,
    mixed-case and encoded schemes, CSS `expression(`, rich text copied by `copy-of`, and
    `disable-output-escaping`.
  - Oracle, in Chromium: parse `html` with `template.innerHTML` and `css` with
    `CSSStyleSheet.replaceSync`, then walk both for any R5.1 item. At least 500 runs.
  - Requirements: R8.1.
  - `Changed at task 12:` P5 found two holes, both fixed with their seeds in `regressions.ts`:
    the render root could be closed early by the HTML parser (`html/nesting.ts`, design §8.2),
    and `@import` survived inside a declaration value (design §8.4).
  - Done when: `V --project browser test/browser/p5.browser.test.ts`, then `pnpm check`.

- [x] 13. Performance and the private check
  - `test/perf/render.perf.test.ts` and `test/browser/render-perf.browser.test.ts` (§10).
  - `test/render-private.local.test.ts`. It skips `own/` and prints names and counts only:
    - issues by code;
    - `CONTENT_REMOVED` by kind, `element` expected 0 (`Changed at task 8:` ActiveX `param`
      children are no longer counted);
    - calls to unimplemented functions (expected 0);
    - guard results by name;
    - FormIR controls with no mark, and asterisks drawn;
    - the slowest render;
    - `.xsl` files no `mainpane` names.
  - Requirements: R9.1, R10.3.
  - Oracle: p95 under 100 ms for each of the 106 renders, Node and Worker, with form 08 on its
    own line; 36/36 private views with no throw.
  - Done when: `pnpm test:perf`, `V --project browser test/browser/render-perf.browser.test.ts`
    and the local check (`AFTERLIFE_PRIVATE_SAMPLES=$HOME/Desktop/infopath-afterlife/samples`),
    then `pnpm check`.

- [ ] 14. Visual acceptance and final check
  - `test/browser/visual.browser.test.ts`: the default views of forms 01–08, empty and first
    record, 16 renders.
  - Write candidate PNGs and a side-by-side page with the InfoPath screenshots, then stop for
    the maintainer's approval. Commit nothing.
  - `Changed at review:` Calibri resolves to Carlito (`@fontsource/carlito` 5.3.0, OFL-1.1,
    devDependency), declared by the test page; core stays font-free. Baselines are for macOS
    Chromium; other platforms skip. Candidates written 2026-11-11; awaiting approval.
  - After approval: commit-ready baselines. Propose the pixel threshold as a `Changed at
    review:` edit to R10.2.
  - Re-check every criterion, and update the `Status` column of `docs/feature-coverage.md` for
    the renderer rows.
  - Requirements: R10.2, and all of R1–R10 (re-check).
  - Done when: `V --project browser test/browser/visual.browser.test.ts`, `pnpm test:perf` and
    the local check green; every row of the coverage table below passes; then `pnpm check`.

## Coverage

| Requirement | Tasks |
|---|---|
| R1.1 | 4, 9 |
| R1.2, R1.3, R1.5 | 2 |
| R1.4 | 1, 2 |
| R2.1 | 2 |
| R2.2 | 6 |
| R3.1 | 9 |
| R3.2, R3.4 | 1 |
| R3.3 | 5 |
| R4.1, R4.5 | 6 |
| R4.2, R4.4 | 2 |
| R4.3 | 2, 7 |
| R5.1, R5.2 | 3 |
| R5.3 | 9 |
| R5.4, R5.5 | 3, 4, 8 |
| R6.1–R6.4 | 8 |
| R6.5, R6.6 | 4 |
| R6.7 | 6 |
| R7.1 (P4) | 11 |
| R8.1 (P5) | 12 |
| R9.1 | 13 |
| R10.1 | 10 |
| R10.2 | 14 |
| R10.3 | 13 |

Every requirement id appears at least once; task 14 re-checks all of them. **Total: 14 tasks.**
