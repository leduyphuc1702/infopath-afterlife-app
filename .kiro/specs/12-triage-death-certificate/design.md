# Spec 12: Triage and death certificate, phase A — design

Requirements: `requirements.md` (R1–R8, 28 criteria). Status: **approved, 2026-11-11** (review decisions in `requirements.md`).

## 1. Architecture

```
Worker (existing session, spec 09)                    main thread (React)
  open: parseXsn → buildFormIR → matchRecord ─┐
        recordEvidence(bytes)  (R6.2)         │
  triage(templates, records) ─────────────────┴──▶  session { …, triage: TriageResult }
     classify(ir)  → Coverage      (src/coverage/)     Triage table, certificate, print view
     causesOf(ir, records) → Cause[] (src/triage/)     CSV: toCsv(result) runs in the Worker
     waveOf(counts), order rows                        and returns a string (R5.1)
```

- Core gains two folders, both pure (R7.2): `src/coverage/` (owned here, reused by spec 05) and
  `src/triage/`. `structure.md` gains the `src/coverage/` line at task 1.
- The Worker recomputes the whole `TriageResult` on every `open` (P10 makes order irrelevant);
  40 templates cost a few milliseconds beyond parsing, which spec 01 measured at under 300 ms p95
  per template.
- The main thread still imports core types only (spec 09 design §1). `toCsv` runs in the Worker;
  the page asks for it with a new request type.

## 2. Decisions

| # | Decision | Alternatives | Why |
|---|---|---|---|
| D1 | **The classification is a data table in core** (`src/coverage/table.ts`): one entry per element kind and subtype, with its class, the `feature-coverage.md` row it cites and an optional `verify` note; `classify(ir)` only looks entries up. | code in spec 05's converter; a switch per kind | Spec 05 imports the same table, so the converter and Triage never disagree. A test reads the Markdown and checks every citation (R1.3), so the doc and the code cannot drift. |
| D2 | **Unlisted means Manual, flagged** (`unlisted: true`). | Unsupported; skip | Product principle 1: no element is lost silently. Manual says "we report it with guidance", which is true of something we have not classified; Unsupported would claim a decision nobody made. |
| D3 | **Controls are counted once per bound node and type**, across all views: key `(targetId ?? binding, xctname)`. | once per view occurrence | Form 05 shows the same fields in three views; counting each occurrence would triple Native % for multi-view forms without adding a migration step. |
| D4 | **Causes are detected from FormIR alone**, except `browser-xslt`, which comes from a 4 KB scan of each record (`recordEvidence`), as `matchRecord` reads the solution instruction. | re-read the manifest | FormIR already carries `browserCompatible`, endpoints with liveness, code-behind, ActiveX and signatures, each with a `Located`. |
| D5 | **Sources are fixed strings in core** (`src/triage/catalogue.ts`), the three of R2.2; every other cause has `date: undefined`, shown "—". | fetch release pages | Nothing fetches (spec 09 R8.2); the human checked the three sources on 2026-11-11. |
| D6 | **Record count unknown until a record is opened** (R6.1). | 0 | "0 records" would claim the folder had none; the user may simply not have dropped them. |
| D7 | **Print view is a page section with `@media print`**, sized for the smaller of A4 and Letter (210 × 279 mm), opened with `window.print()`. | a generated PDF | No PDF library (bundle, licence); the browser's print dialog saves PDF on every platform. |
| D8 | **CSV in core, download in the page**: `toCsv` returns a string; the page saves it with a `blob:` URL and `<a download>`. | CSV built in React | Forge and Rovo export the same CSV later. A `blob:` download is neither a fetch nor a request to another origin. |

## 3. Coverage classification (`src/coverage/`)

```ts
type CoverageClass = 'native' | 'emulated' | 'manual' | 'unsupported';
type ElementKind = 'control' | 'view' | 'action' | 'calculation' | 'validation'
                 | 'connection' | 'codeBehind' | 'activeX' | 'signature';
interface RowRef { readonly section: 'A' | 'B' | 'C' | 'E' | 'F' | 'G' | 'H'; readonly row: string }
interface CoverageEntry {
  readonly kind: ElementKind; readonly subtype: string;   // '*' for the whole kind
  readonly class: CoverageClass; readonly cites: RowRef; readonly verify?: string;
}
interface CoverageItem {
  readonly elementId: string; readonly kind: ElementKind; readonly subtype: string;
  readonly class: CoverageClass; readonly cites?: RowRef; readonly unlisted: boolean;
  readonly verify?: string; readonly source: Located;
}
interface Coverage { readonly items: readonly CoverageItem[]; readonly counts: Readonly<Record<CoverageClass, number>> }
export const COVERAGE_TABLE: readonly CoverageEntry[];
export function classify(ir: FormIR): Coverage;
```

**Elements** (R1.1, P11): each control key of D3; each view other than the default; each rule
action; each calculation; each validation; each data connection; the code-behind once when
`codeBehind.present`; each ActiveX control in a view (else each `allowed` entry); each signed
block and signature line. Field types, defaults and conditional formatting are not elements in
phase A (FormIR carries no element for formatting; defaults are not modelled), and the design
says so rather than counting them Native.

**Table** (rows from `docs/feature-coverage.md`, 2026-11-11):

| Kind | Subtype | Class | Cites | Note |
|---|---|---|---|---|
| control | `PlainText`, `DTPicker` (and `DTPicker_DTText`), `dropdown`, `OptionButton`, `CheckBox`, `RichText`, `FileAttachment`, `combobox`, `InlineImage`, `ListBox` | Native | A, each row by name | `ListBox`: row says untested, no fixture |
| control | `Section` | Native | A "Section" | **[VERIFY]** F says "Sections, nested sections: Native/App"; A says Native. Nested sections taken as Native too |
| control | `RepeatingTable`, `RepeatingSection`, `Button`, `ExpressionBox`, `ChoiceSection`, `ChoiceGroup` | Emulated | A, each row | |
| control | an ActiveX GUID | Unsupported | A "ActiveX (GUID)" | counted under `activeX`, not twice |
| view | `*` (beyond the default) | Emulated | F "Multiple views per form" | **[VERIFY]** this puts every multi-view form in wave 2 at least |
| action | `ruleSetAction`, `assignmentAction`, `closeDocumentAction`, `switchViewAction`, `dialogBoxExpressionAction` | Emulated | C, each row | |
| action | `submitAction` | Native | C "submitAction" | |
| action | `queryAction` | Manual | C "queryAction" | |
| action | `changeAdapterProperty`, `openNewDocumentAction`, `dialogBoxMessageAction`, `webPartConnectionAction`, `signSignatureLineAction` | Manual | C, the "0 in corpus" row | **[VERIFY]** the row says "per action"; Manual until each is decided |
| calculation | `*` | Emulated | B "Read-only and calculated fields" | |
| validation | blank check (spec 03 §9.2) | Native | E "`xsf:errorCondition`" (Native `rq`) | **[VERIFY]** a blank check with an authored message loses the message in `rq`; the row says "Native (`rq`) + App (message text)" |
| validation | any other condition | Emulated | E "Custom XPath validation with author message" | |
| connection | `adoAdapter`, `webServiceAdapter`, `emailAdapter` | Manual | G, each row | |
| connection | `xmlFileAdapter` | Emulated | G "`xmlFileAdapter`" | |
| connection | `davAdapter`, `sharepointListAdapterRW` (submit) | Native | G "SharePoint list/library submit" | |
| connection | `submitToHostAdapter` | Native | G "`submitToHostAdapter`" | |
| connection | `sharepointListAdapter`, `sharePointListAdapter` (query) | Manual | G "Secondary data sources driving dropdowns" | **[VERIFY]** no row names a SharePoint list query; its source dies with SharePoint, so Manual, not the row's App |
| connection | `hwsAdapter` and others | Manual, `unlisted` | — | **[VERIFY]** no row |
| codeBehind | `*` | Manual | H "Managed code / VBA / script" | **[VERIFY]** the row says Manual; the brief's catalogue says Unsupported for the cause, and product principle 6 says no code-behind runs |
| activeX | `*` | Unsupported | H "ActiveX controls" | |
| signature | `*` | Manual | H "Digital signatures" | |

`Changed in task 1:` sections are not elements in phase A: a `Section` carries no
`xd:binding`, so FormIR has no control for it (form 05's three sections give none). The entry
stays for spec 05. `DTPicker_DTText`, the date picker's bound inner control, is the subtype
FormIR gives date pickers. The SharePoint list adapters are subtyped `sharepointList:query` and
`sharepointList:submit`. `hwsAdapter` has no entry: it is classed Manual and `unlisted`, which
needs no row. No in-repo element is `unlisted`.

`table-doc.test.ts` (R1.3) finds each cited row by its first cell in the cited section and
checks that its Coverage cell contains the class word (Native, App, Manual or Unsupported), unless
the entry has a `verify` note. Section D (expressions) is not an element kind: expressions are
part of the calculation, validation or condition that holds them.

## 4. Causes (`src/triage/`)

```ts
type CauseId = 'forms-services-spo' | 'infopath-client' | 'browser-xslt' | 'internal-sql'
             | 'internal-service' | 'code-behind' | 'activex' | 'signatures';
interface CauseInfo {
  readonly id: CauseId; readonly date?: string /* ISO */; readonly dateWords?: string;
  readonly source?: { readonly title: string; readonly url: string }; readonly replacement: string;
}
interface Cause extends CauseInfo {
  readonly evidence: readonly { readonly located: Located; readonly what: string }[];
  readonly from: 'template' | 'record';
}
export const CAUSES: Readonly<Record<CauseId, CauseInfo>>;
export function causesOf(ir: FormIR, records: readonly RecordEvidence[]): Cause[]; // catalogue order
export function recordEvidence(fileName: string, bytes: Uint8Array): RecordEvidence; // first 4 KB
```

| Cause | Detected when (FormIR) | Evidence | Date / source |
|---|---|---|---|
| `forms-services-spo` | `meta.browserCompatible` | `meta.source` (`Changed in task 2:` FormIR has no location for `xsf2:solutionDefinition/@runtimeCompatibility`; the evidence text names it) | 2026-07-14, "after July 14, 2026"; https://techcommunity.microsoft.com/t5/microsoft-sharepoint-blog/support-update-for-infopath-forms-services-in-microsoft-365/ba-p/3858190 |
| `infopath-client` | always | `meta.source` (`xsf:xDocumentClass`) | 2026-07-14, "after July 14, 2026 (extended support ends 7/15/2026 6:59:59 AM Pacific)"; https://learn.microsoft.com/en-us/lifecycle/products/infopath-2013 |
| `browser-xslt` | a matched record has an `xml-stylesheet` PI in its first 4 KB | the record file and the PI's line | 2026-11-17, "Chrome 158, November 17, 2026; Origin Trial and Enterprise Policy until Chrome 176, August 17, 2027"; https://developer.chrome.com/docs/web-platform/deprecating-xslt |
| `internal-sql` | a connection with `adapterKind` `adoAdapter` | the connection's `source` | — |
| `internal-service` | any other connection, or an ActiveX `server`, with an endpoint of `liveness: 'internal'` | each such endpoint's `source`, host named | — |
| `code-behind` | `codeBehind.present` | `meta.source` with the languages, each code file (path `/`), each handler with its event name | — |
| `activex` | `activeX.controls` (else `allowed`) not empty | each control's `source` | — |
| `signatures` | signed blocks or signature lines | each one's `source` | — |

The publish URL (`meta.publishEndpoint`) is not evidence for `internal-service`: it says where
the template was published, not what the form calls while it is filled.

Replacements are the brief's column, word for word. The email submit (forms 01, 02, 07) is not a
cause of its own: it dies with the client, which `infopath-client` already says; its coverage
item is Manual (§3).

## 5. Rows, waves, order, CSV

`Changed in task 3:` `triageFiles(files)` parses the `.xsn` files, matches the `.xml` records
with `matchRecord`, and calls `triage`; a parse failure is an error row with its code. Template
ids are file names (`#2`, `#3`… for repeats, after sorting by name then bytes), so the result does
not depend on input order. The Worker (task 5), the Forge resolver and the private-corpus test
all call it. `src/xsn/package.ts` gains `headText`, the 4 KB decoder `solutionAttribute` already
used, for `recordEvidence`.

```ts
interface TriageRow {
  readonly kind: 'form'; readonly fileName: string; readonly templateId: string;
  readonly name: string; readonly urn?: string; readonly generation: Generation;
  readonly browserCompatible: boolean;
  readonly counts: { fields: number; repeatingGroups: number; views: number; rules: number; connections: number };
  readonly coverage: Readonly<Record<CoverageClass, number>>; readonly nativePercent?: number;
  readonly records?: number; readonly causes: readonly Cause[]; readonly wave: 1 | 2 | 3;
}
interface TriageError { readonly kind: 'error'; readonly fileName: string; readonly error: WireErrorLike }
interface TriageResult { readonly rows: readonly (TriageRow | TriageError)[]; readonly totals: … }
export function waveOf(c: Readonly<Record<CoverageClass, number>>): 1 | 2 | 3;
export function triage(input: TriageInput): TriageResult;
export function toCsv(result: TriageResult): string;
```

- Counts use the main data source: `fields` are its fields, `repeatingGroups` its repeating
  groups; `rules` is actions plus calculations plus validations (the brief's definition).
- Order (R3.4): wave, records descending (unknown last), name (code-point order, so the result
  does not depend on a locale), file name; error rows last by file name.
- CSV columns: file, name, URN, generation, browser compatible, fields, repeating groups, views,
  rules, data connections, native, app, manual, unsupported, native %, records, wave, causes
  (ids joined by a space), error code. The header uses "App" for Emulated, as the UI does.

## 6. Web viewer

- **Protocol:** `session` gains `triage: TriageResult`; `open` sends
  `{ type: 'progress'; done; total; fileName }` messages with the request's id before its answer
  (the client resolves only on the answer and passes progress to a callback); a new request
  `{ type: 'csv' }` answers `{ type: 'csv'; text }`.
- **Screens:** `store.screen: 'triage' | 'certificate' | 'form'`. Two or more templates open →
  `triage` (replaces `TemplateList`; spec 09 R1.3 gets a `Changed in spec 12:` note). A row →
  `certificate` for that template; "Open form" → `form` (today's paper, tree, X-ray); a "Triage"
  link in the header goes back.
- `Changed in task 6:` only files the user opens switch to Triage when they leave two or more
  templates open; "Try a sample" still opens that sample's form (spec 09 behaviour), and the
  header's "Triage" button is there whenever two or more templates are open. The page repeats
  core's user-facing strings in `src/triage/words.ts` (types-only rule, spec 09 §1), and
  `test/words.test.ts` checks them against core. Progress messages also restart the 15 s
  watchdog, so a large folder is not cut off while the Worker is still reporting.
- **Table:** a native `<table>` with a caption, sticky header and a row per form; the row's name
  is a button (keyboard). Wave header: a button with `aria-describedby` on a tooltip that opens
  on focus and hover (R4.2). Cause ids show as chips; error rows show the three-part message.
- **Certificate:** a heading with the form name and its wave; one `<article>` per cause with
  date (or "—"), source as an external link (`rel="noreferrer"`, new tab), evidence as
  `file › path` in code, and the replacement; the workflow line last (R2.3).
- **Export:** "Export plan" menu: "CSV" and "Print plan". The print section (`PrintPlan.tsx`) is
  in the page but `display: none` on screen; `@media print` hides everything else.
- Files: `src/triage/TriageTable.tsx`, `Certificate.tsx`, `PrintPlan.tsx`, `ExportMenu.tsx`,
  `triage.css`, `waves.ts` (the three rules in words, shared by tooltip and print).

## 7. Testing

| Id | Kind | Fixture | File |
|---|---|---|---|
| R1.1, R1.2 | unit | forms 01–08, 43–47; synthetic | `core/test/coverage/classify.test.ts` |
| R1.3 | unit | `docs/feature-coverage.md` | `core/test/coverage/table-doc.test.ts` |
| R1.4 (P11) | property | in-repo FormIR, elements removed or duplicated | `core/test/property/p11.property.test.ts` |
| R2.1–R2.3, R6.2 | unit | forms 01–47, weight-keeper, synthetic record | `core/test/triage/causes.test.ts` |
| R2.4 (P9) | property | the same, plus generated variants | `core/test/property/p9.property.test.ts` |
| R3.1–R3.4, R6.1 | unit, golden | forms 01–08 and records, truncated 02 | `core/test/triage/triage.test.ts` |
| R3.5 (P8) | property | generated counts | `core/test/property/p8.property.test.ts` |
| R3.6 (P10) | property | forms 01–08 and records, shuffled | `core/test/property/p10.property.test.ts` |
| R3.7 | unit | the app's strings | `apps/web/test/copy.test.ts` |
| R4.1–R4.3, R6.1, R7.1 | e2e | forms 01, 04, 44, 46; 40 copies | `apps/web/e2e/triage.spec.ts` |
| R4.4 | browser | forms 01–03 | `apps/web/test/protocol.browser.test.ts` |
| R5.1 | unit, e2e | forms 01–08 | `core/test/triage/csv.test.ts`, `e2e/export.spec.ts` |
| R5.2 | e2e | forms 01–47 | `e2e/export.spec.ts` (`page.pdf` A4 and Letter; count `/Type /Page`) |
| R7.2 | lint | — | `eslint.config.js` |
| R7.3 | e2e | — | spec 09's guards; `e2e/offline.spec.ts` |
| R8.1 | local | `AFTERLIFE_PRIVATE_SAMPLES` | `core/test/triage-private.local.test.ts` |

The private-corpus output is shaped like spec 03's local check (names and counts only) and is
also how the `[VERIFY]` rows of §3 get evidence: `unlisted` items per kind and subtype show which
real shapes the table misses.

## 8. Risks

1. **The classification decides the waves.** A single Emulated view puts a form in wave 2; the
   `[VERIFY]` rows are where a different call moves many forms. The table is data, so a change is
   one line plus its doc citation.
2. **Our 47 forms come from one generator.** Code-behind, ActiveX and web-service shapes in real
   forms may differ; R8.1 is the check.
3. **`blob:` download under the CSP.** Expected to raise no violation (a download is not a fetch);
   `e2e/export.spec.ts` checks it with the guards on.
