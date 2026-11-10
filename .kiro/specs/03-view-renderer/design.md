# Design: 03 view renderer

Phase 2 of 3. Requirements: `requirements.md` (R1–R10, 33 criteria, approved 2026-11-10, second
review the same day). Status: **approved, 2026-11-10** (draft committed as `5290271`).

Changed at review (2026-11-10): D9 approved and made idempotent (§5.3); string and
result-tree-fragment growth charged, and `RangeError` split (§5.3, §6); marks keyed by file
(§9.1); one xmldom and one xpath through pnpm overrides (§5.3); the R3.4 licence oracle reads
installed `package.json` files (§11); InfoPath runtime constructs dropped silently (§8.4); an
X-ray constraint under `inert` (§8.1); the R6.3 rule for inline controls (§8.1); the slice
renders in a Worker (task 4).

Spec 01's design is the reference for what this one does not restate: workspace and tools, the
public API rule, `Located` and `Issue`, the error model, the XML layer, the golden helper, the
fast-check style and regression seeds, the Worker build and parity harness, the perf project and
the local private check. Spec 02's design is the reference for FormIR ids and data paths.

**Measured for this design** (2026-11-10, `xsltjs` 1.0.0 from `npm pack` in a temp folder, since
deleted): the 53 views × empty and first records, and the 36 private `mainpane` views × empty form,
each in fallback mode and with stand-in functions (212 and 72 renders; private: counts only).

| Quantity, per render | 53 views (max, where) | Private views (max) |
|---|---|---|
| Nested template calls (`invokeTemplate` depth) | 3 (form 06) | 3 |
| XSLT instructions executed | 2,337 (form 08) | 343 |
| XPath location steps (`applyStep` calls) | 531 (form 08) | 130 |
| Serialised output, characters | 119,252 (form 08) | 29,602 |
| `disable-output-escaping="yes"` in the XSL | 0 | 17, in 8 view files of 5 forms: all `xsl:value-of` (7 plain paths, 7 `formatString`, 3 other expressions); none in `upgrade.xsl` |

## 1. Overview

```
prepareView(template, ir, {view})            async, once per view
  view XSL bytes ─ xml/ parseXmlDom ─ engine.compile (package-only loader) ─ PreparedView
renderView(prepared, {record, now, …})       sync, pure
  record bytes ─ xml/ parseXmlDom ─ engine.run (hooks, functions, budget) ─ result tree (xmldom)
  ─ post-process (§8) ─ serialise (§8.3) ─ { html, css, issues, marks }
```

- The engine can hand back its result tree: `Processor.transform()` returns an `@xmldom/xmldom`
  `DocumentFragment`, which `XSLT.run` would then serialise. We post-process that tree and write
  the HTML ourselves; no HTML string is re-parsed (D4). Everything after `prepareView` is
  synchronous, in Node 22 and a Web Worker, with no DOM, `Date`, `Intl` or randomness.

## 2. Decisions

| # | Decision | Alternatives | Why |
|---|---|---|---|
| D1 | **`xsltjs` 1.0.0, pinned exactly, behind one adapter** (`render/engine/xsltjs.ts`, the only file that imports `xsltjs` or `xpath`; lint enforces it). | `xslt-processor`; our own interpreter | Spike: 106/106 `xsltproc` match, 106/106 Node/Worker parity. Steering: tech.md. |
| D2 | **We construct `Processor` ourselves, once per render**, instead of calling `XSLT.run`. Hooks are own properties of that instance (§5.3). | prototype patches; subclass | `XSLT.run` hides the instance and serialises. A per-instance hook cannot leak into another render (P4). `XSLT.run` also calls `Date.now`, which we then never run. |
| D3 | **Both loaders are always ours, backed by package files only** (§5.1). | rely on `xsltjs` defaults | The default loader reads disk and fetches (`options.loader \|\| Stylesheet.defaultLoader`). |
| D4 | **Sanitise the result tree, then serialise it ourselves**, escaping every text and attribute value. | serialise with `xsltjs`, then sanitise the string | Re-tokenising a string can disagree with the browser parser (mXSS, P5). On the tree, attribute values are already decoded, so entity-encoded and whitespace-split URLs need no special case. |
| D5 | **Allowlist elements**; drop a fixed set with their content, unwrap everything else (§8.2). | the R5.1 denylist alone | R5.1 names what must go. An allowlist also refuses what nobody listed (`svg`, `math`, `noscript`, `template`), the usual mXSS carriers. |
| D6 | **`disable-output-escaping` is ignored**: raw text is escaped like any text, with one `OUTPUT_ESCAPING_IGNORED` issue per render. | honour it | The 17 private uses all write field values (paths and `formatString`), that is, record data. Honouring them would let a record inject markup. The 53 views have none. |
| D7 | **Control marks come from a hook on `literalResultElement`**, which looks up the XSL element by its source position in a FormIR map and evaluates `xd:binding` against the live context node (§9). | instrument `for-each`; inject a mark function into the XSL | The context node is the exact node instance, so positions come for free. Nothing is added to the XSL or the result tree, so the R10.1 HTML cannot change. |
| D8 | **Formatting without `Intl`**: our own tables and decimal-string rounding (§7). | `Intl.NumberFormat` | ICU builds differ between Node and Chromium; byte parity (R5.3) cannot rest on them. |
| D9 | **Limits through one budget object per render** (§6). A stateless global wrapper on `xpath`'s `PathExpr.applyStep` charges the processor named in the XPath context. | wall clock; per-instance only | No clock is allowed (R1.4). XPath work happens inside `xpath`, outside any processor method. `xsltjs` already wraps this function globally (`XPathFixes.install`). Ours keeps no state of its own. `Changed at review:` approved; installed at most once (§5.3). |
| D10 | **R10.1 compares the raw engine output, serialised by `xsltjs`'s own `Serializer`** (test-only export), normalised with parse5 (devDependency, MIT). | compare our serialiser's output | R10.1 checks the engine before post-processing. The spike proved this path 106/106. Our serialiser is checked by the goldens and P5. |
| D11 | **Scoped CSS is returned separately** (`css`). Every selector is prefixed with the render root's scope attribute, which comes from a pure 32-bit FNV-1a hash of template URN, version and view name. | shadow DOM in core; one shared `.afl-root` | Core has no DOM. Two views on one page (Compare) must not share rules. |

## 3. Module layout

New code under `packages/core/src/` (folders reserved in structure.md):

| File | Holds |
|---|---|
| `render/prepare.ts` | `prepareView`: view lookup (R1.2, R1.3), XSL parse, compile, position maps for controls and ActiveX |
| `render/render.ts` | `renderView`: input checks, record parse, R2.1 mismatch, engine run, post-processing, result |
| `render/engine/xsltjs.ts` | the adapter: compile, run, loaders, hooks, applyStep wrapper, test-only `engineHtml()` |
| `render/engine/stubs/fs.ts`, `stubs/path.ts` | Worker-build replacements; every member throws `INTERNAL` |
| `render/engine/budget.ts` | `Budget`: steps, depth, output bytes; the abort slot (§6) |
| `render/functions.ts` | the R4.1 bindings over an engine-neutral `FnHost`; the `function-available` set |
| `render/marks.ts` | data paths with positions, required check, `ControlMark` |
| `render/html/` | `sanitise.ts` (§8.2), `resources.ts` (images, icons, ActiveX), `css.ts` (§8.4), `serialise.ts` (§8.3), `own-css.ts` (our fixed rules) |
| `xpath-fns/format.ts` | `formatString` value logic (shared with spec 04) |
| `xpath-fns/values.ts` | dates from `now`, `Avg`, `Nz`, `string-compare` value logic |
| `xml/parse.ts` (changed) | adds `parseXmlDom()`: same decode, prescan and limits as `parseXml`, returns the xmldom `Document` as an opaque `DomDocument`; still the only xmldom importer |
| `limits.ts`, `errors.ts` (changed) | `RenderLimits`, new codes |

Lint (in `eslint.config.js`): `xsltjs`, `xsltjs/*` and `xpath` may be imported only by
`render/engine/xsltjs.ts`. `XSLTProcessor` is banned in all of core. The spec 02 clock ban
(`Date`, `performance`, `crypto`) is extended to `render/**` and `xpath-fns/**`.

### 3.1 Public API (added to `src/index.ts`)

```ts
export async function prepareView(
  template: ParsedTemplate, ir: FormIR, options?: PrepareOptions): Promise<PreparedView>;
export function renderView(prepared: PreparedView, input: RenderInput): RenderResult;
export { DEFAULT_RENDER_LIMITS };
export type { PrepareOptions, PreparedView, RenderInput, RenderResult, ControlMark, RenderLimits };
```

## 4. Types

```ts
interface PrepareOptions {
  /** A FormIR view name; absent: the default view (R1.2). */
  readonly view?: string;
  readonly limits?: Partial<Pick<Limits, 'xmlDepth'>>;
  readonly viewXmlBytes?: number; // XSL budget, 4 MiB as spec 02
}
interface PreparedView { readonly view: IrView; readonly issues: readonly Issue[] } // opaque rest
interface RenderInput {
  /** Record bytes; absent: the template's initialXmlDocument file (R1.2). */
  readonly record?: Uint8Array;
  /** Required ISO 8601 date-time with offset, e.g. `2026-11-10T21:24:10+07:00` (R1.4). */
  readonly now: string;
  readonly locale?: string;   // BCP 47; default en-US
  readonly userName?: string; // default ''
  readonly limits?: Partial<RenderLimits & Pick<Limits, 'xmlDepth' | 'xmlBytes'>>;
}
interface RenderLimits {
  /** Nested template calls, built-in rule calls and xdMath:Eval calls (§6). */
  readonly templateDepth: number;   // 128 (task 5)
  /** Per instruction 1; per XPath step 1 + nodes; per string result ceil(length / 16). */
  readonly evaluationSteps: number; // 200,000 (task 5)
  /** Characters added to any result tree, the main one or a variable's, plus 64 per node. */
  readonly outputBytes: number;     // 4 MiB
}
interface RenderResult {
  readonly html: string; // <div class="afl-root" data-afl-scope="s…" inert>…</div>
  readonly css: string;  // view rules scoped to the root, then our own rules
  readonly issues: readonly Issue[];
  readonly marks: readonly ControlMark[]; // one per rendered bound control, document order
}
interface ControlMark {
  readonly controlId: string; // FormIR BoundControl.id
  readonly path?: string;     // with positions; absent for an ExpressionBox or no node
  readonly fieldId?: string;
  readonly empty: boolean;
  readonly required: boolean; // R6.6: the asterisk was drawn
}
```

`Limits` is spec 01's. `LIMIT_EXCEEDED.details.limit` widens to `keyof Limits | keyof RenderLimits`.

### 4.1 Errors and issues

Fatal (`AfterlifeError`, nothing returned):

| Code | Details | When |
|---|---|---|
| `VIEW_NOT_RENDERABLE` (new) | `view`, `reason: 'unknown' \| 'missing' \| 'unparsed'` | R1.3, at prepare |
| `RENDER_FAILED` (new) | `view`, `xsltCode`, `message`, `line?`, `column?` | an `XsltError` at compile or run; `xsl:message terminate="yes"`; any other `RangeError` (`xsltCode: 'RangeError'`) |
| `INVALID_RENDER_INPUT` (new) | `field: 'now' \| 'locale' \| 'record'`, `value` | `now` not ISO 8601 with offset; a locale that is not BCP 47; no record and no `initialXmlDocument` file (task 2) |
| `LIMIT_EXCEEDED` | `limit` (now also a `RenderLimits` key), `max`, `observed` | §6; a stack-overflow `RangeError` |
| `INVALID_XML`, `UNSAFE_XML` | as spec 01 | record or XSL (R1.5) |
| `INTERNAL` | `reason` | an `fs`/`path` stub was reached |

Issues (new codes; aggregated ones carry counts in `details`): `RECORD_TEMPLATE_MISMATCH`
(R2.1), `SECONDARY_DATA_UNAVAILABLE` (R2.2), `EXTERNAL_RESOURCE_BLOCKED` (R3.2),
`UNKNOWN_FUNCTION` (R4.4), `FORMAT_UNSUPPORTED`, `LOCALE_UNSUPPORTED`, `EXPRESSION_FAILED` (§7),
`OUTPUT_ESCAPING_IGNORED` (D6), `CONTENT_REMOVED` (§8.2), `UNSUPPORTED_CONTROL` (R6.2),
`XSL_MESSAGE`, `ENGINE_WARNING` (§5.3), `CONTROL_NOT_MARKED` (§9.1). The record's `INVALID_ENCODING` and `XML_WARNING` pass
through.

## 5. Engine adapter (`render/engine/xsltjs.ts`)

### 5.1 Loaders (R3.2)

- **URIs.** The view compiles with `transformURL: 'xsn:///' + view.xslFile`. A scheme in the base
  sends `Stylesheet.resolve` to `new URL()`, never `path.resolve`, and `../` cannot leave the
  root (`new URL('../../etc/x', 'xsn:///view1.xsl')` is `xsn:///etc/x`, no package file).
- **`loader`** (async; `xsl:import`, `xsl:include`): `xsn:///<name>` naming a package file (spec 01
  file-reference rule) passes the xml/ prescan (no DOCTYPE, depth, bytes) and returns its text,
  which `xsltjs` parses with xmldom 0.9.12 (no entities, no fetch; tech.md). Anything else returns
  `EMPTY_XSL`, `<xsl:stylesheet version="1.0" xmlns:xsl="…/XSL/Transform"/>`, and records
  `EXTERNAL_RESOURCE_BLOCKED {uri}` in `PreparedView.issues` (repeated in every render). Yes, an
  empty stylesheet works for both: `Stylesheet.gather` parses it, an include adds zero
  declarations, an import adds an empty module, and neither throws.
- **`documentLoader`** (sync; `document()`): a package XML file parsed by `parseXmlDom`, cached
  per render; otherwise `null` (empty node-set) plus `EXTERNAL_RESOURCE_BLOCKED`. `document('')`
  never reaches it (`Functions.document` returns the stylesheet).
- Both options are always functions, so `Stylesheet.defaultLoader` and the `fs` branch of
  `loadDocumentSync` are unreachable. **Default-loader test:** in Node, `fs.readFileSync`,
  `fs.promises.readFile` (the module object `xsltjs`'s `require('fs')` returns) and
  `globalThis.fetch` become throwing spies; all 53 views prepare and render with both records,
  plus synthetic `http:`, `file:` and absolute includes, imports and `document()` calls; every
  spy has 0 calls. The Worker parity run repeats it with the stubs.

### 5.2 `fs` and `path` stubs (Worker build)

`Stylesheet.js` has `require('fs')` and `require('path')` at module level. Browser and Worker
bundles map them to `render/engine/stubs/fs.ts` (`readFileSync`, `promises.readFile`) and
`path.ts` (`resolve`, `dirname`); every member throws `INTERNAL {reason: 'xsltjs reached fs'}`.
`test/helpers/worker-bundle.ts` applies the mapping only for importers under
`node_modules/xsltjs/` and still refuses every other built-in. Spec 09's Vite config and the Forge
Custom UI bundles need the same alias (README build section, task 1). Node keeps the real modules,
never called (§5.1 test).

### 5.3 Internals used, and how

The package has no `exports` map, so `xsltjs/scripts/*.js` can be imported directly. Every use is
listed here, and the guard test (§11) checks each one.

| File | Member | Our use |
|---|---|---|
| `XSLT.js` | `XSLT.compile(doc, {transformURL, loader})` | public API: compile at prepare |
| `Processor.js` | `new Processor(stylesheet, options)` | one per render; options: `customFunctions`, `documentLoader`, `onMessage`, a silent `logger` that turns `warn` calls into `ENGINE_WARNING` |
| `Processor.js` | `transform(sourceDoc)` returns a `DocumentFragment` | the result tree |
| `Processor.js` | `invokeTemplate`, `builtInRule` | depth: wrapper increments, calls through, decrements in `finally` |
| `Processor.js` | `executeInstruction` | +1 step |
| `Processor.js` | `literalResultElement(element, ctx)` | marks (§9) |
| `Processor.js` | `appendText`, `appendNode`, `setAttribute`, `copyNode` | output bytes (§6). `copyNode` recurses through `this.copyNode`, `this.appendNode` and `this.appendText`, so each copied node is charged once; the hook adds only the attributes of a deep-copied element, which bypass `setAttribute` |
| `Processor.js` | `compile(text, styleNode)`, `evaluate(text, ctx, styleNode)` | `xdMath:Eval`; mark bindings |
| `Processor.js` | `functions` (a `Functions`): `find(local, ns)`, `isAvailable(local, ns)` | unknown functions and availability (§7.2); string charges (§6) |
| `Processor.js` | `static MAX_DEPTH` (3000) | the guard asserts it is above `templateDepth` |
| `Serializer.js` | `new Serializer(output, cdata).serialize(fragment)` | test-only `engineHtml()` for R10.1 |
| `xpath` 0.0.36 | `PathExpr.applyStep(step, xpc, node)` | charges `xpc.xslt.processor`'s budget (D9) |

- Each hook is an own property of the new instance, such as `p.executeInstruction = (el, ctx) =>
  { budget.step(); return proto.executeInstruction.call(p, el, ctx); }`. `Processor` calls these
  as `this.x(...)` and `Functions.resolver()` calls `functions.find` on the instance, so the
  instance properties win.
- **The `applyStep` wrapper** is installed when the adapter loads, after `XPathFixes`. It holds
  no state: `const b = xpc?.xslt?.processor?.[BUDGET]; const r = orig.call(this, step, xpc,
  node); b?.charge(1 + r.length); return r;`. Outside one of our renders, `b` is undefined, so
  other users of `xpath` pay nothing. `Changed at review:` it is idempotent. The wrapper carries
  `Symbol.for('afterlife.applyStep')`; a second load of the adapter (a test re-import, Vite HMR)
  sees the mark on `PathExpr.applyStep` and does nothing, so no step is charged twice. The guard
  test checks the chain holds exactly one marked wrapper.
- **One xmldom, one xpath.** `xpath` is a direct dependency, pinned to 0.0.36. `Changed at
  review:` root `pnpm-workspace.yaml` `overrides` pins `@xmldom/xmldom` to 0.9.12 and `xpath` to
  0.0.36, so a newer release and a lockfile refresh cannot give `xsltjs` a copy core never
  checked. The guard asserts that `xsltjs` resolves the same module instance of both as core:
  `XPath` from `xpath` equals the `this.XPath` passed to custom functions, and `xsltjs`'s
  `DOMImplementation` is xmldom's.
- **Errors.** `xsltjs` wraps foreign errors (`XsltError.wrap`, `cause` kept). So a hook that stops
  the render first stores its `AfterlifeError` in the budget's abort slot, then throws it. The
  adapter rethrows the stored error, whatever arrives. Any other `XsltError` becomes `RENDER_FAILED
  {view, xsltCode, message, line, column}`. `Changed at review:` only a stack-overflow
  `RangeError` (message `Maximum call stack size exceeded`, in V8 for Node and Chromium; found
  directly or as the `cause` of an `XsltError`) becomes `LIMIT_EXCEEDED {limit: 'templateDepth'}`.
  Any other `RangeError` (invalid string length, invalid array length) becomes `RENDER_FAILED`,
  never a crash.
- `xsl:message` gives `XSL_MESSAGE {count}`; with `terminate="yes"`, `RENDER_FAILED`.

## 6. Limits (R3.3)

| Limit | Default | Measured max (53 / private) | Why this default |
|---|---|---|---|
| `templateDepth` | 128 | 3 / 3 template calls (form 06: 4 with its built-in rule call) | `Changed at task 5:` was 256, equal to `xmlDepth`. A fresh Chromium Worker overflows its stack between 200 and 230 levels of a `call-template` chain with our hooks (bare `xsltjs`: between 280 and 300); the per-instruction step hook is most of the difference. 128 leaves about 40 % headroom there, and 32 times form 06. A record nested deeper than 128 that a view walks with built-in rules now stops with `LIMIT_EXCEEDED`. A stack overflow before the limit (a view with many elements per level) is still `LIMIT_EXCEEDED templateDepth` (§5.3), never a crash. |
| `evaluationSteps` | 200,000 | 2,337 instructions + 531 `applyStep` calls + 22 string steps / 343 + 130 + 4 | About 70 times the measured work. `Changed at task 5:` was 1,000,000. The nested `for-each` bomb took 3.96 s to reach 1,000,000 in Node 22; `xsltjs` alone runs about 4 µs per step there (our hooks add about 1 %), so 200,000 is reached in under 1 s. |
| `outputBytes` | 4 MiB | 451,925 / 74,174 (characters + 64 per node; form 08: 1,471 elements) | 9 times form 08. 64 per node approximates xmldom's memory per node (measured about 620–780 bytes per element), so 4 MiB stops at about 65,000 nodes, about 46 MB. Package images count towards it. |

`Changed at review:` two growth paths that no other limit sees.

- **Strings.** A template recursing on `concat($s, $s)` reaches V8's string maximum (about 2^29
  characters) in about 30 calls, with few steps, little depth and no output. The `functions.find`
  override wraps the string-building core functions (`concat`, `substring`, `substring-before`,
  `substring-after`, `translate`, `normalize-space`, `string`) and `xdFormatting:formatString`.
  Each result charges `ceil(length / 16)` steps. Measured max per render: 344 characters (form
  08) and 50 (private), 22 and 4 steps, 0.002 % of the budget. At the default, the steps charged
  for strings in one render stop at 3.2 million characters, 6.4 MB as UTF-16 (`Changed at task 5:`
  with the new default; was 16 Mi characters), so a doubling bomb stops
  before its next string reaches 64 MiB.
- **Result tree fragments.** A variable's content is built with the same `appendText`,
  `appendNode`, `setAttribute` and `copyNode` calls into a fragment, so `outputBytes` counts it.
  `copy-of $x` twice into a new variable is charged for both copies.

Task 5 adds a string-doubling bomb and a fragment-doubling bomb. Both must stop with
`LIMIT_EXCEEDED` before 64 MiB is built.

Each limit overrun throws `LIMIT_EXCEEDED {limit, max, observed}` and returns no partial HTML.
The record parse keeps spec 01's `xmlDepth` and `xmlBytes`.

## 7. Extension functions (R4)

### 7.1 The implemented set

Bindings live in `render/functions.ts` over `FnHost`, which the adapter implements: `str`, `num`,
`nodes`, `evalXPath(text, contextNode)`, `makeNodes(values)` (text-only elements in a per-render
scratch fragment), and `issue`. Value logic is in `xpath-fns/`.

`Changed at task 6:` as built, each argument is an `FnArg` (`string()`, `number()`, `nodes()`,
`nodeSet()`) and `FnHost` has `report`, `makeNodes`, `document(file)`, `emptyDocument()`,
`evaluate(expr, node)` (the calling element's namespaces, from the XPath context `xsltjs`
passes), `nested(fn)` (one `templateDepth` level) and `chargeOutput`. The scratch elements are
children of one `values` document per render (`xml/parse.ts` `scratchDocument()`), and each
`makeNodes` call charges `outputBytes` like result nodes (64 per node plus characters); a nested
`Eval` over 100 nodes stops there, in about 0.6 s. `Nz` treats a value of XML whitespace only as
blank. Per-render issue sets live in the table `functionTable()` builds for each render.

| Function | Our semantics | Source | Edge cases |
|---|---|---|---|
| `xdFormatting:formatString(value, type, options)` | Types `date`, `datetime`, `time`, `number`, `currency`, `percentage`, `string`. Options are `key:value;` pairs: `dateFormat`, `timeFormat`, `numDigits` (n or `auto`), `grouping`, `negativeOrder`, `positiveOrder`, `currencyLocale`, `plainMultiline`. en-US tables: Short Date `M/d/yyyy`, time `h:mm:ss tt`, Windows NEGCURR orders. Rounding is half away from zero on the decimal string. | MS-IPFF2 §2.4.3 [VERIFY: subsection]; the 12 corpus patterns (`docs/feature-coverage.md`); `docs/infopath-ux.md` §3–4 **[seen]** `11/3/2026`, `$350.30` | Empty → ''. Unparseable value → unchanged (R4.3). Unknown type or option → value unchanged + `FORMAT_UNSUPPORTED {type, option}`. Date and time values are shown as written, with no time-zone conversion. A locale other than en-US → en-US + one `LOCALE_UNSUPPORTED`. `currencyLocale` other than 1033 → same. [VERIFY: InfoPath's rounding mode; one unit case per corpus pattern decides it.] |
| `xdXDocument:GetDOM(name)` | The parsed package file of the `xmlFileAdapter` data object `name` whose endpoint is `package` (spec 02 R8.3), cached per render | MS-IPFF2 §2.4.3.9 [VERIFY: subsection]; MS-IPFF getDOM | Any other or unknown name → an empty document + one `SECONDARY_DATA_UNAVAILABLE {dataSource}` per name per render (R2.2). |
| `xdXDocument:GetNamedNodeProperty(node, name, default)` | Returns `default` | MS-IPFF2 §2.4.3.9.3; the review answer (every private call reads state the runtime sets) | A missing third argument → ''. |
| `xdImage:getImageUrl(nodes)` | Exactly one element node whose text is base64 for a PNG, GIF, JPEG or BMP (magic bytes) → a `data:image/<type>;base64,…` URL; otherwise '' | MS-IPFF2 §2.4.3.5.1 ("returns the URL of the node contained in nodes, if nodes do not contain one element, return nothing") | Picture controls store base64 images. File attachments carry a header, so they give '' (spec 11 decodes them). The URL counts towards `outputBytes`. |
| `xdDate:Today()` | `YYYY-MM-DD` of `now`, in `now`'s own offset | MS-IPFF2 §2.4.3 [VERIFY]; R1.4 | No clock. |
| `xdDate:Now()` | `YYYY-MM-DDThh:mm:ss` of `now`, offset dropped | as above [VERIFY: InfoPath's `now()` format; spec 04 must agree] | Fractional seconds dropped. |
| `xdMath:Avg(nodes)` | Sum of `number()` over the nodes / count | MS-IPFF2 §2.4.3 example (6, 12, 15 → 11) [VERIFY: subsection] | Empty set → NaN. A non-numeric node → NaN. |
| `xdMath:Nz(nodes)` | A node-set from `makeNodes`: each value, or `0` when blank | InfoPath `nz()` (`docs/feature-coverage.md` C) [VERIFY: MS-IPFF2 subsection] | A single node works in arithmetic through `number()` of the first node. |
| `xdMath:Eval(nodes, expr)` | For each node, `expr` is compiled by the processor's XPath compiler (`Processor.compile`, cached per render) with the caller's namespaces, and evaluated with that node as context; the results form a node-set from `makeNodes` | InfoPath `eval()` [VERIFY: MS-IPFF2 subsection] | Never JavaScript. Its work counts against `evaluationSteps`, and each call counts one level of `templateDepth`, so nested `Eval` is bounded. A compile or evaluation error → '' + `EXPRESSION_FAILED {expr}`. |
| `xdUser:get-UserName()` | `input.userName ?? ''` | MS-IPFF2 §2.4.3 [VERIFY]; R4.5 | — |
| `msxsl:node-set(x)` | Result tree fragment → its nodes; node-set → itself; other values → one text node | MSXML "msxsl:node-set Function" [VERIFY: URL] | — |
| `msxsl:string-compare(a, b[, lang[, opts]])` | -1 / 0 / 1 by UTF-16 code units; `opts` containing `i` compares lowercased ASCII | MSXML "ms:string-compare Function" [VERIFY: URL] | `lang` is ignored, since there is no `Intl` (D8). MSXML compares by locale, so non-ASCII order can differ; form 01 compares ISO dates, where code units agree. |

`Changed at task 7:` `formatString` as built (`xpath-fns/format.ts`):

- **Patterns.** Counted as distinct type + options strings, the corpus has 14, one unit case each;
  `docs/feature-coverage.md` D groups some of them (the `datetime` and `number` variants) and
  says 12. Beyond the five of the 53 views: `datetime` with `timeFormat:none` and with the
  pictures `dd MMMM, yyyy` and `dd-MMM-yy`; `time` with no options; `number` with
  `negativeOrder:1` and no `grouping`, and with `numDigits:auto`; `percentage`; `string` with
  `plainMultiline`.
- **Dates and times.** Named formats `Short Date` (`M/d/yyyy`) and `Long Date`
  (`dddd, MMMM d, yyyy`); otherwise a Windows picture (`d`–`dddd`, `M`–`MMMM`, `y`, `yy`, `yyyy`,
  `h`, `hh`, `H`, `HH`, `m`, `mm`, `s`, `ss`, `t`, `tt`, `'quoted'` text). An unquoted letter
  outside that set, or a longer run, is `FORMAT_UNSUPPORTED {option: 'dateFormat'}`. `time`
  with no `timeFormat` uses `h:mm:ss tt`. [VERIFY: InfoPath's default for `time` with no
  options; no screenshot shows one.]
- **Numbers.** `numDigits:auto` keeps the fraction as written. `grouping` absent means none.
  Order tables: LOCALE_INEGNUMBER 0–4 (default 1), LOCALE_ICURRENCY 0–3 (default 0),
  LOCALE_INEGCURR 0–15 (default 0), LOCALE_IPOSITIVEPERCENT 0–3 (default 1, `n%`),
  LOCALE_INEGATIVEPERCENT 0–11 (default 1). A percentage is the value × 100 on its digits.
  [VERIFY: the default positive percent order; the corpus writes only `negativeOrder:1`.]
- **Issues.** `FORMAT_UNSUPPORTED {type, option}` (option `type` for an unknown type) once per
  pair per render; `LOCALE_UNSUPPORTED {locale}` once per locale per render, for a render locale
  other than en-US and for a `currencyLocale` other than 1033. Both format as en-US or leave the
  value unchanged as the table says; an unparseable value is unchanged with no issue (R4.3).
- **Rounding stays `[VERIFY]`.** Half away from zero on the digits is kept. No value in the
  first records of forms 01–08, the ones with screenshots, has more fraction digits than its
  `numDigits`, so no screenshot can settle it. A record built for it, opened in InfoPath, would.

### 7.2 `function-available` and unknown functions (R4.2, R4.4)

- **Allowed set**: the 27 XPath 1.0 core functions, the 9 XSLT 1.0 functions, and the 12 rows
  above, by namespace URI and local name.
- `p.functions.isAvailable` → `allowed(local, ns) && origFind(local, ns) !== undefined`.
  `xsltjs`'s own extras (`replace`, `matches`, `lower-case`, `upper-case`, `ends-with`,
  `string-join`, `tokenize`, `counter`) and `xsl:function` functions are therefore not available,
  as in MSXML.
- `p.functions.find` → the original function when allowed. Otherwise a stub that returns `''`
  and counts the call: one `UNKNOWN_FUNCTION {name, calls}` per expanded name per render. A
  guarded call never reaches the stub, because its `xsl:when` is false.
- **Fallback mode** (test-only adapter option `{fallback: true}`): `isAvailable` is false for
  every name in a non-empty namespace, and no custom functions are registered. This is what
  `xsltproc` does with an unknown extension (R10.1).

## 8. Post-processing without a DOM (R5, R6)

### 8.1 Order

One walk over the result tree, in this order; each step needs what the one before leaves.

1. **Structure.** Use `html > body`, or the whole fragment. Collect every `style` element's text
   for step 9, drop `head`, and move `body`'s `style`, `class`, `dir`, `lang` onto the root `div`.
2. **ActiveX placeholder** (R6.2), before sanitising drops `object`: an `object` with a
   `classid` becomes `<div class="afl-unsupported">Custom control {GUID}: not supported</div>`
   with its sanitised width and height; one `UNSUPPORTED_CONTROL {classid, controlId?, count}`
   per classid. `Changed at task 8:` its `param` children go with it and are not counted (the
   private views' 79 removed elements were 72 `param` and 7 `object`, all ActiveX).
3. **`res:` icons** (R6.4): `img` with `res://infopath.exe/calendar.gif` or `…/pictureclick.gif`
   (any case) becomes `<span class="afl-icon afl-icon-calendar|picture" aria-hidden="true">`.
   `Changed at task 8:` `signaturevalid.gif`, `addsignaturebutton.gif` and `signatureerror.gif`
   become `afl-icon-signature`; any other `res://infopath.exe/` image becomes `afl-icon-unknown`
   with the image's width and height, and one `CONTENT_REMOVED {kind: resource}` names the file.
   Other `res:` URLs fall to step 5.
4. **Package images** (R6.1): a relative `src` naming a package file (spec 01 rule) whose magic
   bytes say PNG, GIF, JPEG or BMP becomes a base64 data URL (chunked `btoa`, a global in Node 22
   and Workers).
5. **Sanitise** (§8.2); one `CONTENT_REMOVED {kind, count}` per kind.
6. **Control marks** (§9): `data-afl-ctrl`, `data-afl-path` on recorded elements that survived
   step 5. Step 5 removed any `data-afl-*` from the view, so marks cannot be forged.
7. **Required asterisk** (R6.6, §9.2): class `afl-required`; after an `input`, `select` or
   `textarea`, which cannot show `::after`, a `<span class="afl-required-mark">*</span>` instead.
8. **Inert controls** (R5.4): remove `contenteditable`, `tabindex`, `accesskey`, `autofocus`;
   prefix `id`, `name`, `for` with `afl-` (no page globals shadowed by name). The root carries
   `inert`: no focus or input in the subtree, same look. `Changed at review:` constraint for spec
   09: under `inert`, hit testing skips the subtree, so `event.target` never names a control and
   `title` ScreenTips do not show. The X-ray finds controls by geometry
   (`getBoundingClientRect` of `[data-afl-ctrl]`) on an overlay, and shows the ScreenTip text in
   its panel.
9. **Serialise** (§8.3), **scope the CSS** (§8.4), and append `own-css.ts`: the asterisk
   (`::after`, about 8 px, `#FF0000`, right 3 px, vertically centred), CSS-drawn icons (no
   Microsoft asset), the placeholder box, the R6.3 rule, and `contain: layout paint` on the root
   so `position: fixed` cannot leave it. `Changed at task 8:` the date picker as InfoPath laid
   it out: the legacy `nowrap` attribute means `white-space: nowrap` (zero specificity), and
   `div.xdDTPicker` is one `inline-flex` line inside its cell, the `xdDTText` taking the free
   width and the `xdDTButton` at the right holding the calendar icon (the view's `display:
   inline` and `margin-left: -21px` are overridden). `Changed at review:` R6.3 is
   `:where(.afl-root [data-afl-ctrl]){min-height:1lh}` plus
   `:where(.afl-root span[data-afl-ctrl]){display:inline-block}`. `min-height` does nothing on an
   inline element, and InfoPath text boxes are `span`s. `:where()` has zero specificity, so any
   `display` the view sets, in its classes or inline (`DISPLAY: none` on hidden sections), still
   wins. Task 8's browser test is the oracle.

### 8.2 Sanitiser rules (R5.1, R5.2)

- **Dropped with content:** `script`, `style` (already collected), `iframe`, `frame`,
  `frameset`, `embed`, `applet`, `base`, `link`, `meta`, `title`, `head`, `noscript`, `noembed`,
  `noframes`, `xmp`, `plaintext`, `template`, `svg`, `math`, `audio`, `video`, `source`,
  `track`, `canvas`, `param`.
- **Kept:** `a abbr address b big blockquote br button caption center cite code col colgroup dd
  del dfn div dl dt em fieldset font h1–h6 hr i img input ins kbd label legend li nobr ol
  optgroup option p pre q s samp select small span strike strong sub sup table tbody td textarea
  tfoot th thead tr tt u ul var wbr`, in no namespace or the XHTML namespace.
- **Unwrapped** (element gone, children kept): everything else, including `html`, `body` and
  `form`.
- **Attributes:**
  - names must match `^[a-z_:][a-z0-9_:.-]*$` after lowercasing;
  - drop `on*`, `xmlns*`, `srcdoc`, `action`, `formaction`, `xlink:href`, `ping`, `data-afl-*`;
  - `href` (only on `a`) keeps `http:`, `https:` and `mailto:`;
  - `src`, `srcset`, `poster`, `background`, `lowsrc`, `dynsrc` and `data` keep only
    `data:image/(png|gif|jpeg|bmp);base64,…`. The scheme is read after removing ASCII whitespace
    and control characters and lowercasing, as the URL parser does. SVG data URLs are refused;
  - `style` goes through the declaration filter (§8.4);
  - `class`, `title`, `xd:*` and the remaining HTML attributes stay (R5.2).

### 8.3 Serialiser

- Lowercase names; void elements (`br col hr img input wbr`) get no end tag and lose children.
  Text escapes `& < >`, attribute values `& " < >`; U+0000 becomes U+FFFD. A `pre` or `textarea`
  whose text starts with LF gets one extra LF (WHATWG rule). No comments, PIs or doctypes.
- `xsltRaw` (disable-output-escaping) is ignored (D6). One `OUTPUT_ESCAPING_IGNORED {nodes}`
  issue per render when any raw text node is present (0 for the 53 views, at most 17 sites in
  the private ones).

### 8.4 CSS: declaration filter and scoping (R5.1, R5.5)

- **Tokenizer:** our own, for blocks, strings, comments, escapes and parentheses. CSS escapes
  (`e\78pression`) are decoded and comments removed before any check.
- **Dropped declarations:** the properties `behavior`, `-ms-behavior` and `-moz-binding`; any
  value containing `expression(`, `image(`, `image-set(`, `-webkit-image-set(`, `element(` or
  `src(`; any `url()` that is not a raster data URL.
- `Changed at review:` **InfoPath runtime constructs are dropped silently**, not counted in
  `CONTENT_REMOVED`: `behavior` declarations whose every `url()` is `#default#…` (all 47 own
  forms: `CalPopup`, `urn::controls/Binder`, `DTPicker`, `xOptional`, `urn::xdPicture`,
  `urn::xdFileAttachment`, `urn::tables/NDTable`, written `url(…)` or `url (…)`); the head's
  `meta` and `title`; `xmlns*` attributes; `contenteditable`, `tabindex` and `hidefocus` (step 8).
  `CONTENT_REMOVED` is then for content a view really carried. Expected: 0 on every own render;
  task 9 reports counts by kind, and any other InfoPath-only construct found there joins this
  list with a design edit.
- **At-rules:** `@media` blocks are kept and their rules scoped. All other at-rules are dropped
  (`@import`, `@font-face`, `@namespace`, `@charset`, `@page`).
- **Selectors** (lists split at top-level commas): a leading `html`, `body` or `:root` compound
  becomes the root scope `.afl-root[data-afl-scope="sX"]`; any other selector gets the scope as an
  ancestor prefix; one that does not tokenize cleanly is dropped (`CONTENT_REMOVED`).

## 9. Control marks (R6.5, R6.6, R6.7)

### 9.1 Technique

- **At prepare:** a map `file:line:column` → `BoundControl` from FormIR `view.controls[].source`,
  which spec 02 took from the same xml/ parser that parses the XSL we compile. The compiled
  stylesheet keeps those element nodes (`stripStylesheet` removes whitespace text only), so
  positions match. `Changed at review:` the key includes the file. The adapter tags each module's
  document with its package file name (`xsltBaseURI` minus `xsn:///`), so an element in an
  included stylesheet cannot collide with one in the view. An element with `xd:binding` in a
  file FormIR did not scan gets no mark, and is counted in one `CONTROL_NOT_MARKED {count}`.
- **In the run:** the `literalResultElement` hook calls the original method, which appends the
  created element to `ctx.out` and builds its content. It then finds the control by the element's
  position. If the control has a `targetId`, the hook evaluates its `xd:binding` with
  `p.evaluate(binding, ctx, element)`, which is relative to `ctx.node` and uses the element's
  namespaces. It records `ctx.out.lastChild` → `{control, node}` in a per-render `WeakMap`. An
  ExpressionBox (`readOnly`), an error, or an empty node-set gives a mark with no path and no
  issue; FormIR already reported the binding.
- **The path:** walk from the node to the document. Each step uses the `Manifest.namespaces`
  prefix (`{uri}local` when there is none, spec 02's data-path rule) and the 1-based position
  among same-name siblings; attributes use `/@name`. Example:
  `/my:expenseClaim[1]/my:expenses[1]/my:expense[2]/my:amount[1]`.
- **The R10.1 HTML is unchanged.** The hook adds nothing to the XSL or the result tree; marks
  reach the HTML only in §8.1 step 6. Test: in fallback mode, `engineHtml()` with all hooks on is
  byte-identical to a bare `XSLT.run` for all 106 renders.
- Known gap: a bound element built in a variable and copied out with `copy-of` is a new node with
  no mark. The goldens and the private check count FormIR controls that got no mark.

### 9.2 Required asterisk

Drawn when the control has a `targetId`, its node is empty (no element children, empty string
value), and the field is `required` or the target of a blank check: a validation of `kind: blank`,
or `kind: errorCondition` with `expressionContext` `.` and expression `.=""` once whitespace is
removed. Form 01: four marks with the empty record (`manifest.xsf` lines 79–82), none with
`-001.xml`.

### 9.3 File attachments (R6.7)

`Changed at review:` added with R6.7. When a marked control's FormIR `xctname` is
`FileAttachment` and its node is not empty, `render/attachment.ts` reads the node's text as
base64 of the file attachment structure of [MS-IPFFX] §2.1.3.1 "File Metadata"
(learn.microsoft.com/openspecs/sharepoint_protocols/ms-ipffx/4cae5bf1-f3a0-4592-87d8-fe457e7951af),
little-endian:

| Offset | Field | Rule (MS-IPFFX) |
|---|---|---|
| 0 | signature | bytes `C7 49 46 41` |
| 4 | header size | 20 |
| 8 | version | 1 |
| 12 | reserved | 0 |
| 16 | file size | bytes in the file part |
| 20 | file name length | UTF-16 code units, one terminating zero included, greater than 1 |
| 24 | file name | length × 2 bytes, UTF-16LE, ending with zero |

- Only the first `24 + 2 × length` bytes are decoded (`atob` on that many base64 characters).
  The declared size is checked against the base64 length, so the file bytes are never decoded.
- Problems, each giving the icon alone and one `ATTACHMENT_UNREADABLE {problem, count}` per
  problem per render: `base64`, `truncated` (data ends inside the header or the name), `signature`,
  `header` (size, version or reserved), `nameLength` (below 2 or above 1,024 units, our cap;
  MS-IPFFX sets none), `name` (a zero inside or none at the end), `size` (declared size is not
  the data size).
- After step 6, the control gets `<span class="afl-attachment">` holding
  `span.afl-icon.afl-icon-file` (CSS, no Microsoft asset), `span.afl-attachment-name` (a text
  node: the serialiser escapes it) and `span.afl-attachment-size` (`109 bytes`). Lone surrogates
  in the name become U+FFFD.
- The view's own `xd:inline` attribute on the control still carries the base64 text, as R5.2
  keeps `xd:*` attributes; it is an attribute value, escaped, never decoded.

## 10. References, goldens, determinism, performance (R1.1, R5.3, R7, R9, R10.1)

- **`xsltproc` references.** `packages/core/scripts/gen-xsltproc-refs.ts` (run like
  `gen:ms-ipff2`) runs `/usr/bin/xsltproc --nonet <view> <record>` over the 53 views and both
  records. It writes the raw output to `test/golden/render/xsltproc/<slug>/<view>.<empty|first>.html`
  (106 files) and `VERSION.txt` (`xsltproc --version`, today libxml 20913 and libxslt 10135, and
  the date). The public sample is extracted with `bsdtar` to a temp folder.
- **Normalisation (R10.1)**, applied to both sides:
  1. parse as HTML with parse5;
  2. drop comments and the doctype;
  3. drop the `meta` whose `http-equiv` is Content-Type;
  4. drop `xmlns` and `xmlns:*` attributes;
  5. sort attributes by name;
  6. collapse whitespace runs to one space and trim, in text and attribute values;
  7. empty the values of HTML boolean attributes (`checked selected disabled nowrap readonly
     multiple noshade compact defer ismap nohref noresize declare`);
  8. rename `generate-id()` values in order of first appearance. In the 53 views these are the
     `name` attributes of `input` elements; the spike needed no other.
- **Goldens:** 106 files `test/golden/render/<slug>/<view>.<empty|first>.json` (`{html, css,
  issues, marks}`; `now = 2026-11-03T09:00:00-08:00`, en-US, user `Test User`), via spec 01's
  `toMatchFileSnapshot` helper.
- **P4.** Determinism rests on: no clock, `Intl` or randomness in our modules (lint); a new
  `Processor` per render, so `generate-id`'s `nextId` starts at 1; insertion-ordered maps; and a
  fixed issue order (prepare, record parse, engine in first-occurrence order, post-processing).
- **Worker parity (R5.3):** the spec 01 harness renders the 106 golden inputs in a Chromium
  Worker built with the §5.2 stubs and `fetch` replaced by a throwing function, and compares the
  bytes with the goldens.
- **Performance (R9):** `test/perf/render.perf.test.ts` (Node) and
  `test/browser/render-perf.browser.test.ts` (Worker): 2 warm-ups and 20 timed renders per view
  and record; fail on p95 ≥ 100 ms; form 08 on its own line. Spike engine-only worst p95: 27.9 ms
  Node, 10.8 ms Worker (form 08).

## 11. Test plan

| Requirement | Kind | Fixture | Test file |
|---|---|---|---|
| R1.1, R1.2 | golden | 53 views × empty and first records | `test/render/golden.samples.test.ts` |
| R1.3 | unit | unknown name; spec 02 missing-view and broken-view fixtures | `test/render/prepare.test.ts` |
| R1.4 | lint + type + unit | `now` missing (`@ts-expect-error`); bad `now` → `INVALID_RENDER_INPUT` | `test/lint/restricted.test.ts`, `test/render/input.test.ts` |
| R1.5 | unit | spec 01 XML safety fixtures as records | `test/render/input.test.ts` |
| R2.1, R2.2 | unit + golden | form 01 record with form 07; forms 03, 04 | `test/render/data.test.ts` |
| R3.1 | golden + local | as R1.1; private check | — |
| R3.2 | unit | synthetic `http:`, `file:`, absolute, package include/import, `document()`; **default-loader test** (§5.1) | `test/render/loaders.test.ts` |
| R3.3 | unit + browser | recursion, nested `for-each` bomb, output bomb, `copy-of` bomb, 128 levels in Worker | `test/render/limits.test.ts`, `test/browser/render-limits.browser.test.ts` |
| R3.4 | lint + unit | `XSLTProcessor` ban; the `license` of every production dependency of `packages/core`, transitive ones included, read offline from its installed `package.json` (`Changed at review:` the lockfile has no licence field) | `test/lint/restricted.test.ts`, `test/render/licences.test.ts` |
| R4.1–R4.5 | unit | one case per function and per corpus pattern; guard view listing every name | `test/xpath-fns/format.test.ts`, `test/render/functions.test.ts` |
| R5.1, R5.2 | unit | one case per §8.2 rule and §8.4 rule | `test/render/sanitise.test.ts`, `test/render/css.test.ts` |
| R5.3, R7.1 | browser | Worker parity over 106 goldens | `test/browser/render-parity.browser.test.ts` |
| R5.4, R5.5, R6.3 | browser | forms 01–08 inside a page | `test/browser/render-dom.browser.test.ts` |
| R6.1–R6.4 | unit | synthetic package image; form 44; forms 02, 08 | `test/render/resources.test.ts` |
| R6.5, R6.6 | unit + golden | form 02 first record; form 01 both records; synthetic `errorBlank` and non-nillable date | `test/render/marks.test.ts` |
| R6.7 | unit | form 02 first record; truncated header; name-length overflow; markup in a name | `test/render/attachment.test.ts` |
| R7.1 (P4) | property, 200 runs | sample record with text values replaced by generated strings; generated `now`, locale, user name; permuted view order | `test/property/p4.property.test.ts` |
| R8.1 (P5) | property, 500 runs, Chromium | generated XSL + records from the R8.1 shapes. Oracle: `template.innerHTML` and `CSSStyleSheet.replaceSync` in Chromium, then a walk for R5.1 items | `test/browser/p5.browser.test.ts` |
| R9.1 | perf | 106 renders, Node and Worker | §10 |
| R10.1 | golden | 106 `xsltproc` references; hooks-on vs bare `XSLT.run` | `test/render/xsltproc.test.ts` |
| R10.2 | visual | 16 default-view renders | `test/browser/visual.browser.test.ts` |
| R10.3 | local | private folder minus `own/` | `test/render-private.local.test.ts` |
| D1, D2, §5.3 | **guard** | `xsltjs/package.json` version `1.0.0`; each §5.3 member exists with its arity; `MAX_DEPTH > templateDepth`; the same `xpath` and xmldom instances; `applyStep` wrapped exactly once, also after a re-import; a probe view proves each hook fires | `test/render/engine-guard.test.ts` |

The guard test fails with the message "xsltjs internals moved: re-read design §5.3" so that a
version bump cannot pass silently.

## 12. Risks

| Risk | Retired by |
|---|---|
| A version bump moves the internals of §5.3 | exact pin; guard test (task 1) |
| `xsltjs` 1.0.0 is three days old | 106 `xsltproc` references (task 10), goldens, private check |
| A single XPath call does work that `applyStep` charges do not cover | string results are charged (§6); `outputBytes` and record-size limits bound the inputs. A Worker can be terminated by its page (spec 09); a Forge function has its timeout. |
| The Worker stack is smaller than Node's | 128-level test in a Chromium Worker (task 5; `Changed at task 5:` the 256-level test failed, §6) |
| The blank-check rule marks too much or too little on other forms | goldens of forms 01–08 reviewed against screenshots (task 14); the private check prints mark counts |

## 13. Review answers (2026-11-10)

1. **The global `applyStep` wrapper (D9):** approved, made idempotent with a symbol mark (§5.3).
