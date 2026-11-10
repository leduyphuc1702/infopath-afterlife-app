# Spec 09: standalone web viewer, phase A — design

Requirements: `requirements.md` (R1–R11, 25 criteria). Status: **approved, 2026-11-11**.

Changed at review (2026-11-11): `connect-src 'none'` (§6). Changed in task 1: the build plugins
live in `apps/web/plugins/`, because the root `.gitignore` ignores every `plugins/` folder.

**Checked for this design (2026-11-11, `npm view` and `npm pack` into a temp folder, since
deleted, unless stated):**

| Fact | Value |
|---|---|
| Vite in the repo | 8.3.6 (root `package.json`); core's Worker builds already use it (`test/helpers/worker-bundle.ts`) |
| `@vitejs/plugin-react` | 6.3.0, peer `vite ^8.0.0` |
| React 18 | 18.3.1 is the last 18.x |
| `@atlaskit/tokens` | 20.11.0, Apache-2.0 (`LICENSE`: "Copyright 2019 Atlassian Pty Ltd"), peer `react ^18.2.0 \|\| ^19.0.0`, no `exports` map; themes are JS modules exporting CSS strings: `atlassian-light` 21,419 B (3,504 B gzip), `atlassian-dark` 21,473 B (3,467 B gzip) |
| Lighthouse | 13.6.0, `engines.node >=22.19`; Node here is 22.23.4 |
| `@playwright/test` | 1.65.0, same as the repo's `playwright` |
| Core in a Worker bundle | esbuild, minified: 442,325 B, 129,321 B gzip (core + `xsltjs` + `xpath` + xmldom) |
| `eval` or `new Function` in `xsltjs`, `xpath`, xmldom | none (grep of the installed packages) |
| Carlito | 28 woff2 files, 803,072 B; latin 400 normal is 30,156 B |
| Samples (R7.1) | 9 templates 74,330 B; 153 records (without `-000-empty`) 273,059 B, 19,718 B gzip |

## 1. Architecture

```
main thread (React 18)                              Web Worker (module)
  DropZone / file picker ── File → ArrayBuffer ──▶  session: templates, records, prepared views
  "Try a sample" ───────── {openSample} ─────────▶  imports virtual:sample-files (lazy chunk)
  store (useReducer) ◀──── summaries, FormIR ─────  parseXsn → buildFormIR → matchRecord
  Paper (shadow root) ◀─── {html, css, marks} ────  prepareView (cached per view) → renderView
  X-ray overlay, tree, card, connections: pure functions of FormIR + marks, main thread
```

- Core runs only in the Worker. The main thread imports core **types only** (lint:
  `no-restricted-imports` with `allowTypeImports` for `@afterlife/core` outside `src/worker/`), so
  the main bundle carries neither `xsltjs` nor xmldom.
- State lives in memory only: no `localStorage`, IndexedDB, cookies or service worker.

## 2. Decisions

| # | Decision | Alternatives | Why |
|---|---|---|---|
| D1 | **The Worker owns the session**: file bytes are transferred once; the main thread asks for renders by id. | parse on the main thread; send bytes per render | `PreparedView` holds a compiled stylesheet and cannot be cloned. Transfer avoids copies. Keeps the main thread free (R9.1). |
| D2 | **Paper in an open shadow root** on a host with `all: initial; display: flow-root; color-scheme: light`. `Changed in task 3:` `flow-root`, not `block`: the root's 15 px top margin collapsed through a `block` host and the paper sat 15 px high (59,487 pixels off core's baseline; 0 after). View CSS and HTML go into the shadow root. | plain `div` (core's own test page) | Core scopes view CSS (spec 03 D11) but not the page's CSS. A shadow root stops our selectors; `all: initial` stops inherited colour, font and `color-scheme` (dark mode would turn native `select` dark). `@font-face` stays in the document, which Chromium requires. |
| D3 | **Host helpers in core under `packages/core/host/`**: `host/vite.ts` (`xsltjsStubs()`, moved from `test/helpers/xsltjs-stubs.ts`) and `host/carlito.ts` (`carlitoCss({unicode, fileUrl})`, the metrics and the rule text, moved from `test/browser/carlito.ts`). Exports `./host/vite` and `./host/carlito`. Core's tests import the same files. | copy into the app; export from `src/index.ts` | One source for the stub mapping and the font rules (human decision 7). Not core API: `src/` stays free of Vite and fonts. `@fontsource/carlito` stays a dev dependency of core; the app adds it (5.3.0) and passes its own `unicode.json` and file URLs. |
| D4 | **Native HTML controls styled with tokens; no `@atlaskit/*` components.** | Atlaskit `Select`, `Tabs`, `Tree` | Bundle and Lighthouse budget. Native elements give keyboard and accessibility for free. |
| D5 | `Changed in task 1:` **the theme CSS strings `@atlaskit/tokens` ships, imported directly** (`dist/esm/artifacts/themes/atlassian-{light,dark,spacing}.js`; no `exports` map blocks it), put in one `<style>`; `shell/theme.ts` sets `<html data-theme="light:light dark:dark spacing:spacing" data-color-mode>` from `prefers-color-scheme` and follows its changes. CSS uses `var(--ds-…)`. | `setGlobalTheme` | Measured 2026-11-11: `setGlobalTheme` raised the entry chunk from 45.7 to 91.6 KB gzip and emitted 25 theme chunks; it raised no violation in the smoke test. The three strings cost 6.4 KB gzip in the entry, with no request and no violation. |
| D6 | **Samples as one lazy JS chunk imported by the Worker** (`virtual:sample-files`, base64), and a tiny `virtual:sample-list` (names, counts) for the menu. | fetch asset files | One cached chunk, no `fetch`; the Worker decodes it where the bytes are used. |
| D7 | **Offline by warm-up, not a service worker**: after `load`, the app starts the Worker, which imports the samples chunk, and loads the four Latin Calibri faces (123 KB); then sets `<html data-ready>`. `Changed at review (2026-11-11):` Latin only. Latin Extended, Vietnamese, Greek and Cyrillic keep their `unicode-range` and load on demand while online; offline they fall back to a system font, and the notes under the paper say so when a render uses those characters. | service worker precache; all subsets (459 KB more) | Meets R8.1 (offline after load) with no cache-update logic and inside the font budget. Reload while offline is Later. |
| D8 | **Hit testing from cached boxes** of `[data-afl-ctrl]`, in paper-content coordinates (§5). | DOM events on the paper | The root is `inert`; per HTML, inert nodes are not hit-test targets, so events reach the host. Checked in task 6: inside a control's box, `shadowRoot.elementFromPoint` hits nothing in the root, and a real pointer moved there by Playwright reaches the frame's `pointermove` (`e2e/xray.spec.ts`). |
| D9 | **CSP added to `index.html` at build only** (a `transformIndexHtml` plugin, `apply: 'build'`), from one `csp.ts` that also writes `_headers`. | always in `index.html` | Vite's dev server and React refresh use inline scripts. One source keeps the two policies equal (R8.2). |
| D10 | **No DOMPurify** (§6). | DOMPurify on the main thread | Human decision 8. |
| D11 | **Render input**: `now` is the page's local time with offset, taken once per session; `locale: 'en-US'`. | per-render `now` | Same input gives the same paper while paging. Locale: open question 7. |

## 3. Module layout

```
apps/web/
  index.html  vite.config.ts  vitest.config.ts  playwright.config.ts  package.json  tsconfig.json
  plugins/     csp.ts (policy, meta plugin, _headers writer)  samples.ts (virtual modules)
               notices.ts (writes dist/notices.html and dist/licenses/* from the bundle's packages)
  public/      favicon.svg
  src/
    main.tsx  App.tsx  store.ts (reducer, actions)  messages.ts (three-part texts)
    worker/    worker.ts  session.ts  protocol.ts (shared types)  client.ts (main-side, watchdog)
               samples.ts (decodes the lazy samples chunk)
    files/     collect.ts (drop, picker, folder walk, size checks)
    paper/     Paper.tsx  PaperToolbar.tsx  geometry.ts  XrayOverlay.tsx  fade.ts  paper.css
    side/      TemplateList.tsx  FieldTree.tsx  tree.ts  markers.ts  DetailsCard.tsx  card.ts
               Connections.tsx  connections.ts  Unmatched.tsx
    shell/     Header.tsx  Landing.tsx  Notices.tsx  ErrorBanner.tsx  theme.ts  fonts.ts  app.css
  test/        *.test.ts (node), *.browser.test.ts (chromium)
  e2e/         *.spec.ts, fixtures.ts (request, violation and canary guards), hostile.ts
packages/core/
  host/vite.ts  host/carlito.ts                 (D3)
  src/xsn/match.ts                              matchRecord (R2, R11), exported from src/index.ts
.github/workflows/web-pages.yml
```

Root scripts gain `test:web` (`pnpm --filter web test`) and `e2e:web`; `check` runs `test:web`.

## 4. Worker protocol (`src/worker/protocol.ts`)

```ts
type Req =
  | { id: number; type: 'warm' }
  | { id: number; type: 'open'; files: readonly { name: string; bytes: ArrayBuffer }[] } // transferred
  | { id: number; type: 'openSample'; sample: string }
  | { id: number; type: 'render'; templateId: string; view: string; recordId?: string; now: string };
type Res =
  | { id: number; type: 'session'; templates: TemplateSummary[]; records: RecordSummary[]; failures: FileFailure[] }
  | { id: number; type: 'rendered'; html: string; css: string; issues: Issue[]; marks: ControlMark[] }
  | { id: number; type: 'failed'; error: WireError }
  | { id: number; type: 'ready' };
interface TemplateSummary { templateId: string; fileName: string; ir: FormIR; issues: Issue[] }
interface RecordSummary { recordId: string; fileName: string; match: RecordMatch }
interface FileFailure { fileName: string; error: WireError }
interface WireError { code: ErrorCode | AppCode; details: Record<string, unknown> }
type AppCode = 'FILE_TOO_LARGE' | 'TOO_MANY_FILES' | 'WORKER_TIMEOUT' | 'WORKER_FAILED';
```

- **Session.** Every `open` adds files and answers with the whole session, re-matching every
  record, so a template dropped later picks up records dropped earlier. Templates and records are
  sorted by file name (P14 makes the order irrelevant to matching, not to display).
- **Core addition** (`src/xsn/match.ts`, reusing `solutionAttribute`, first 4 KB, no DOM):

  ```ts
  interface TemplateKey { readonly urn?: string; readonly version?: string } // ir.meta.urn, solutionVersion
  type RecordMatch =
    | { kind: 'exact'; template: number }
    | { kind: 'otherVersion'; template: number; recordVersion: string }
    | { kind: 'unmatched'; reason: 'noSolution' | 'noTemplate'; urn?: string };
  function matchRecord(record: Uint8Array, templates: readonly TemplateKey[]): RecordMatch;
  ```

  A missing version on either side counts as equal, as in render's `RECORD_TEMPLATE_MISMATCH`.
  Among same-URN templates of other versions it picks the highest version not above the
  record's, else the lowest above it (dotted numeric comparison); ties go to the lower index.
- **Errors.** The Worker catches `AfterlifeError` and sends `{code, details}`; anything else is
  `WORKER_FAILED`. `client.ts` checks sizes before reading a file (R1.2) and runs a watchdog:
  no answer in 15 s terminates the Worker, starts a new one, re-sends the kept `File`s, and shows
  `WORKER_TIMEOUT` for the request. Core's budgets make this a backstop only.
- **Messages.** `messages.ts` is `Record<ErrorCode | AppCode, (d) => {what, why, action}>`, so a new
  core code fails the type check. Example, `CORRUPT_CAB`: "We couldn't open {file}." / "The file is
  damaged: its cabinet structure doesn't add up." / "Save the form again from SharePoint or
  InfoPath, then drop the new copy here." Render issues appear under the paper as "Notes" (count,
  then core's message text).
- **Stale answers.** The store keeps the id of the latest render request; older answers are dropped.

## 5. State, paper and X-ray geometry

**Store** (`useReducer`): `templates`, `records`, `failures`, `ignored`, `openTemplateId`,
`viewName`, `recordIndex` (0 is the empty form), `xray`, `selectedFieldId`, `hoverControl`,
`render` (`idle | loading | {result} | {error}`), `firstRenderDone: Set<templateId>`.

**Layout.** Header (title, "Open files", "Try a sample" menu, X-ray switch `aria-pressed`). Main:
the toolbar (view `select`, Previous, "Record n of m, file", Next, version label) above the paper
frame, a scroll container showing a white page on a `--ds-surface-sunken` field (infopath-ux.md
§1: "a white page on a grey field"). Side panel: template list when more than one, then tabs
"Fields" | "Data connections" (ARIA tabs), then the details card. Below 720 px the side panel
stacks under the paper.

**Paper.** `Paper.tsx` owns the host `div` and attaches the shadow root once. On a result it sets
`shadowRoot.innerHTML = '<style>' + css + '</style>' + html` (sanitised by core; the `<style>` is
allowed by `'unsafe-inline'`). Fonts: `fonts.ts` injects `carlitoCss` into `document.head` at
start and waits for the four faces before the first paint of the paper.

**Fade** (`fade.ts`, R9.3). On a template's first render, the host gets
`filter: sepia(.85) contrast(.92)` and, one frame later, `transition: filter 1.2s ease-out;
filter: none`. Under `prefers-reduced-motion: reduce` neither is set.

**Geometry** (`geometry.ts`, R5.3). Coordinates are relative to the paper frame's content box,
so scrolling moves outlines and boxes together and needs no listener:

```ts
interface Box { index: number; x: number; y: number; w: number; h: number } // index into marks
function measure(frame: HTMLElement, root: ShadowRoot): Box[];
  // r = el.getBoundingClientRect(), f = frame's; x = r.left - f.left - frame.clientLeft + frame.scrollLeft
  // zero-size boxes (hidden sections) are skipped
function hitTest(boxes: readonly Box[], px: number, py: number): number | undefined; // smallest area wins
```

- The i-th `[data-afl-ctrl]` element in document order is `marks[i]` (both are document order,
  spec 03 §4). Checked in task 6: `data-afl-ctrl` and `data-afl-path` of the i-th element equal
  `marks[i]` for forms 01–08, empty form and first record (16 renders).
- `measure` runs after each render, on a `ResizeObserver` of the host, and on
  `document.fonts` `loadingdone`, in one `requestAnimationFrame`.
- `pointermove` on the frame (rAF-throttled) converts `clientX/Y` with the same formula, then
  `hitTest`. Up to 242 boxes (form 08): a linear scan.
- Outlines are absolutely positioned `div`s in an overlay inside the frame, `pointer-events:
  none`, above the host; colour `--ds-border-focused`, 2 px.
- Tree → paper: boxes whose mark has the field's id (`fieldId`, or the control's FormIR
  `targetId` for groups such as repeating sections); `frame.scrollTo` the first.

**Tree, markers, card, connections** are pure functions of FormIR (and marks), unit-tested in Node
on the samples:

- `tree.ts`: roots by `dataSource` (`main` first, then by name), children by `groupId`. FormIR
  keeps fields and groups in two arrays; siblings are merged back into document order by the
  index of each group's first field (form 02's expense row comes out in schema order).
- `Changed in task 6:` selecting from the paper scrolls only the tree's own box, never the page
  (`scrollIntoView` moved the page under the pointer by 39 px in the X-ray test).
- `markers.ts` (R4.2): Rule = an element of `readBy`/`writtenBy` is a rule or action id;
  Calculated = a calculation's `targetId`; Validated = a validation's `matchId`; From data
  connection = a control with `choicesFrom.connectionId` targets the field, or an element in
  `writtenBy` is in a connection's `lineage.usedBy`, or (`Changed in task 5:`) the field is in a
  connection's `lineage.fieldIds`, the secondary tree the connection fills.
- `card.ts`: an id index over rules (and actions), calculations, validations, connections and
  controls; each `DepRef` becomes `{kind, role, caption, expression as written}`.
- `connections.ts`: kind words (`adoAdapter` "Database (SQL)", `webServiceAdapter` "Web service",
  `xmlFileAdapter` "XML file", `sharepointListAdapter` "SharePoint list", `emailAdapter` "Email
  submit", others by name); status "Works offline" only when it has endpoints and every one is
  `liveness: 'package'`; reasons from `Endpoint.reason` in words ("internal server
  sql-legacy01", "public address"), email: "sends email from InfoPath".

## 6. CSP and threat model

Policy (`plugins/csp.ts`, one string):

```
default-src 'none'; script-src 'self'; worker-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' data:; font-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'
```

`_headers` (Cloudflare Pages, `/*`): the same plus `; frame-ancestors 'none'`, and
`X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`. Relaxations, with reasons:
`Changed at review:` `connect-src 'none'`, against brief AC5's `'self'`, since nothing fetches.
`'unsafe-inline'` in `style-src` only, for the views' `style` attributes and the per-render
`<style>` (human decision); `data:` in `img-src`, for package images that core inlines (spec 03
R6.1). No `'unsafe-eval'`: nothing needs it (table above).

| Threat | Defence |
|---|---|
| Script from a hostile XSL or record (P5 shapes) | Core's allowlist sanitiser on the result tree, in the Worker (spec 03 D4, D5; P5, 500 runs); `script-src 'self'` with no inline or eval; the root is `inert` inside a shadow root |
| Data leaving through URLs (images, CSS `url()`, links, forms, `<base>`) | Core drops external resources (`EXTERNAL_RESOURCE_BLOCKED`); `img-src` and `font-src` limited to self, `connect-src 'none'`; `form-action 'none'`; `base-uri 'none'` |
| Resource exhaustion (cabinet bombs, deep XML, endless templates) | Core's limits and render budget, in the Worker; size checks before reading; the 15 s watchdog |
| Framing (clickjacking) | `frame-ancestors 'none'` in `_headers`; not possible with `<meta>` (GitHub Pages gap, open question 1) |
| Third-party code or analytics | None; every e2e test fails on a non-same-origin request; dependencies pinned |
| The Worker under `<meta>` only | A module Worker takes its policy from its own response headers [VERIFY in task 8]; on GitHub Pages it runs without one. It runs only our bundle, which contains no `eval`. |

**Why no DOMPurify.** Core sanitises the tree before it is serialised, so no string is re-parsed
(spec 03 D4); P5 checks it on 500 generated inputs, and the output is byte-identical in Node and a
Worker. DOMPurify on the main thread would re-parse that string (the mXSS surface D4 removed), add
about 20 KB, and could change the bytes the goldens fix. The CSP is the second layer: if the
sanitiser ever let a script through, the browser would refuse it, and the violation would fail
R8.2's tests.

## 7. Samples, fonts, notices, bundle budget

- `plugins/samples.ts` (Vite plugin): reads `samples/own/xsn/0[1-8]-*.xsn`, their
  `records/<slug>/*.xml` without `-000-empty.xml`, and
  `samples/public/theill-weight-keeper/theill__weight-keeper.xsn`; it never writes under
  `samples/`. Names come from FormIR at run time; the list module holds slug, file name and record
  count.
- Fonts: `@fontsource/carlito` 5.3.0 in the app; `import.meta.glob('…/files/*.woff2', {query:
  '?url'})` emits all 28 files; `unicode-range` makes the browser fetch only what text needs.
  The OFL text is copied to `dist/licenses/`. README "Third-party licences" gains the app's rows.
- `plugins/notices.ts` (`generateBundle`): collects package names from the bundles' module ids,
  reads each `license` and licence file from `node_modules`, writes `dist/licenses/` and the data
  for `Notices.tsx`, and fails the build on a licence outside MIT, Apache-2.0, BSD, ISC or OFL-1.1.

| Bundle (gzip) | Budget | Expected |
|---|---|---|
| Entry JS + CSS (React, app, tokens) | 100 KB | 55.1 + 0.8 measured at task 3 (React 45.7, tokens 6.4) |
| Theme chunks | 0 | none: the themes are in the entry (D5) |
| Worker | 160 KB | 126.1 measured at task 3 |
| Samples chunk | 120 KB | 96.1 measured at task 3 |
| Fonts fetched for an English form | 260 KB raw | 123 KB measured at task 3: the 4 Latin faces. Latin Extended (336 KB) loads on demand only (D7) |

`test/budget.test.ts` reads `dist/.vite/manifest.json` and gzips each file (gzip -9).

**Lighthouse 13.6.0, task 3** (desktop preset, `vite preview` under the sub-path, Playwright's
Chromium, 2026-11-11): performance 100 (FCP 0.2 s, LCP 0.2 s, TBT 0 ms, CLS 0), accessibility
100. It measures the landing state; no sample is open.

## 8. Build and hosting

- `vite.config.ts`: `base: './'`; `plugins: [react(), samples(), csp(), notices()]`;
  `worker: { format: 'es', plugins: () => [xsltjsStubs()] }`; `build.manifest: true`. The stub
  plugin is needed in the Worker build only, since the main bundle imports no core code (§1).
  Checked in task 3: under `vite preview --base /infopath-afterlife-app/`, the module Worker, its
  lazy samples chunk and the font files all load from the sub-path, with no violation.
- `web-pages.yml`: `workflow_dispatch`; `permissions: contents: read, pages: write, id-token:
  write`; checkout, pnpm setup, Node 22, `pnpm install --frozen-lockfile`,
  `pnpm --filter web build`, upload `apps/web/dist`, deploy. [VERIFY in task 9: current major
  versions of `actions/checkout`, `pnpm/action-setup`, `actions/setup-node`,
  `actions/upload-pages-artifact`, `actions/deploy-pages`]

## 9. Testing

`apps/web/vitest.config.ts` has a `node` and a `browser` project (Playwright Chromium, as in
core). E2E: `@playwright/test` 1.65.0, `webServer`: build, then
`vite preview --base /infopath-afterlife-app/ --strictPort`. `e2e/fixtures.ts` gives every test
three guards that fail it: a request whose origin is not the page's (page and Worker requests
checked in task 3: the Worker's `import()` of the samples chunk reaches `context.on('request')`,
which the guard uses), a `securitypolicyviolation`
event (init script), and a page error.

| Id | Kind | Fixture | File |
|---|---|---|---|
| R1.1–R1.3, R2.2 | e2e | forms 01, 02, 03, 07, records, `.txt`, truncated 02 | `e2e/open.spec.ts` |
| R1.2 | unit | `ERROR_CODES` + app codes | `test/messages.test.ts` |
| R2.1, R2.2 | unit | forms 01, 07 and records | `packages/core/test/xsn/match.test.ts` |
| R3.1 | browser | form 02 | `test/protocol.browser.test.ts` |
| R3.1–R3.3, R9.3 fade | e2e | samples 02, 03, 05; core baseline PNG | `e2e/paper.spec.ts` |
| R4.1, R4.2 | unit | forms 01–08, weight-keeper | `test/tree.test.ts`, `test/markers.test.ts` |
| R5.1 | unit, e2e | forms 04, 02 | `test/card.test.ts`, `e2e/xray.spec.ts` |
| R5.2 | e2e | form 02 `-001.xml` | `e2e/xray.spec.ts` |
| R5.3 | browser | form 08 | `test/geometry.browser.test.ts` |
| R6.1 | unit | forms 01–08 | `test/connections.test.ts` |
| R7.1, R7.2 | unit after build | `dist` | `test/samples.test.ts`, `test/notices.test.ts` |
| R8.1 | e2e | samples, form 03 file | guards in every spec; `e2e/offline.spec.ts` |
| R8.2 | unit, e2e | `dist/index.html`, `dist/_headers` | `test/csp.test.ts`; guards |
| R8.3 | e2e | 20 seeded P5 inputs packed with core's `writeCabinet` (test-only import) | `e2e/hostile.spec.ts` |
| R9.1 | command | `vite preview` | `verification.md` |
| R9.2 | e2e | sample 03 | `e2e/keyboard.spec.ts` |
| R9.3 | unit | `src/**/*.css` | `test/style.test.ts` |
| R10.1 | unit, e2e | `dist` | `test/budget.test.ts`; all e2e under the sub-path |
| R11.1 (P14) | property | generated | `packages/core/test/property/p14.property.test.ts` |

## 10. Risks

1. **Paper fidelity inside the app.** The shadow root, `all: initial` and the frame could move
   pixels compared with core's test page. Task 3 compares form 02 with core's baseline first.
2. **Lighthouse performance.** The 28 font files, the theme loader and warm-up could hurt it.
   Measured at task 3, while the design is still cheap to change; warm-up waits for `load`.
3. **CSP in practice.** Vite chunks and the Worker must raise no violation, and
   hosts differ (open question 1). The guards run from task 1.
