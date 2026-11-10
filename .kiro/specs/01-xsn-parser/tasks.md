# Tasks: 01 .xsn parser (CAB + manifest + schema)

Phase 3 of 3. Requirements: `requirements.md` (R1–R20, approved and amended 2026-11-10). Design:
`design.md` (approved 2026-11-10). Status: **approved 2026-11-10.**

## How every task is run and checked

- **Node:** all commands run on Node 22.23.4. This machine's default `node` is 26.13.0, so prefix
  commands with `PATH=/opt/homebrew/opt/node@22/bin:$PATH` (or rely on `.node-version` with a
  version manager). CI uses Node 22 from `.node-version`.
- **pnpm:** the root `package.json` pins `"packageManager": "pnpm@12.18.0"`. The globally installed
  pnpm reads that field and runs 12.18.0 itself, with no Corepack: in a scratch folder with that
  field, `pnpm --version` printed `12.18.0` under Node 22 and Node 26 (checked 2026-11-10). The
  global pnpm found on `PATH` here is `/usr/local/bin/pnpm` **11.5.2**, not 11.11.0; the switch
  worked from 11.5.2. CI uses `pnpm/action-setup`, which reads the same field.
- **Full suite:** `pnpm check` runs, in order, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`,
  `pnpm test` (Vitest `node` project) and `pnpm test:browser` (Vitest `browser` project,
  Playwright Chromium, dedicated Worker). Every task's `Done when` is `pnpm check` green, not only
  the new tests. `pnpm test:perf` is separate and named where a task needs it.
- **Browser-only checks** are marked **[browser]**: they run only in `pnpm test:browser`.
- Test paths are relative to `packages/core/test/`, source paths to `packages/core/src/`, unless
  they start with `/`. Samples are read in place from `samples/own/` and `samples/public/`; nothing
  is copied under `samples/`.
- One task per turn: build it, run `pnpm check`, report the diff and the output, stop for review.
  No commits.

## Tasks

- [x] 1. Harness: workspace, `packages/core` skeleton, tools and CI
  - Root: `/package.json` (private, `"type": "module"`, `packageManager: "pnpm@12.18.0"`,
    `engines.node: ">=22.12 <23"`, dev tools from design §12 at their exact versions, scripts
    `typecheck`, `lint`, `format`, `format:check`, `test`, `test:browser`, `test:perf`, `check`),
    `/pnpm-workspace.yaml` (`packages/*`, `apps/*`), `/.node-version` (`22.23.4`),
    `/tsconfig.base.json` (design §12 options), `/eslint.config.js` (flat config,
    `recommendedTypeChecked`, `eslint-config-prettier`, the `no-restricted-imports` and
    `no-restricted-globals` rules for `packages/core/src/**`), `/.prettierrc.json`
    (`printWidth: 100`, `singleQuote: true`), `/.prettierignore` (`samples/`, `docs/`, `.kiro/`,
    `**/*.md`, `packages/core/test/golden/`, so existing docs are not reformatted).
    Add `coverage/`, `test-results/` and `.vitest-attachments/` to `/.gitignore`.
  - Core: `packages/core/package.json` (`@afterlife/core`, private, ESM, `exports` →
    `./src/index.ts`, dependency `@xmldom/xmldom` `0.9.12` exact), `packages/core/tsconfig.json`
    (`src/`, `lib: ["ES2023", "WebWorker"]`, `types: []`), `packages/core/test/tsconfig.json`
    (adds `@types/node` 22.20.5), `packages/core/vitest.config.ts` with three projects: `node`
    (`test/**/*.test.ts`, excluding browser and perf), `browser` (`test/browser/**/*.browser.test.ts`,
    `@vitest/browser-playwright`, Chromium, headless) and `perf` (`test/perf/**/*.perf.test.ts`,
    one fork, no parallelism). `src/index.ts` exports nothing yet.
  - CI: `/.github/workflows/ci.yml`, on push and pull request: checkout, `pnpm/action-setup`,
    `actions/setup-node` with `node-version-file: .node-version` and pnpm cache, `pnpm install
    --frozen-lockfile`, `pnpm exec playwright install --with-deps chromium`, then `pnpm typecheck`,
    `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm test:browser` as separate steps.
  - Tests:
    - `harness.test.ts`: one passing assertion;
    - `browser/harness.browser.test.ts` **[browser]**: starts a dedicated module Worker that
      reports `typeof DecompressionStream`, `typeof TextDecoder` and `typeof DOMParser`; expects
      `function`, `function`, `undefined` (design §7.1);
    - `perf/harness.perf.test.ts`: one passing assertion;
    - `lint/restricted.test.ts`: lints in-memory code with the ESLint Node API as if it were
      `packages/core/src/x.ts`; `import 'node:fs'`, `import 'zlib'`, `fetch(…)`, `new DOMParser()`,
      `Buffer.from(…)` and `import '@xmldom/xmldom'` each give an error; the xmldom import as
      `packages/core/src/xml/parse.ts` gives none.
  - Requirements: R17.1 (static checks), R17.4 (static checks), R18.1 (Node 22 pin).
  - Done when: `pnpm install` succeeds, then `pnpm check` and `pnpm test:perf` are green on Node
    22.23.4.

- [x] 2. Spike: stored-block prefix in Node and a Worker, and `TextDecoder` label parity
  - `src/cab/inflate.ts`: `storedBlock(history)` and `inflateBlock(data, history, expected)` as in
    design §6.1 (D1–D3), no CAB parsing.
  - Test helpers: `helpers/samples.ts` (lists the 48 cabinets: `samples/own/xsn/*.xsn` and the
    public sample; reads bytes; resolves `forms/<slug>/`), `helpers/cfdata.ts` (test-only walker
    over CFDATA of the single folder, enough for the spike), `helpers/zlib-oracle.ts` (folder
    output by `zlib.inflateRawSync` with `dictionary`, the independent oracle).
  - Vitest browser commands in `vitest.config.ts`: `zlibOracleSha256(path)` and
    `nodeAcceptedLabels()`, which run in the Node test process, so the browser tests compare with
    Node without `zlib` in the bundle.
  - `fixtures/whatwg-encodings.json`: copy of the WHATWG Encoding Standard `encodings.json`, with
    `fixtures/README.md` giving its source URL, retrieval date and licence (CC BY 4.0).
  - `src/xml/refused-encodings.ts`: `REFUSED_ENCODINGS`, the canonical encoding names accepted by
    exactly one of Node 22 and Chromium, measured by this task. Starting point from 2026-11-10:
    Node 22.23.4 rejects `iso-8859-16` and `x-user-defined`.
  - Tests:
    - `cab/inflate.spike.test.ts`: for all 48 cabinets, block-by-block `inflateBlock` output
      equals the zlib oracle; the test asserts that exactly 7 of them have more than one block,
      so the history path is exercised; plus synthetic cases for D3 (8 junk bytes after the
      stream: accepted; one byte short: `CORRUPT_CAB`);
    - `browser/inflate.browser.test.ts` **[browser]**: the same 48 cabinets inflated in a
      dedicated Worker; SHA-256 per folder equals `zlibOracleSha256`;
    - `xml/encoding-labels.test.ts`: every WHATWG label is tried with `new TextDecoder(label)` in
      Node; the six `replacement` labels throw; the accepted set minus `REFUSED_ENCODINGS` is
      written to the test log;
    - `browser/encodings.browser.test.ts` **[browser]**: the same in a Worker; the accepted
      canonical names, minus `REFUSED_ENCODINGS`, equal Node's (`nodeAcceptedLabels()`); every
      name in `REFUSED_ENCODINGS` is accepted by exactly one runtime.
  - Report: the Chromium result, and the final `REFUSED_ENCODINGS` list. If the stored-block prefix
    fails anywhere, stop and propose a design change (design §14).
  - Requirements: R1.2, R5.3 (label list), R17.2.
  - Done when: `pnpm check` green.

- [x] 3. Errors, limits and the bounds-checked byte reader
  - `src/errors.ts` (`AfterlifeError` with `code` and `details`, `ErrorCode`, `Issue`,
    `IssueCode`, design §11), `src/limits.ts` (`Limits`, `DEFAULT_LIMITS`, `resolveLimits`),
    `src/cab/bytes.ts` (`ByteReader`: little-endian `u8/u16/u32`, `bytes(n)`, `seek`; every read
    outside the input throws `CORRUPT_CAB` with `offset` and `reason`).
  - Tests: `errors.test.ts` (codes, `details`, `instanceof`, English `message`), `limits.test.ts`
    (defaults are 20 MiB, 50 MiB, 2,000, 256 and 4 MiB; partial overrides), `cab/bytes.test.ts`
    (reads at every boundary; offset in the error).
  - Requirements: R3.2, R4.6.
  - Done when: `pnpm check` green.

- [x] 4. Test cabinet writer and CAB header, folder and file structures
  - `helpers/cab-writer.ts` (test only, Node `zlib.deflateRawSync`): builds cabinets from
    `{ name, bytes, attributes? }[]`, with options for blocks per folder, several folders,
    compression type, header flags, reserve sizes, wrong checksums, and raw overrides of any
    header field.
  - `src/cab/structures.ts`: CFHEADER, CFFOLDER, CFFILE parsing (design §6 steps 1–4): `MSCF`
    check, version, spanning flags, reserve areas, compression type check for every folder before
    any inflation, `entries` limit before CFFILE entries are read, `inputBytes` limit before
    anything.
  - Tests: `helpers/cab-writer.test.ts` (a written cabinet has the header fields asked for, and the
    zlib oracle reads its data back), `cab/structures.test.ts` (headers of all 48 sample
    cabinets: version 1.3, flags 0, one MSZIP folder; reserve skipped), `cab/unsupported.test.ts`
    (types 2 and 3 name `Quantum` and `LZX` and the folder index; type 7 gives the number; flags
    1 and 2 give `UNSUPPORTED_CAB` with the feature; flag 4 reads normally), additions to
    `limits.test.ts` (2,001 declared files; 20 MiB + 1 byte input).
  - Requirements: R2.1, R2.2, R2.3, R2.4, R2.5, R3.1, R4.2, R4.3.
  - Done when: `pnpm check` green.

- [x] 5. Read cabinets: data blocks, checksums, slicing
  - `src/cab/checksum.ts` (MS-CAB checksum), `src/cab/reader.ts` (`readCabinet`, design §6
    steps 5–6: per-folder history, `CK`, `cbUncomp ≤ 32,768`, running `uncompressedBytes` total
    and declared total, `CHECKSUM_MISMATCH` issue only after a block inflates to the right length,
    type-0 folders, file names by attribute `0x80`, CFFILE order, folder index and range checks).
    Export `readCabinet` from `src/index.ts`.
  - Tests: `cab/checksum.test.ts` (all 64 non-zero CFDATA checksums in the 48 cabinets match;
    counted 2026-11-10), `cab/read.unit.test.ts` (two folders with history reset between them;
    type-0 folder; UTF-8 and Windows-1252 names; CFFILE order; date, time and attributes kept),
    `cab/corrupt.test.ts` (truncation at every structure boundary of one sample cabinet gives
    `CORRUPT_CAB` with the offset; missing `CK`; wrong `cbUncomp`; bad folder index; file range
    past the folder; one flipped checksum byte in a sample cabinet: same files, exactly one
    `CHECKSUM_MISMATCH` with both values), additions to `limits.test.ts` (declared 51 MiB; actual
    output past 50 MiB stops before the next block; `cbUncomp` 32,769 is `CORRUPT_CAB`).
  - Requirements: R1.1, R1.2, R1.3, R1.4, R1.5, R3.2, R3.3, R3.4, R3.5, R3.6, R4.1, R4.4.
  - Done when: `pnpm check` green.
  - Hardening, added at review 2026-11-10: block headers of all folders walked before the first
    inflate, overlap check (R3.7), `cbUncomp` 0 refused (R3.8), `blocks` limit (R4.7);
    `cab/hardening.test.ts`.

- [x] 6. Cabinet oracle over every sample
  - `oracles/public-sample.ts` (the six sizes and SHA-256 values of requirements Appendix B).
  - Test: `cab/read.samples.test.ts`: for every `samples/own/xsn/<slug>.xsn`, `readCabinet` returns
    exactly the files of `samples/own/forms/<slug>/`, byte for byte; the public sample matches
    Appendix B; the test fails if an `.xsn` has no `forms/` folder or a `forms/` folder has no
    `.xsn`. No `bsdtar` is used.
  - Requirements: R1.6.
  - Done when: `pnpm check` green.

- [x] 7. XML decoding and the pre-scan
  - `src/xml/decode.ts` (design §7.2 step 1 and D11: BOM, UTF-16 byte patterns, declared label,
    `TextDecoder` with `fatal: true`, `REFUSED_ENCODINGS`, `INVALID_ENCODING` fallback),
    `src/xml/prescan.ts` (step 3: DOCTYPE outside comments and CDATA → `UNSAFE_XML` with line and
    column; depth > `xmlDepth` → `LIMIT_EXCEEDED`).
  - Helper: `helpers/encode.ts` writes encoded fixtures from UTF-8 strings (Node `TextEncoder` for
    UTF-8/16, fixed byte tables for the single-byte and Shift_JIS cases), so no binary fixture is
    committed.
  - Tests: `xml/decode.test.ts` (UTF-8 with and without BOM; UTF-16LE and BE with BOM and without;
    Cyrillic text in `windows-1251`, plus `windows-1252`, `iso-8859-1` and `shift_jis` decode to the
    expected strings; unknown label and `iso-2022-kr` → `INVALID_XML` naming the label; each
    `REFUSED_ENCODINGS` label refused; invalid UTF-8 bytes → text with U+FFFD and
    `INVALID_ENCODING`), `xml/prescan.test.ts` (DOCTYPE at start and after the declaration;
    `<!DOCTYPE` text inside a comment, CDATA and an attribute value is not a DOCTYPE; depth 256
    passes, 257 fails with the line; 100,000 levels fail fast).
  - Requirements: R4.5, R5.2, R5.3, R5.7 (encodings, depth).
  - Done when: `pnpm check` green.

- [x] 8. XML parsing, nodes, paths and the `xmlBytes` budget
  - `src/xml/parse.ts` (the only importer of `@xmldom/xmldom`; `onError` mapping to
    `INVALID_XML` and `XML_WARNING`), `src/xml/node.ts` (`XmlElement`: local name, namespace,
    attributes without `xmlns`, element and non-whitespace text children, line, column,
    `outerXml()`), `src/xml/path.ts` (design §7.3), and `parseXml(bytes, file, ctx)` combining
    decode, budget, prescan and parse. `xmlBytes` is charged per document from a shared budget.
  - Tests: `xml/parse.test.ts` (line and column on elements, attributes and errors; malformed
    input → `INVALID_XML` with position), `xml/path.test.ts` (fixed prefixes whatever the document
    uses; `{uri}local` for other namespaces; positions counted per name; `/@name`, `/@{uri}local`,
    `/text()[n]`), `xml/safety.test.ts` (billion laughs, external entity `file:///etc/passwd`,
    external DTD, parameter entity: all `UNSAFE_XML`, and `fetch` stubbed to throw is never called),
    additions to `limits.test.ts` (`xmlBytes` exceeded across two documents).
  - Requirements: R4.6 (`xmlBytes`), R5.1, R5.5, R5.6, R5.7 (attack set).
  - Done when: `pnpm check` green.

- [x] 9. Generate the MS-IPFF2 name list
  - `packages/core/scripts/gen-ms-ipff2.ts` (dev only, run with `pnpm --filter @afterlife/core
    gen:ms-ipff2`; Node and xmldom allowed, outside `src/`): fetches the XSDs of MS-IPFF2
    sections 5.1, 5.2 and 5.3 from learn.microsoft.com and writes `src/xsf/ms-ipff2.ts`: for each
    element position (global elements and local elements as `parent/local`), its attributes,
    child element names and, for attributes typed by an explicit `xsd:enumeration` list or
    `xdYesNo`, the allowed values. The file header names the source (MS-IPFF2 sections 5.1–5.3,
    the URL of each, the retrieval date) and states that it holds only element names, attribute
    names and enumeration values, copied to implement the format, which the Microsoft Open
    Specifications notice allows. No prose from the spec and no XSD text.
  - Test: `xsf/ms-ipff2.test.ts` (header names the three sections, URLs and a date; known entries:
    `xsf:rule` has `caption`, `condition`, `isEnabled` and the child `xsf:exitRuleSet`;
    `xsf:signedDataBlock/@mode` is `single`, `cosign`, `countersign`;
    `xsf:submit/errorMessage` (local) and `xsf:errorMessage` (global, the child of
    `xsf:errorCondition`) are separate positions;
    `runtimeCompatibility` is not an enumeration; the file contains no `<xsd:` and no
    `documentation` text).
  - Requirements: R13.4 (enumeration source), R13.8 (documented source).
  - Done when: the script has been run once and its output committed for review; `pnpm check`
    green without network access.

- [x] 10. Manifest walker with unknown-entry reporting
  - `src/xsf/walk.ts` (design §8.2) driven by an `ElementSpec` table type in
    `src/xsf/vocabulary.ts`; this task adds only the type and a small test table, not the full
    vocabulary.
  - Test: `xsf/walk.test.ts` with the test table: an unknown element is one entry for its whole
    subtree with outer XML and line; an unknown attribute on a modelled element is one entry with
    its value; non-whitespace text in an element-only position is a `text` entry; an enum or
    `yesNo` value outside its list is kept and reported with `unexpectedValue`; comments,
    processing instructions, whitespace and namespace declarations produce nothing; `rawXml` and
    `text` content are kept verbatim; a root other than `xsf:xDocumentClass` is `INVALID_XML`;
    entries come out in document order; `documented` follows `ms-ipff2.ts`.
  - Requirements: R13.1, R13.2, R13.3, R13.4, R13.5, R13.7, R13.8.
  - Done when: `pnpm check` green.

- [x] 11. The full manifest vocabulary table
  - `src/xsf/vocabulary.ts`: `XSF_VOCABULARY`, one entry per position R7–R12 model, each with its
    `req` id, covering requirements Appendix A (forms 01–47 and the public sample) and design §8.1.
  - Tests: `xsf/vocabulary.ms-ipff2.test.ts` (every key, child and attribute exists at that
    position in `ms-ipff2.ts`; every enum list equals the generated one;
    `sharepointListAdapterRW` spelling; the only exception is a child marked `viaWildcard: true`
    (today the two children of `xsf:extension`): each such child is a global element of the xsf2
    or xsf3 schema, and its parent's content in `ms-ipff2.ts` is a wildcard), `xsf/vocabulary.requirements.test.ts` (the element names
    listed in R7–R12, kept in the test with their requirement ids, are all table keys with that
    `req`), `xsf/walk.samples.test.ts` (walking each `samples/own/forms/*/manifest.xsf` and the
    public manifest gives zero unknown entries; this is the walker-level check before the builders
    exist).
  - Requirements: R13.6 (manifest walk), R13.8.
  - Done when: `pnpm check` green.

- [x] 12. Manifest builder: identity, package, schemas, views
  - `src/xsf/types.ts` (design §5.1), `src/xsf/build.ts` with `take()` and `assertAllConsumed()`,
    and builders for `documentClass`, `solution` (`xsf2:solutionDefinition`, `server`, `offline`,
    `runtimeCompatibility` split, `xsf3`), `package`, `documentSchemas`, `fileNew`, `upgrade`,
    `importParameters`, `applicationParameters`, `views` (mainpane, print settings, header,
    footer, view extensions by `ref`, merged print view, `xmlToEdit`/`editWith`,
    `fragmentToInsert` raw XML, menu area, toolbar, unbound buttons). An internal
    `parseManifest(bytes)` joins `xml/`, the walker and the builders.
  - Tests: `xsf/build.identity.test.ts` (R7.6 oracle: own forms have `trustSetting="automatic"`
    and no `trustLevel`; public sample `trustLevel="restricted"`, `productVersion="11.0.6357"`,
    `solutionFormatVersion="1.100.0.0"`; form 43 `runtimeCompatibility` `["client", "server"]`;
    absent attributes stay absent), `xsf/build.views.test.ts` (form 05: 3 views, 3
    `switchViewAction` buttons; across forms 01–42: 18 `xCollection`, 1 `xOptional`, 2 `xReplace`,
    15 `type="rich"`, 21 `fragmentToInsert`; synthetic print settings, header, footer,
    `mergedPrintView`, `xsf3:viewExtension`), `xsf/build.consumed.test.ts` (a builder that skips a
    modelled child throws `INTERNAL`).
  - Requirements: R7.1, R7.2, R7.3, R7.4, R7.5, R7.6, R8.1, R8.2, R8.3, R8.4, R8.5.
  - Done when: `pnpm check` green.

- [x] 13. Manifest builder: rules, bindings, calculations, validation
  - Builders for rule sets, rules (`exitRuleSet` flag), every action kind with attributes and text,
    event bindings from each `ruleSetAction` parent, `domEventHandler` attributes, calculated
    fields, error conditions with verbatim messages (the global `xsf:errorMessage`, the child of
    `xsf:errorCondition`), `xsf3:errorBlank`, `schemaErrorMessages`.
  - Tests: `xsf/build.rules.test.ts` (across the sample manifests: 9 rules in 8 rule sets in 5
    forms; 7 assignment, 3 switchView, 1 query, 1 dialogBoxExpression; 8 `ruleSetAction`: 2
    `onLoad`, 1 `domEventHandler`, 5 buttons; synthetic `exitRuleSet`, `changeAdapterProperty`,
    `webPartConnectionAction`, `signSignatureLineAction`, `openNewDocumentAction`,
    `closeDocumentAction`, `dialogBoxMessageAction`; form 47 `domEventHandler` with
    `handlerObject` and no rule set), `xsf/build.validation.test.ts` (19 calculated fields in own
    forms plus 1 in the public sample; error conditions per form equal the README `Checks`
    column; message text and `shortMessage` byte-equal to the manifest, whitespace included;
    synthetic `xsf3:errorBlank` and `schemaErrorMessages`).
  - Requirements: R9.1, R9.2, R9.3, R9.4, R9.5, R9.6, R10.1, R10.2, R10.3, R10.4, R10.5.
  - Done when: `pnpm check` green.

- [x] 14. Manifest builder: data connections and submit
  - Builders for data objects with their query adapter, `mainQuery` (the adapter under the root
    `xsf:query`; its `queryAction` child stays unknown), `xsf:submit` (attributes, adapter or
    handler, rule set, success and error messages), `xsf:dataAdapters`, every adapter kind in
    R11.3 with its children and endpoint attributes, `xsf2:dataConnections` linked by `ref`
    including `connectoid`, and `containsCredential`.
  - Synthetic fixtures: `fixtures/synthetic/sharepoint-adapters.xsf` (`sharepointListAdapter`,
    `sharepointListAdapterRW` and their fields, and the misspelling `sharePointListAdapterRW`),
    `fixtures/synthetic/connectoid.xsf`.
  - Test: `xsf/build.connections.test.ts` (form 04 `adoAdapter` with `Data Source=sql-legacy01`
    and a `webServiceAdapter` at `http://forms-legacy/budget/…`; form 03 `xmlFileAdapter
    fileUrl="locations.xml"`; forms 01, 02 and 07 submit through `emailAdapter`; form 44
    `submitToHostAdapter` with `submit/errorMessage` text; form 46 `davAdapter` with `folderURL`
    and an expression `fileName`; `containsCredential` true for `Password=`/`Pwd=` in any case and
    false otherwise; the misspelt adapter is an unknown entry with `documented: false`).
  - Requirements: R11.1, R11.2, R11.3, R11.4, R11.5, R11.7.
  - Done when: `pnpm check` green.

- [x] 15. Manifest builder: promoted fields, signatures, roles, code, ActiveX permissions
  - Builders for `listProperties` (the chain `xsf:listProperties` → `xsf:fields` → `xsf:field`)
    and `listPropertiesExtension`, `documentSignatures` with
    `signedDataBlock` and `message`, `xsf3:signatureLines`, `roles` with `role` and `membership`,
    `xsf2:managedCode`, `xsf:scripts` with `script`, `permissions/allowedControl`.
  - Synthetic fixtures: `fixtures/synthetic/roles.xsf`, `fixtures/synthetic/allowed-control.xsf`,
    `fixtures/synthetic/signature-lines.xsf`.
  - Test: `xsf/build.security.test.ts` (public sample: 1 promoted field `Date`; form 45:
    `signedDataBlock` `mode="countersign"`, its `data` and `signatureLocation` paths and its
    message text; form 46: `managedCode` `language="CSharp"`, `version="4.0"`, `projectPath` kept
    as written; form 47: `scripts` `language="jscript"`, `enforceScriptTimeout="yes"`, one
    `script src="script.js"`; synthetic roles, `allowedControl` and signature lines).
  - Requirements: R12.1, R12.2, R12.3, R12.4 (manifest part), R12.5, R12.6.
  - Done when: `pnpm check` green.

- [x] 16. Vocabulary coverage: the kitchen-sink manifest
  - `helpers/kitchen-sink.ts`: generates, from `XSF_VOCABULARY` alone, one manifest that places
    every spec key at a legal position with every attribute set (first enum value, `yes`, or `x`).
  - Tests: `xsf/vocabulary.coverage.test.ts` (parse the kitchen sink; every generated element path
    is an object with that `path` in the result and every attribute is in its `attrs`; `unknowns`
    is empty; `INTERNAL` is never thrown), `xsf/unknowns.test.ts` (an unknown element and an
    unknown attribute inserted into a sample manifest at known paths appear once each with those
    paths; MS-IPFF2 elements left out on purpose, such as `taskpane`, report `documented: true`;
    a second copy of a held-once element, such as `xsf:fileNew`, inserted into a sample manifest
    gives one `repeated` entry and one `REPEATED_ELEMENT` issue, and the first copy is still
    modelled). The kitchen sink places each key once per parent and one member per `xsd:choice`
    (the `choices` of `ms-ipff2.ts`, its one input besides the table), so it has no repeats.
  - Requirements: R13.1, R13.2, R13.7, R13.8, R13.9 (end to end through the builders).
  - Done when: `pnpm check` green.

- [x] 17. Schema set: loading, indexing, include and import, unknown constructs
  - `src/xsd/vocabulary.ts` (design §9.1 modelled list, including `group`, `attributeGroup`,
    `list`, `union`), `src/xsd/schema-set.ts` (every `.xsd` loaded through `xml/`; globals
    indexed by `{namespace}name` for elements, types, attributes, model groups and attribute
    groups, **one table per schema root** (main, each `dataObject/@schema`) holding the files it
    reaches through `include`/`import`, `DUPLICATE_GLOBAL` for a repeat inside one table (first
    kept, second still walked); `include` and `import` by package file name, case-insensitive,
    last segment; no fetch; `UNRESOLVED_REFERENCE`; main and secondary schema selection).
  - Synthetic fixtures under `fixtures/synthetic/xsd/`: `include/`, `remote-location.xsd`
    (`http://…` and `C:\…` locations), `import-no-location/`, and one file per construct that stays
    unknown: `key.xsd`, `keyref.xsd`, `unique.xsd`, `redefine.xsd`, `notation.xsd`,
    `substitution-group.xsd`, `abstract.xsd`, `block.xsd`, `final.xsd`.
  - Tests: `xsd/schema-set.test.ts` (form 04 `Vendors.xsd` imports `Vendors1.xsd` and
    `Vendors2.xsd` and their attributes are indexed; include resolves; remote and absolute
    locations are not fetched (`fetch` stubbed to throw) and record `UNRESOLVED_REFERENCE`; main
    schema from `rootSchema="yes"` and `rootElement`; form 04 has one table per root, so
    `Vendors` and `BudgetService` each resolve their own `dfs:myFields`; a synthetic package with
    the same global twice in one root's reach gives one `DUPLICATE_GLOBAL`),
    `xsd/unknown-constructs.test.ts` (each
    unknown construct gives exactly one unknown entry with its path and `documented: true`; an
    identity constraint's `selector` and `field` are inside that one entry; a made-up `xsd:foo`
    gives `documented: false`).
  - Requirements: R15.1 (resolution by name and location), R15.2, R15.4, R15.5 (include, remote),
    R15.7.
  - Done when: `pnpm check` green.

- [x] 18. Field tree: elements, types, cardinality, choice, kind, wildcards, recursion, facets
  - `src/xsd/types.ts` (design §5.2), `src/xsd/field-tree.ts` (design §9.2): `ref` and `use`,
    named types through `extension` and `restriction`, raw and effective cardinality through
    `sequence`, `choice` and `all`, `choiceGroup`, the kind table, wildcards with `namespace`,
    `processContents`, `minOccurs` and `maxOccurs`, rich text, recursion by declaration identity,
    built-in type, facets (base type's first), `variety`, description from `xsd:documentation`.
    `required` is left `false` here; task 20 sets it.
  - Synthetic fixtures under `fixtures/synthetic/xsd/`: `extension.xsd`, `recursion.xsd`,
    `kinds.xsd` (simple type, simple content, mixed XHTML `any`, wildcard-only content, empty
    content, untyped element).
  - Test: `xsd/field-tree.test.ts` (R14.8 cases except `required`: form 04 `line` repeating with
    raw `"0"` and `"unbounded"`; form 05 `relocation` optional, `fullTime`/`contractor` share one
    `choiceGroup`, `welcomeNote` `richText` with no child node; form 45 `signatures1` and
    `signatures2` are `group`, `signatures2` has no children and one `any` wildcard with namespace
    `http://www.w3.org/2000/09/xmldsig#` and `processContents="lax"`; form 47 `borrower` is a
    `group` through `personType` with `borrowerName` and `borrowerEmail`, `assetTag` keeps
    `pattern`, `assetCondition` keeps three enumerations and `maxLength` 10; secondary schemas of
    forms 03 and 04 have attribute nodes; synthetic kinds, extension order and recursion marked
    `recursive`).
  - Requirements: R14.1, R14.2, R14.3, R14.5, R14.6, R14.7, R14.8 (shape), R15.1 (named types),
    R15.3.
  - Done when: `pnpm check` green.

- [x] 19. Field tree: model groups, attribute groups, lists and unions
  - `src/xsd/field-tree.ts`: group `ref` expanded in place with its cardinality multiplied like a
    `sequence` and recorded in `raw.groups`; self-referencing group cut as `recursive`; attribute
    groups (nested, in document order, with `anyAttribute`); `list` (`itemType` or inline) and
    `union` (`memberTypes` and inline members) with their facets and `variety`.
  - Synthetic fixtures under `fixtures/synthetic/xsd/`: `group.xsd` (global group, `ref` with
    `minOccurs="0" maxOccurs="unbounded"`, a group nested in a `choice`, a self-referencing
    group), `attribute-group.xsd` (one attribute group referencing another, plus
    `anyAttribute`), `list.xsd` (by `itemType` and inline, one with `length`), `union.xsd` (by
    `memberTypes` and inline, one member accepting `''`).
  - Test: `xsd/groups.test.ts` (elements from a group ref with `maxOccurs="unbounded"` are
    `repeating` and `optional`, with the group in `raw.groups`; attribute-group attributes appear
    on the element in order; list and union nodes are `field` with the right `variety`,
    `itemType`, `memberTypes` and facets; zero unknown entries for these files).
  - Requirements: R14.3 (group multiplication), R14.7 (list and union facets), R15.1 (groups,
    attribute groups, lists, unions), R15.3 (group recursion), R15.4 (modelled constructs),
    R15.5 (synthetic group, attribute group, list, union).
  - Done when: `pnpm check` green.

- [x] 20. `required` and the empty-string check
  - `src/xsd/empty-string.ts` (design §9.3: built-in families, list, union, enumeration,
    `length`/`minLength`, pattern to `RegExp`, XSD-only pattern → unknown with
    `PATTERN_NOT_EVALUATED`), and `required` set in `field-tree.ts` for `field` element nodes only.
  - Tests: `xsd/empty-string.test.ts` (every built-in family; `list` true, `list` with
    `minLength="1"` false; `union` true if any member is; enumeration with and without `''`;
    `[A-Z]{3}-[0-9]{4}` rejects `''`; a pattern with `\i` → unknown and one
    `PATTERN_NOT_EVALUATED` issue), additions to `xsd/field-tree.test.ts` (R14.8 `required`
    values: form 01 `reason` false, `daysRequested` false; form 04 `needsAccounting` true; form 45
    `signatures1` and `signatures2` false; form 47 `assetTag` and `assetCondition` true; every
    `group` and `richText` node in every sample tree is `required: false`).
  - Requirements: R14.4, R14.8 (`required`).
  - Done when: `pnpm check` green.

- [x] 21. Package level: `parsePackage`, `parseXsn`, package checks
  - `src/xsn/package.ts` (design §10: manifest discovery, `fileReferences(manifest)`,
    `MISSING_FILE`, `UNLISTED_FILE`, `DUPLICATE_NAME`, `UNSAFE_NAME`, `URN_MISMATCH` from the first
    4 KB of `template.xml`), `src/xsn/parse.ts` (`parsePackage`, `parseXsn`; manifest errors fatal,
    other XML errors and non-manifest `xmlDepth`/`xmlBytes` overruns as issues; main and secondary
    field trees keyed by data object name; `codeFiles`; `unknowns` ordered manifest first, then
    schema files by name). Export the public API of design §4 from `src/index.ts`.
  - Tests: `xsn/package.test.ts` (no manifest, one other `.xsf`, two `.xsf` files; case-insensitive
    `Manifest.XSF`; each reference kind of R6.2 missing in turn; an unlisted file; duplicate names
    ignoring case; `..`, `C:` and leading `/` names kept with an issue; URN mismatch; samples give
    none of these issues), `xsn/parse.test.ts` (malformed manifest throws with line and column; a
    malformed or DOCTYPE schema is an issue and the rest still parses; a 257-deep secondary schema
    is an issue; form 04 secondary trees keyed by data object name; form 47 `codeFiles` is
    `["script.js"]`; a synthetic package with `.dll`, `.pdb` and `.vbs` files lists them; the
    result contains no `Uint8Array` other than `files[].bytes`).
  - Requirements: R4.5 (non-manifest issue), R5.4, R6.1, R6.2, R6.3, R6.4, R6.5, R6.6, R11.6,
    R12.4 (code files).
  - Done when: `pnpm check` green.

- [x] 22. Counts and the README oracle
  - `src/xsn/counts.ts` (`countTemplate`, design §9.4), `oracles/readme-table.ts` (design §13.1:
    first table with a `Folder` column, columns by header name, slugs from backticks, strict
    integer cells).
  - Tests: `oracles/readme-table.test.ts` (reordered columns still parse; a missing column, a
    non-integer cell or a duplicate slug fails), `counts.samples.test.ts` (for every README row,
    `countTemplate` equals Views, Fields, Rules, Calcs, Checks and Repeating/optional; form 44
    Repeating/optional is 1 while its manifest has 0 `xCollection`/`xOptional` `editWith`; public
    sample Views 1, Fields 5, Rules 0, Calcs 1, Checks 0, Repeating/optional 4; the test fails if a
    row has no `.xsn` or an `.xsn` has no row).
  - Requirements: R16.1, R16.2, R16.3.
  - Done when: `pnpm check` green.

- [ ] 23. Golden snapshots and zero unknowns over every sample
  - `helpers/snapshot.ts` (bytes → `{ size, sha256 }`, sorted keys, arrays in document order),
    `test/golden/<slug>.json` for the 47 README forms and `theill-weight-keeper.json`, written with
    `toMatchFileSnapshot` and reviewed as a diff.
  - Tests: `golden.samples.test.ts` (each cabinet through `parseXsn` with `fetch` and
    `XMLHttpRequest` stubbed to throw, compared with its golden file; no issues of any code for
    any sample), `unknowns.samples.test.ts` (`unknowns` is empty for every README form and the
    public sample, manifest and schemas).
  - Requirements: R7.6, R8.5, R9.6, R10.5, R11.7, R12.6 (whole-result check), R13.6, R15.6, R16.4,
    R17.4.
  - Done when: `pnpm check` green, and the 48 golden files are in the diff for review.

- [ ] 24. Worker parity **[browser]**
  - `browser/parse.worker.ts` (imports `parseXsn` from `src/index.ts`, receives bytes, returns the
    snapshot form from `helpers/snapshot.ts`).
  - Test: `browser/worker-parity.browser.test.ts` **[browser]**: every cabinet read with the
    browser `readFile` command, parsed in a dedicated Worker, and compared with
    `test/golden/<slug>.json` by `toEqual`; the browser project never writes snapshots. The Vite
    bundle of the Worker must build with no Node built-in (a build failure is the check).
  - Requirements: R17.1 (runtime check), R17.3.
  - Done when: `pnpm check` green.

- [ ] 25. Property P1: never hangs, never an untyped error
  - Tests: `property/p1.property.test.ts` (design §13.3: three generators, 1,000 runs each, each
    run timed with `performance.now()` under 1 s; pass is a result or an `AfterlifeError` whose
    code is in design §11), `property/regressions.ts` (failing seeds, replayed every run; empty at
    first).
  - Requirements: R19.1, R19.2, R19.3.
  - Done when: `pnpm check` green; the test log shows 3,000 runs and the slowest run time.

- [ ] 26. Property P12: every manifest node accounted for exactly once
  - Test: `property/p12.property.test.ts` (design §13.3: random insertions into random README
    manifests; an oracle that walks the mutated DOM with its own code; exactly one of modelled or
    unknown for every element and non-`xmlns` attribute; each inserted unmodelled node has an entry
    whose path selects it; `unexpectedValue` entries not counted; `repeated` entries counted as
    unknown, and the generator also inserts repeats of held-once elements; 500 runs).
  - Requirements: R20.1, R20.2, R20.3.
  - Done when: `pnpm check` green.

- [ ] 27. Performance budget
  - Test: `perf/parse.perf.test.ts` (each of the 48 cabinets: 3 warm-up runs, then 20 timed
    `parseXsn` runs; p95 under 300 ms each; prints a table of p50 and p95 per form, with
    `08-big-form` on its own line; fails if `process.version` is not `v22.*`).
  - Requirements: R18.1, R18.2.
  - Done when: `pnpm check` and `pnpm test:perf` green on Node 22.23.4.

- [ ] 28. Re-check every acceptance criterion and update the coverage document
  - Run `pnpm check` and `pnpm test:perf` on a clean install (`pnpm install --frozen-lockfile`).
  - Walk every criterion R1.1–R20.3 and report, in the task report, the test file and test name
    that proves it and its result. A criterion with no passing test is a failed task, not a note.
  - Re-run the brief's acceptance criteria AC1–AC8 and P1 against the same evidence.
  - `docs/feature-coverage.md`: in the `Status` column, for every row whose input spec 01 now
    extracts and tests (for example promoted fields, `errorCondition`, `xsf3:errorBlank`, data
    connections, `submitToHostAdapter`, DAV submit, signatures, managed code, script, schema
    facets, field types, repeating and optional fields), add `parsed: spec 01` after the owning
    spec, and say in the Status line under "Coverage classes" what that means (the parser
    extracts and tests it; the coverage state is still the owning spec's). Rows for controls,
    rendering and expressions stay as they are.
  - Requirements: all (re-check).
  - Done when: `pnpm check` and `pnpm test:perf` green, the criterion table has no failing row, and
    the `docs/feature-coverage.md` diff is in the report.

## Coverage check

Every requirement id appears in at least one task. Task 28 re-checks all of them.

| Requirement | Tasks |
|---|---|
| R1.1, R1.3, R1.4, R1.5 | 5 |
| R1.2 | 2, 5 |
| R1.6 | 6 |
| R2.1, R2.2, R2.3, R2.4, R2.5 | 4 |
| R3.1 | 4 |
| R3.2 | 3, 5 |
| R3.3, R3.4, R3.5, R3.6 | 5 |
| R3.7, R3.8 | 5 (hardening, added after review) |
| R4.1, R4.4 | 5 |
| R4.2, R4.3 | 4 |
| R4.5 | 7, 21 |
| R4.6 | 3, 8 |
| R4.7 | 5 (hardening, added after review) |
| R5.1, R5.5, R5.6 | 8 |
| R5.2 | 7 |
| R5.3 | 2, 7 |
| R5.4 | 21 |
| R5.7 | 7, 8 |
| R6.1, R6.2, R6.3, R6.4, R6.5, R6.6 | 21 |
| R7.1, R7.2, R7.3, R7.4, R7.5 | 12 |
| R7.6 | 12, 23 |
| R8.1, R8.2, R8.3, R8.4 | 12 |
| R8.5 | 12, 23 |
| R9.1, R9.2, R9.3, R9.4, R9.5 | 13 |
| R9.6 | 13, 23 |
| R10.1, R10.2, R10.3, R10.4 | 13 |
| R10.5 | 13, 23 |
| R11.1, R11.2, R11.3, R11.4, R11.5 | 14 |
| R11.6 | 21 |
| R11.7 | 14, 23 |
| R12.1, R12.2, R12.3, R12.5 | 15 |
| R12.4 | 15, 21 |
| R12.6 | 15, 23 |
| R13.1, R13.2 | 10, 16 |
| R13.3, R13.5 | 10 |
| R13.4 | 9, 10 |
| R13.6 | 11, 23 |
| R13.7 | 10, 16 |
| R13.8 | 9, 10, 11, 16 |
| R13.9 | 14 (review change), 16, 26 |
| R14.1, R14.2, R14.5, R14.6 | 18 |
| R14.3 | 18, 19 |
| R14.4 | 20 |
| R14.7 | 18, 19 |
| R14.8 | 18, 20 |
| R15.1 | 17, 18, 19 |
| R15.2 | 17 |
| R15.3 | 18, 19 |
| R15.4 | 17, 19 |
| R15.5 | 17, 19 |
| R15.7 | 17, 18 (added at task 17) |
| R15.6 | 23 |
| R16.1, R16.2, R16.3 | 22 |
| R16.4 | 23 |
| R17.1 | 1, 24 |
| R17.2 | 2 |
| R17.3 | 24 |
| R17.4 | 1, 23 |
| R18.1 | 1, 27 |
| R18.2 | 27 |
| R19.1, R19.2, R19.3 (P1) | 25 |
| R20.1, R20.2, R20.3 (P12) | 26 |

Properties: P1 → task 25, P12 → task 26.

Browser-only tasks or checks: task 1 (`browser/harness.browser.test.ts`), task 2
(`browser/inflate.browser.test.ts`, `browser/encodings.browser.test.ts`), task 24 (whole task).

**Total: 28 tasks.**
