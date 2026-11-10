# Design: 01 .xsn parser (CAB + manifest + schema)

Phase 2 of 3. Requirements: `requirements.md` (R1–R20, approved 2026-11-10, amended at design
approval). Status: **approved 2026-11-10**, with the answers and changes applied: D1, D7, D10 and
`src/xsn/` approved; field kind from the content model (§9.2); encodings (§7.2); XSD groups,
attribute groups, lists and unions (§9); forms 43–47 (§8.1, §14).

## 1. Overview

```
bytes ──► cab/ ──► PackageFile[] ──► xsn/ (find manifest, R6 checks)
                                        │
                     ┌──────────────────┼───────────────────┐
                     ▼                  ▼                   ▼
             xml/ (decode, prescan, xmldom, paths)   used by xsf/ and xsd/
                     │
        xsf/ walker + vocabulary ──► Manifest + unknowns
        xsd/ loader + tree       ──► FieldTree (main, secondary) + unknowns
                                        │
                                        ▼
                                 ParsedTemplate ──► spec 02 (FormIR)
```

- `parseXsn(bytes)` is async, because the only inflater available in a Web Worker
  (`DecompressionStream`) is stream-based. Everything after inflation is synchronous.
- `parsePackage(files)` is the synchronous second half. Tests use it for synthetic manifests
  without building a cabinet; `parseXsn` is `readCabinet` followed by `parsePackage`.
- Fatal problems throw `AfterlifeError`. Everything else is collected as `Issue`s, and the result
  is still returned. Only the container and the manifest can be fatal (R5.4).
- Core has no network, file system, DOM or Node-only imports. It runs unchanged in Node 22, in a
  dedicated Web Worker and in a Forge function (Node 22 runtime).

## 2. Decisions

| # | Decision | Alternatives | Why |
|---|---|---|---|
| D1 | **One inflater in both runtimes: `DecompressionStream('deflate-raw')`.** `zlib.inflateRawSync` is used only in tests, as an independent oracle. Approved 2026-11-10; tech.md's Deflate line now says this. | (a) `inflateRawSync` in Node and `DecompressionStream` in the browser, as tech.md says; (b) a small inflater written in core | Measured 2026-11-10: the two disagree on irregular blocks. With 8 junk bytes after the stream, Node 22.23.4's `DecompressionStream` and `inflateRawSync` both return the data with no error, while Node 26.13 and Chrome 157 return the data and then raise `TypeError`. For a stream with no final block, `inflateRawSync` throws and gives no output; `DecompressionStream` gives the output and then raises an error. R17.3 needs Node and Worker results to be deep-equal, and one code path makes that true by construction. `DecompressionStream` is a global in Node 22.23.4 (checked). Option (b) means more code for us to own, and tech.md forbids it. |
| D2 | **History across blocks: stored-block prefix.** For block *k* > 0, inflate `[stored block holding the last ≤ 32 KB of folder output] + block k`, then drop the prefix bytes. | dictionary option (not in `DecompressionStream`); own inflater | Proved 2026-11-10 against a zlib-dictionary oracle on all 43 cabinets, including the 7 multi-block ones. It passed on Node 26 main thread, Node 26 `worker_threads`, Node 22.23.4 main thread and `worker_threads`, and a Chrome 157 dedicated Worker. Re-run in Node on the 48 cabinets after forms 43–47 arrived: all equal, still 7 multi-block. The stored block header is 5 bytes: `0x00`, LEN, ~LEN (BFINAL=0, BTYPE=00). |
| D3 | **A block is accepted when exactly `cbUncomp` bytes come out after the prefix.** An inflater error after that point is ignored. Fewer bytes, more bytes, or an error before that point is `CORRUPT_CAB` (R3.3). | report an "unclean end" issue | Whether junk after the stream raises an error depends on the runtime (D1), so an issue for it could not be deterministic. The data is complete and the checksum (R3.4) still catches corruption. |
| D4 | **XML: `@xmldom/xmldom` 0.9.12, wrapped by `xml/`**, with our own decoding and pre-scan in front of it. | `saxes` (ISC, SAX only), `txml` (MIT, no locations), `fast-xml-parser` (MIT, no DOM) | Checks in §7.1. It meets R5 once we decode bytes ourselves and reject DOCTYPE and depth before it runs. No other MIT parser is needed. |
| D5 | **One vocabulary table drives extraction and the unknown check** (§8). | hand-written extractors plus a separate "known names" list | Two lists drift. With one table, "modelled" is a property of the table plus the walker, and tests can check it mechanically (§8.5). |
| D6 | **MS-IPFF2 names are generated into core** (`xsf/ms-ipff2.ts`) by a dev script from the XSDs in sections 5.1–5.3. They supply `documented` (R13.8) and the enumeration lists (R13.4), and a test checks that the vocabulary is a subset of them. Approved. The generated file's header names the source (MS-IPFF2 sections 5.1–5.3, URL, retrieval date) and says it holds only element names, attribute names and enumeration values, copied to implement the format, which the Microsoft Open Specifications notice allows. No prose from the spec and no XSD text. | hand-copy; fetch at runtime | Core makes no network requests. The Open Specifications notice allows copies made to implement the format. |
| D7 | **Extra limit `xmlBytes` = 4 MiB, the total across all XML this spec parses.** Approved, as an option. An overrun in a file other than the manifest is an issue, not a fatal error. | none | P1 (R19) requires ≤ 1 s for any input ≤ 2 MiB. A 2 MiB cabinet can inflate to the 50 MiB cap, and xmldom parses about 9.5 MB/s (4.7 MB in 496 ms, measured). 4 MiB is about 0.45 s of parsing. The largest in-repo form parses 72 KB of XML; across the whole 71-form corpus the largest manifest plus schemas is 45 KB (a third-party template, not in the repo), so 4 MiB is about 90 times that. |
| D8 | **`template.xml` is not parsed into a DOM.** R6.6 reads only the `mso-infoPathSolution` processing instruction, with a bounded scan of the first 4 KB. | full parse | That is all this spec needs, and it keeps large default data out of the `xmlBytes` budget. |
| D9 | **Every `.xsd` in the package is loaded into one schema set**, even when it is not referenced. Trees are built only from roots (main, and each `dataObject`). | load only referenced files | Unknown-content checks (R15.4/15.6) then cover every schema file, and include/import resolve by name inside one set. |
| D10 | **Lint and format: eslint 10 + typescript-eslint 8 + prettier 3**, with **TypeScript 6.0.3**. Approved. | oxlint + oxfmt; Biome 2.6.6; TypeScript 7.0.2 | typescript-eslint 8.72.1 has type-aware rules (`no-floating-promises` matters with async inflate) and supports TS `>=4.8.4 <6.1.0`. TypeScript 7.0.2 (the native compiler) is outside that range, so 6.0.3, the last JS release, is the newest we can use. oxfmt is pre-1.0 (0.78.0). `no-restricted-imports` and `no-restricted-globals` enforce R17.1 in the editor. |
| D11 | **Encodings: `TextDecoder` decides, plus one fixed refusal list** (R5.3). A declared label is passed to `new TextDecoder(label, { fatal: true })`; a `RangeError` (unknown label, and every label that maps to `replacement`, which the constructor rejects by the WHATWG spec) is `INVALID_XML`. The canonical `decoder.encoding` is then checked against `REFUSED_ENCODINGS` in `xml/decode.ts`, the encodings that only one runtime supports. | allow only UTF-8/16 (the first R5.3); our own decoders | Decoding is not a safety risk, and old schemas imported from other systems use legacy code pages. Measured 2026-11-10 over the 228 WHATWG labels: Node 26.13 accepts 222, Node 22.23.4 accepts 220; both reject the 6 `replacement` labels, and Node 22 also rejects `iso-8859-16` and `x-user-defined`. Chromium is measured in task 2; the list is whatever the two runtimes do not share. |
| D12 | **Field kind from the content model; XSD groups, attribute groups, lists and unions modelled** (R14.1, R14.4, R15.1, R15.4). | kind from "has child elements" (the first §9.2); leave groups unknown | Form 45's `signatures2` (only an `xsd:any` in the XML-DSig namespace) would have been a `field` and then `required`. Groups and attribute groups appear in schemas built from web services and line-of-business systems; leaving them unknown would drop their fields from the tree. |

## 3. Module layout

`packages/core/` (package name `@afterlife/core`, private, ESM):

```
src/
  index.ts                 public API only (§4)
  errors.ts                AfterlifeError, ErrorCode, Issue, IssueCode
  limits.ts                Limits, DEFAULT_LIMITS
  cab/
    bytes.ts               ByteReader: bounds-checked little-endian reads; throws CORRUPT_CAB with offset
    structures.ts          CFHEADER / CFFOLDER / CFDATA / CFFILE parsing (R2, R3.1–3.2, R3.5, R4.2–4.4)
    checksum.ts            MS-CAB checksum (R3.4)
    inflate.ts             inflateBlock(): DecompressionStream + stored-block prefix (D1–D3)
    reader.ts              readCabinet() (R1)
  xml/
    decode.ts              bytes → string; BOM, declaration, TextDecoder labels, REFUSED_ENCODINGS (R5.3, D11)
    prescan.ts             DOCTYPE + depth check before parsing (R4.5, R5.2)
    parse.ts               the only importer of @xmldom/xmldom (R5.5–5.6)
    path.ts                path strings for elements, attributes, text (glossary "Path")
    node.ts                XmlElement: the small read-only interface xsf/ and xsd/ use
  xsf/
    vocabulary.ts          XSF_VOCABULARY: the one table (§8)
    ms-ipff2.ts            GENERATED: MS-IPFF2 element/attribute names and enumerations (D6)
    walk.ts                generic walker: DOM → ModelNode tree + UnknownEntry[]
    build.ts               ModelNode tree → typed Manifest (R7–R12)
    types.ts               Manifest and its parts
  xsd/
    vocabulary.ts          XSD constructs modelled (R15.4)
    schema-set.ts          load all .xsd, index globals by {ns}name, include/import (R15.1–15.2)
    field-tree.ts          FieldNode tree, cardinality, choice, recursion (R14, R15.3)
    empty-string.ts        "does the type accept ''?" for required (R14.4)
    types.ts
  xsn/
    package.ts             manifest discovery, file references, name checks (R6)
    parse.ts               parsePackage(), parseXsn()
    counts.ts              countTemplate(): the README columns (R16.1)
scripts/
  gen-ms-ipff2.ts          dev only; fetches MS-IPFF2 5.1–5.3 and writes src/xsf/ms-ipff2.ts
test/                      see §13
```

structure.md lists `cab/`, `xsf/`, `xsd/`, and now `xml/` and `xsn/` (added 2026-11-10 at design
approval).

## 4. Public API

```ts
// packages/core/src/index.ts
export async function parseXsn(bytes: Uint8Array, options?: ParseOptions): Promise<ParsedTemplate>;
export function parsePackage(files: readonly PackageFile[], options?: ParseOptions): ParsedTemplate;
export async function readCabinet(bytes: Uint8Array, options?: ParseOptions): Promise<Cabinet>;
export function countTemplate(t: ParsedTemplate): TemplateCounts;

export { AfterlifeError, DEFAULT_LIMITS };
export type {
  ParseOptions, Limits, ParsedTemplate, Cabinet, CabinetInfo, PackageFile, Manifest, FieldTree,
  FieldNode, UnknownEntry, Issue, IssueCode, ErrorCode, TemplateCounts,
};

export interface ParseOptions { readonly limits?: Partial<Limits> }

export interface Limits {
  readonly inputBytes: number;        // 20 MiB  (R4.3)
  readonly uncompressedBytes: number; // 50 MiB  (R4.1)
  readonly entries: number;           // 2,000   (R4.2)
  readonly blocks: number;            // 4,096   (R4.7), total CFDATA blocks across folders
  readonly xmlDepth: number;          // 256     (R4.5)
  readonly xmlBytes: number;          // 4 MiB   (D7)
}

export interface TemplateCounts {      // R16.1, one field per README column
  views: number; fields: number; rules: number; calcs: number; checks: number;
  repeatingOrOptional: number;
}
```

## 5. Data types

```ts
export interface ParsedTemplate {
  readonly parserVersion: 1;
  readonly cabinet: CabinetInfo;
  readonly files: readonly PackageFile[];       // CFFILE order (R1.5)
  readonly manifest: Manifest;
  readonly schemas: {
    readonly main?: FieldTree;                  // absent only if the main schema failed (issue recorded)
    readonly secondary: Readonly<Record<string, FieldTree>>; // key: dataObject @name (R11.6)
  };
  readonly codeFiles: readonly string[];        // *.dll, *.pdb, *.js, *.vbs (R12.4)
  readonly unknowns: readonly UnknownEntry[];   // manifest first, then schema files by name; document order within a file
  readonly issues: readonly Issue[];
}

export interface CabinetInfo {
  readonly versionMajor: number; readonly versionMinor: number;
  readonly flags: number; readonly setId: number; readonly cabinetIndex: number;
  readonly folders: readonly { compression: 'none' | 'mszip'; blocks: number; offset: number }[];
}

export interface PackageFile {
  readonly name: string;                        // decoded per R1.4
  readonly size: number;
  readonly date: number; readonly time: number; // raw MS-DOS u16 values; no Date objects (determinism)
  readonly attributes: number;
  readonly folder: number;
  readonly bytes: Uint8Array;
}
export interface Cabinet { readonly info: CabinetInfo; readonly files: readonly PackageFile[]; readonly issues: readonly Issue[] }

export interface Located { readonly file: string; readonly path: string; readonly line: number; readonly column: number }

export interface UnknownEntry extends Located {
  readonly kind: 'element' | 'attribute' | 'text';
  readonly reason: 'notModelled' | 'unexpectedValue';
  readonly namespace: string | null;
  readonly name: string;                        // local name; '#text' for text
  readonly raw: string;                         // outer XML, `name="value"`, or the text
  readonly documented: boolean;                 // MS-IPFF2 (manifest) or XSD 1.0 (schemas) defines it here
}

export interface Issue {
  readonly code: IssueCode;
  readonly message: string;                     // English, for logs; the UI maps code → text
  readonly file?: string; readonly path?: string;
  readonly offset?: number; readonly line?: number; readonly column?: number;
  readonly details?: Readonly<Record<string, string | number>>;
}
```

### 5.1 Manifest

Every modelled element becomes a `Modelled<K>`: its location plus **all** of its declared
attributes, as the original strings (R7.5). The attribute keys are typed from the vocabulary
table, so a builder cannot leave out an attribute the table declares (§8.3).

```ts
type SpecKey = keyof typeof XSF_VOCABULARY;
type AttrName<K extends SpecKey> = keyof (typeof XSF_VOCABULARY)[K]['attrs'] & string;
export interface Modelled<K extends SpecKey> extends Located {
  readonly key: K;
  readonly attrs: Readonly<Partial<Record<AttrName<K>, string>>>;
}

export interface Manifest {
  readonly documentClass: Modelled<'xsf:xDocumentClass'>;                       // R7.1
  readonly solution: {                                                          // R7.2, R12.4
    readonly definition?: Modelled<'xsf2:solutionDefinition'>;
    readonly runtimeCompatibility: readonly string[];  // split on whitespace; [] when absent
    readonly server?: Modelled<'xsf2:server'>; readonly offline?: Modelled<'xsf2:offline'>;
    readonly managedCode?: Modelled<'xsf2:managedCode'>;
    readonly xsf3?: Modelled<'xsf3:solutionDefinition'>; readonly baseUrl?: Modelled<'xsf3:baseUrl'>;
  };
  readonly package: readonly PackageEntry[];        // xsf:file + fileProperties (R7.4)
  readonly documentSchemas: readonly Modelled<'xsf:documentSchema'>[];
  readonly fileNew?: Modelled<'xsf:initialXmlDocument'>;
  readonly upgrade?: Modelled<'xsf:useTransform'>;                              // R7.3
  readonly importParameters?: Modelled<'xsf:importParameters'>;
  readonly applicationParameters: readonly ApplicationParameters[];
  readonly views: readonly View[]; readonly defaultView?: string;               // R8
  readonly ruleSets: readonly RuleSet[];                                        // R9.1–9.3
  readonly bindings: readonly EventBinding[];                                   // R9.4–9.5
  readonly calculations: readonly Modelled<'xsf:calculatedField'>[];            // R10.1
  readonly validations: readonly ErrorCondition[];                              // R10.2–10.3
  readonly blankChecks: readonly Modelled<'xsf3:errorBlank'>[];                 // R10.4
  readonly schemaErrorMessages?: Modelled<'xsf:schemaErrorMessages'>;
  readonly dataObjects: readonly DataObject[];                                  // R11.1
  readonly submit?: Submit;                                                     // R11.2
  readonly dataAdapters: readonly Adapter[];
  readonly connectionExtensions: readonly ConnectionExtension[];                // R11.4
  readonly promotedFields: readonly Modelled<'xsf:listProperties/field'>[];     // R12.1
  readonly signatures?: Signatures;                                             // R12.2
  readonly roles?: Roles;                                                       // R12.3
  readonly scripts?: Scripts;                                                   // R12.4
  readonly allowedControls: readonly Modelled<'xsf:allowedControl'>[];          // R12.5
}

export interface Rule extends Modelled<'xsf:rule'> {
  readonly actions: readonly Action[];      // document order
  readonly exitRuleSet: boolean;            // xsf:exitRuleSet present (R9.3)
}
export type Action = Modelled<ActionKey> & { readonly text?: string };   // dialog text, R9.2
export interface EventBinding extends Located {
  readonly ruleSet: string;
  readonly trigger:
    | { kind: 'fieldChange'; match: string; handler: Modelled<'xsf:domEventHandler'> }
    | { kind: 'onLoad' } | { kind: 'submit' }
    | { kind: 'button'; view?: string; button: Modelled<ButtonKey> };
}
export interface Adapter extends Modelled<AdapterKey> {
  readonly role: 'query' | 'submit' | 'dataAdapter';
  readonly children: readonly Modelled<SpecKey>[];  // operation/input, to/cc/…, folderURL/fileName, field
  readonly containsCredential: boolean;             // R11.5, adoAdapter only
}
export interface ErrorCondition extends Modelled<'xsf:errorCondition'> {
  readonly message: Modelled<'xsf:errorCondition/errorMessage'> & { readonly text: string };  // verbatim (R10.3)
}
// View, RuleSet, DataObject, Submit, Signatures, Roles, Scripts, PackageEntry, ConnectionExtension
// follow the same pattern: Modelled<key> plus typed child arrays.
```

### 5.2 Field tree

```ts
export interface FieldTree { readonly file: string; readonly root: FieldNode }

export interface FieldNode {
  readonly name: string; readonly namespace: string | null;
  readonly nodeType: 'element' | 'attribute';
  readonly kind: 'group' | 'field' | 'richText';     // from the content model (§9.2, R14.1)
  readonly xsdType: {                                                           // R14.1, R14.7
    readonly declared?: QName; readonly builtin: QName;
    readonly variety: 'atomic' | 'list' | 'union' | 'complex';
    readonly itemType?: QName;                      // list
    readonly memberTypes?: readonly QName[];        // union; inline members get their builtin QName
  };
  readonly raw: {                                                               // R14.2, strings as written
    readonly minOccurs?: string; readonly maxOccurs?: string; readonly nillable?: string;
    readonly use?: string;                                                      // attributes
    readonly groups: readonly {                     // enclosing particles, outermost first
      kind: 'sequence' | 'choice' | 'all' | 'group'; ref?: QName; minOccurs?: string; maxOccurs?: string;
    }[];
  };
  readonly effective: { readonly minOccurs: number; readonly maxOccurs: number | 'unbounded'; readonly nillable: boolean };
  readonly repeating: boolean; readonly optional: boolean; readonly required: boolean;  // R14.3–14.4
  readonly choiceGroup?: string;                    // id shared by the alternatives (R14.5)
  readonly facets: readonly Facet[];                // R14.7, in declaration order, base type's first
  readonly default?: string; readonly fixed?: string;
  readonly wildcards: readonly { kind: 'any' | 'anyAttribute'; namespace?: string; processContents?: string; minOccurs?: string; maxOccurs?: string }[];
  readonly recursive: boolean;                      // R15.3
  readonly description?: string;                    // xsd:documentation
  readonly source: Located;                         // the declaration
  readonly use?: Located;                           // the ref site, when different
  readonly children: readonly FieldNode[];
}
```

## 6. Cabinet reader (R1–R4)

1. **Before reading:** check `inputBytes` (R4.3), then `MSCF` at offset 0 (R3.1).
2. **Header:** if flags `0x0001` or `0x0002` are set, throw `UNSUPPORTED_CAB` (R2.3). If flag `0x0004`
   is set, read `cbCFHeader`, `cbCFFolder` and `cbCFData` and skip those reserve areas (R2.4).
   If `cFiles > entries`, throw `LIMIT_EXCEEDED` before reading any CFFILE (R4.2).
3. **Folders:** read compression type `typeCompress & 0x000F`: 0 = none, 1 = MSZIP; 2 (Quantum) and
   3 (LZX) throw `UNSUPPORTED_COMPRESSION` with the method name and folder index; any other value
   throws with the number (R2.1–2.2). All folders are checked before any inflation. If the sum of
   the `cCFData` values is over `blocks`, throw `LIMIT_EXCEEDED` before any block header is read
   (R4.7).
4. **Files:** read all CFFILE entries. If the declared total size is over `uncompressedBytes`,
   throw `LIMIT_EXCEEDED` (R4.1). Names are decoded with `TextDecoder('utf-8')` if attribute `0x80`
   is set, else `TextDecoder('windows-1252')` (R1.4). `iFolder` must exist (R3.5).
5. **Block headers, all folders, before the first inflate** (added 2026-11-10, R3.7–R3.8):
   walk every CFDATA header of every folder with no inflation, bounds-checking each header and
   its data against the input (R3.2); the folder's range is `[coffCabStart, end of last block)`.
   Sort the non-empty folder ranges and the CFFILE area `[coffFiles, end of last CFFILE)` by start
   and sweep: a range that starts before the furthest end so far is `CORRUPT_CAB` with `offset`
   (its start) and `otherOffset` (the start of the range it runs into). Then, per block:
   `cbUncomp ≤ 32768` (R4.4), `cbUncomp ≠ 0` (R3.8), the running declared total against
   `uncompressedBytes` (R4.1), and for MSZIP the `CK` signature, for type 0 `cbData == cbUncomp`
   (R3.3). Every check that does not need inflated bytes is done here.
6. **Data blocks**, one folder at a time, `history` reset per folder (R1.2):
   - checksum: if `csum ≠ 0` and `checksum(data, then cbData‖cbUncomp) ≠ csum`, record
     `CHECKSUM_MISMATCH` with the offset and both values, but only after the block has inflated to
     the right length (R3.4). The algorithm matched all 59 in-repo checksums;
   - inflate (§6.1), append the output, keep the last 32,768 bytes of folder output as history;
   - the running total was checked in step 5 from the declared sizes, and each block's output
     equals its declared size (§6.1), so the actual total cannot pass `uncompressedBytes`.
7. **Slicing:** each CFFILE takes `[uoffFolderStart, +cbFile)` of its folder's output; if that range
   goes past the folder's end, throw `CORRUPT_CAB` (R3.5).

### 6.1 `inflateBlock(data, history, expected)`

```
input  = history.length ? concat(storedBlock(history), data) : data
stream = DecompressionStream('deflate-raw'); write input; close
read chunks; stop with CORRUPT_CAB if produced > history.length + expected
on reader error: if produced == history.length + expected → accept (D3), else CORRUPT_CAB
on end:          if produced != history.length + expected → CORRUPT_CAB
return output.subarray(history.length)
```

Type-0 folders copy `data` as is, and require `cbData == cbUncomp`.

## 7. XML layer (R4.5, R5)

### 7.1 Checks on `@xmldom/xmldom` 0.9.12 (2026-11-10)

| Question | Result | Consequence |
|---|---|---|
| Licence, dependencies | MIT, zero dependencies; `lib/` has no `fs`, `http` or `fetch` | Worker-safe; bundled with esbuild and run in a Chrome 157 dedicated Worker, where it parsed all 43 manifests |
| External entities, DTD | `SYSTEM "file:///etc/passwd"` and `SYSTEM "http://…"` entities: not fetched, not expanded; the reference stays as the literal text `&e;` and `onError('error', 'entity not found')` fires. External DTD and parameter entities: nothing fetched | Meets R5.1 alone; `prescan` still rejects DOCTYPE (R5.2) so no entity text reaches the result |
| Billion laughs | not expanded (same mechanism) | as above |
| Line and column | `lineNumber`/`columnNumber` on every element and attribute (`locator` is on by default); errors carry `{lineNumber, columnNumber}` in `onError`'s context and on the thrown `ParseError` | Meets R5.6 |
| Depth | no limit: 100,000 nested elements parse in 218 ms; 2 MB of unclosed tags take 724 ms before the error | `prescan` must enforce `xmlDepth` itself (R4.5); the depth hook (`__DOMHandler`) is internal, so we do not use it |
| Encoding | the parser takes a string and ignores the `encoding` declaration | `decode.ts` owns encodings (R5.3, D11) |
| In-repo files | 265 XML files under `samples/own/forms/`: 0 errors, 0 warnings | |

No replacement parser is needed.

### 7.2 Pipeline per document

1. `decode(bytes)`: a BOM selects UTF-8, UTF-16LE or UTF-16BE. Without one, the first four bytes
   `3C 00 3F 00` or `00 3C 00 3F` select UTF-16LE or UTF-16BE (XML 1.0 Appendix F); otherwise the
   bytes are ASCII-compatible and the XML declaration's `encoding` is read (default UTF-8). A BOM
   or byte pattern wins over the declaration, and a declared UTF-16 label on ASCII-compatible bytes
   is read as UTF-8 (those bytes cannot be UTF-16). The label goes to `new TextDecoder(label, { fatal:
   true })`. A `RangeError` (unknown label, or a `replacement` label) throws `INVALID_XML` with
   `encoding` set to the label. If the canonical `decoder.encoding` is in `REFUSED_ENCODINGS`,
   the same error is thrown (R5.3, D11). Decode with `fatal: true`; if that fails, decode again
   without it (U+FFFD for bad bytes) and record `INVALID_ENCODING` (non-fatal, so damaged files
   still open).
2. Charge `xmlBytes` (D7).
3. `prescan(text)`: one linear pass with states text / tag / quoted attribute / comment / CDATA / PI.
   `<!DOCTYPE` anywhere outside a comment or CDATA → `UNSAFE_XML` at its line and column (R5.2).
   Depth goes up on a start tag and down on an end tag or `/>`; depth > `xmlDepth` → `LIMIT_EXCEEDED`
   at that line (R4.5).
4. `parse(text)`: xmldom with `onError`. `fatalError` and `error` → `INVALID_XML` with line and
   column; `warning` → `XML_WARNING` issue.
5. Where it applies (R5.4): for `manifest.xsf`, errors from steps 1–4 are thrown. For any other
   file they become an issue with the same code, and that file is skipped.

`xml/node.ts` exposes only what xsf/ and xsd/ need: `localName`, `namespaceURI`, `attributes`
(excluding `xmlns` declarations), `children` (elements, non-whitespace text), `line`, `column`,
`outerXml()` (xmldom's `XMLSerializer`, which re-declares the namespaces in scope), and `path`.
Nothing outside `xml/` sees an xmldom type.

### 7.3 Paths

`path.ts` builds each step as `prefix:local[n]`, where `n` is the 1-based position among siblings
with the same namespace and local name. Prefixes are fixed (`xsf`, `xsf2`, `xsf3`, `xsd`); any
other namespace is written `{uri}local`, and no namespace is `local`. Attributes are written `/@name`
or `/@{uri}local`, and text is `/text()[n]`. The document's own prefixes are never used, so a path
does not change when the author renames a prefix.

## 8. Manifest: the vocabulary table (R7–R13, P12)

### 8.1 Table

`xsf/vocabulary.ts` declares, for every element R7–R12 model:

```ts
type AttrSpec = 'string' | 'yesNo' | { readonly enum: readonly string[] };
interface ElementSpec {
  readonly attrs: Readonly<Record<string, AttrSpec>>;  // key: local name, or '{uri}local' for qualified attributes
  readonly children: Readonly<Record<string, SpecKey>>; // child QName ('xsf:rule') → spec key
  readonly content: 'elements' | 'text' | 'rawXml';    // text: dialog/message text; rawXml: chooseFragment payload
  readonly req: string;                                 // requirement id, for review and the coverage test
}
export const XSF_VOCABULARY = {
  'xsf:rule': {
    attrs: { caption: 'string', condition: 'string', isEnabled: 'yesNo' },
    children: { 'xsf:assignmentAction': 'xsf:assignmentAction', /* … every action … */
                'xsf:submitAction': 'xsf:rule/submitAction', 'xsf:exitRuleSet': 'xsf:rule/exitRuleSet' },
    content: 'elements', req: 'R9.1',
  },
  'xsf:editWith': {
    attrs: { component: { enum: ['xCollection', 'xOptional', 'xReplace', 'xTextList', 'xField', 'xImage', 'xFileAttachment'] },
             type: { enum: ['plain', 'formatted', 'plainMultiline', 'formattedMultiline', 'rich'] },
             caption: 'string', proofing: 'yesNo', autoComplete: 'yesNo', /* … */
             '{http://schemas.microsoft.com/office/infopath/2003}autogeneration': 'string' },
    children: { 'xsf:fragmentToInsert': 'xsf:fragmentToInsert' }, content: 'elements', req: 'R8.3',
  },
  // …
} as const satisfies Record<string, ElementSpec>;
```

- **Keys are positions, not names.** A local element that MS-IPFF2 defines inside another element
  gets the key `parent/local` (`xsf:submit/errorMessage`, `xsf:errorCondition/errorMessage`,
  `xsf:unboundControls/button`, `xsf:listProperties/field`, `xsf:sharepointListAdapter/field`).
  Children are looked up through the parent's `children` map, so the same name in a different
  place is a different entry, or unknown.
- **Coverage:** every element and attribute in requirements Appendix A (forms 01–47 and the public
  sample), plus everything R7–R12 name (`xsf3:customValidation`, `errorBlank`,
  `documentSignatures`, `signedDataBlock`, `signedDataBlock/message`, `xsf3:signatureLines`,
  `roles`, `role`, `membership`, `scripts`, `script`, `xsf2:managedCode`, `permissions`,
  `allowedControl`, `printSettings`, `header`, `footer`, `toolbar`, `xsf2:mergedPrintView`,
  `xsf3:viewExtension`, every adapter in R11.3 and its children, `xsf2:connectoid` and the
  `*Extension` elements in R11.4, `listPropertiesExtension`, and so on). Forms 43–47 add, at
  these positions: `submit/errorMessage`, `submitToHostAdapter` (`name`, `submitAllowed`),
  `documentSignatures`, `signedDataBlock` (`name`, `data`, `signatureLocation`, `mode`),
  `signedDataBlock/message`, `xsf2:managedCode` (`language`, `version`, `projectPath`),
  `davAdapter` (`name`, `submitAllowed`, `overwriteAllowed`), `davAdapter/folderURL` (`value`),
  `davAdapter/fileName` (`value`, `valueType`), `scripts` (`language`, `enforceScriptTimeout`),
  `script` (`src`), `domEventHandler/@handlerObject` and `solutionProperties/@scriptLanguage`.
  Checked 2026-11-10 with the same script as forms 01–42: each is declared by MS-IPFF2 at that
  position, and the enumerated values in the five manifests (`mode="countersign"`,
  `valueType="expression"`, `overwriteAllowed`, `enforceScriptTimeout`, `submitAllowed`) are inside
  their lists. No sample markup needed fixing.
  MS-IPFF2 elements that R7–R12 do not name (e.g. `taskpane`, `featureRestrictions`,
  `externalViews`, `hwsWorkflow`, `autoRecovery`, `masterDetail`) are left out on purpose. They
  are reported as unknown with `documented: true` (R13.8).
- **Enumerations** are copied from `ms-ipff2.ts`: the attributes MS-IPFF2 types with an explicit
  `xsd:enumeration` list (about 40 across the three XSDs) or `xdYesNo` (about 95).
  A test fails if the table and the generated file disagree. `runtimeCompatibility` is a string:
  MS-IPFF2 types it as a single NMTOKEN pattern `[a-zA-Z0-9_]*`, but real forms (and form 43) write
  `"client server"`. Across the 43 manifests of forms 01–42 and the public sample, all 2,603
  enumerated attribute values are inside their lists (checked); forms 43–47 add none outside.
- **Extension points:** `xsf:extension` (MS-IPFF2 content `##any`) declares `xsf2:solutionDefinition`
  and `xsf3:solutionDefinition` as its children. Anything else inside it is unknown.

### 8.2 Walker (`walk.ts`)

```
walk(element, specKey):
  node = { key, path, line, column, attrs: {}, children: [], text?, raw? }
  for each attribute (namespace declarations skipped):
    name ∈ spec.attrs     → node.attrs[name] = value
                            if enum/yesNo and value ∉ list → unknown(attribute, unexpectedValue)   (R13.4)
    otherwise             → unknown(attribute, notModelled, documented = ms-ipff2 has it)         (R13.2)
  switch spec.content:
    rawXml   → node.raw = inner XML; stop (payload, R13.5)
    text     → node.text = text content verbatim; element children → unknown
    elements → for each child:
                 element: key = spec.children[qname(child)]
                          key ? node.children.push(walk(child, key))
                              : unknown(element, notModelled, documented)  — whole subtree, one entry (R13.1)
                 text (non-whitespace) → unknown(text)                                            (R13.3)
  comments and processing instructions are ignored (R13.5)
```

The root must be `xsf:xDocumentClass`. Any other root throws `INVALID_XML` ("not an InfoPath
manifest").

### 8.3 Builders (`build.ts`)

`build.ts` turns the `ModelNode` tree into the typed `Manifest`. It never touches the DOM.
- `attrs` are copied whole into each `Modelled<K>`, so every declared attribute that is present
  reaches the output.
- Children are read only through `take(node, key)`, which marks them as consumed. After the build,
  `assertAllConsumed(root)` throws an internal `AfterlifeError('INTERNAL')` if a modelled child was
  never taken by a builder. That means an element in the table was never built into the output. In
  production this cannot happen once the coverage test (§8.5) passes; the check stays on to catch
  regressions.
- `EventBinding`s come from each `xsf:ruleSetAction` and its parent key: `domEventHandler` →
  `fieldChange`, `onLoad`, `submit`, `unboundControls/button` (with the view's name) (R9.4).
- `containsCredential` is true when `/(^|;)\s*(password|pwd)\s*=/i` matches `connectionString` (R11.5).
- `codeFiles`: package files whose extension is `.dll`, `.pdb`, `.js` or `.vbs`, compared
  case-insensitively (R12.4).

### 8.4 What "modelled" means, and how the result shows it

A node is modelled exactly when the walker puts it into the `ModelNode` tree. Every builder output
keeps that node's `path`, and its `attrs` keys are the modelled attributes. A test can therefore
recover the modelled set from the result alone: collect every object with a `path`, and its
`attrs`. P12 and R13.6 use that, not the table.

### 8.5 How the table cannot drift from R7–R12, R13 and P12

| Check | Test |
|---|---|
| Every table entry is built into the output | `vocabulary.coverage.test.ts`: from the table alone, generate one "kitchen-sink" manifest that contains every spec key at a legal position, with every attribute set (the first enum value, `yes`, or `x`). Parse it. Assert that every generated element path and attribute appears in the result, and that `unknowns` is empty |
| The table only claims InfoPath names | `vocabulary.ms-ipff2.test.ts`: every key and attribute exists in `ms-ipff2.ts` at that position, and the enum lists are equal |
| Every requirement item is in the table | the same test checks a list of element names taken from R7–R12, kept in the test with the requirement ids, against the table's `req` fields |
| Real forms have nothing unknown | `unknowns.samples.test.ts`: zero unknown entries for every README row and the public sample (R13.6, R15.6) |
| Exactly once | `p12.property.test.ts` (§13.3) |

## 9. Schemas and the field tree (R14–R16)

### 9.1 Loading (`schema-set.ts`)

- Every `*.xsd` package file is parsed through `xml/` and walked against `xsd/vocabulary.ts`.
  Unmodelled XSD constructs become unknown entries (R15.4) with `documented` = "XML Schema 1.0
  defines this element or attribute". Modelled: `schema`, `import`, `include`, `element`,
  `attribute`, `complexType`, `simpleType`, `sequence`, `choice`, `all`, `any`, `anyAttribute`,
  `simpleContent`, `complexContent`, `extension`, `restriction`, the 12 facets, `group` and
  `attributeGroup` (global definitions and `ref`), `list` (`itemType` or an inline `simpleType`),
  `union` (`memberTypes` and inline `simpleType` members), `annotation`/`documentation` (kept as a
  node's description) and `appinfo` (raw). Not modelled, so unknown with `documented: true`
  (R15.4): `key`, `keyref`, `unique`, `redefine`, `notation`, and the attributes
  `substitutionGroup`, `abstract`, `block`, `final`. The unknown entry for an identity constraint
  covers its `selector` and `field` children.
- Globals are indexed by `{targetNamespace}name`, separately for elements, types, attributes,
  model groups and attribute groups. `include` and `import` resolve `schemaLocation` against package file names (case-insensitive,
  last path segment only). A URL or absolute path is never fetched; it records
  `UNRESOLVED_REFERENCE` (R15.2). `import` with no `schemaLocation` resolves by namespace when one
  loaded file declares that target namespace. A `ref` to a group or attribute group that is not
  indexed records `UNRESOLVED_REFERENCE`, like any other reference.
- The main schema is the file in `documentSchema[@rootSchema="yes"]/@location` (the last
  whitespace-separated token). The root is the `rootElement` file property of that file in
  `xsf:files`, else its first global element (R14.1). A secondary schema is `dataObject/@schema`,
  and its root is its first global element.

### 9.2 Building nodes (`field-tree.ts`)

- Walk from the root declaration. For a `ref`, record the ref site as `use` and the declaration as
  `source`. Named types are resolved through `extension` and `restriction`: children of the base
  come first, then the derived content. A model-group `ref` is expanded in place: its particle's
  children join the content model at that point, and the reference appears in each child's
  `raw.groups` as `{ kind: 'group', ref, minOccurs?, maxOccurs? }`. An attribute-group `ref` adds
  its attributes (and nested attribute-group references, in document order) and its
  `anyAttribute` to the element, as if declared there.
- **Effective cardinality** (R14.3): `minOccurs` and `maxOccurs` of the element, multiplied by those
  of every enclosing `sequence`, `choice`, `all` and group reference inside the same content model
  (`unbounded` absorbs). Alternation inside a `choice` is **not** turned into `minOccurs = 0`; the members get a
  shared `choiceGroup` instead (R14.5). Without this rule, form 05 would count 3 optional nodes
  where the README says 1 (`relocation`).
- **Kind** (R14.1), from the resolved content model only:

  | Content model of the element's type | Kind |
  |---|---|
  | a simple type (built-in, named or inline; atomic, list or union) | `field` |
  | complex type with `simpleContent` | `field` |
  | complex type, `mixed="true"`, containing an `xsd:any` whose namespace is `http://www.w3.org/1999/xhtml` | `richText` |
  | any other complex type: element children, element-only content made only of wildcards (form 45 `signatures2`), empty content, `xsd:anyType` | `group` |

  Attributes are always `field`. A rich-text `any` is not a child node (R14.6); every other `any`
  becomes an entry in `wildcards` with its `namespace`, `processContents`, `minOccurs` and
  `maxOccurs` as written.
- **Recursion:** keep a stack of declaration identities (element declarations, named types and
  model groups). A repeat is a leaf with `recursive: true` (R15.3).
- **Built-in type:** follow `restriction` and `extension` bases to an `xsd:` type. A `list` records
  its item type and a `union` its member types (R14.7), and `builtin` is `xsd:anySimpleType` for
  both. No type and no content means `xsd:anyType`.

### 9.3 `required` (`empty-string.ts`, R14.4)

`required = kind === 'field' && nodeType === 'element' && effective.minOccurs ≥ 1 && !effective.nillable && !acceptsEmpty(type)`.

Attributes stay out of `required`, as in the first design; `raw.use` keeps `use="required"` for
spec 02.

`acceptsEmpty(type)`:
1. Built-in families: `string`, `normalizedString`, `token`, `anyURI`, `base64Binary`, `hexBinary`
   and the built-in list types (`NMTOKENS`, `IDREFS`, `ENTITIES`) are true. Every other built-in is
   false.
2. `xsd:list` (R14.4): true, since a list of zero items is the empty string. `xsd:union`: true when
   `acceptsEmpty` is true for any member type.
3. A restriction can only narrow, whatever the variety: an `enumeration` makes it true iff `''` is
   listed; a `length` or `minLength` ≥ 1 makes it false (for a list, these count items, and the
   empty string has zero); a `pattern` is converted to a JS `RegExp` (`u` flag, anchored) and
   tested with `''`. If the pattern uses XSD-only syntax (`\i`, `\c`, character-class
   subtraction), the result is "unknown". `required` is then false and a `PATTERN_NOT_EVALUATED`
   issue records it. The facet itself is kept for spec 05.

Groups and rich text are never `required` (R14.4). Their presence is in `effective`.

### 9.4 Counts (`counts.ts`, R16.1)

| `TemplateCounts` | Computed as |
|---|---|
| `views` | `manifest.views.length` |
| `fields` | element nodes in `schemas.main` (root included, recursive leaves counted once) |
| `rules` | sum of `ruleSet.rules.length` |
| `calcs` | `manifest.calculations.length` |
| `checks` | `manifest.validations.length` |
| `repeatingOrOptional` | element nodes in `schemas.main` with `repeating \|\| optional` |

Spec 12 (Triage) uses `countTemplate` too, so the README oracle and the product share one
definition.

## 10. Package checks (`xsn/package.ts`, R6)

- Manifest discovery as R6.1. Duplicate names ignoring case, `..`, drive letters or leading `/`
  or `\` record `DUPLICATE_NAME` or `UNSAFE_NAME`; the bytes are kept (R6.5).
- References (R6.2) are collected from the built `Manifest`, not from the DOM. The list in R6.2 is
  one function, `fileReferences(manifest)`. Each reference is looked up case-insensitively, and a
  miss records `MISSING_FILE` with the reference's path (R6.3). `xmlFileAdapter/@fileUrl` counts
  only when it has no URL scheme and is not absolute.
- Files present but not in `xsf:files` record `UNLISTED_FILE` (R6.4). The manifest itself is exempt.
- `template.xml`: the first 4 KB are searched for `<?mso-infoPathSolution … name="…"`. A different
  `name` records `URN_MISMATCH` (R6.6, D8).

## 11. Error model

Fatal (`AfterlifeError`, thrown):

| Code | When | `details` |
|---|---|---|
| `UNSUPPORTED_COMPRESSION` | folder type 2, 3 or other | `method` (`LZX`, `Quantum` or the number), `folder` |
| `UNSUPPORTED_CAB` | multi-cabinet flags | `feature` (`prevCabinet`, `nextCabinet`) |
| `CORRUPT_CAB` | not `MSCF`, out-of-bounds read, missing `CK`, inflate failure or wrong length, bad folder index or range, `cbUncomp` > 32,768 or 0, overlapping folder ranges or a folder overlapping the CFFILE area | `offset`, `reason`, `otherOffset?` (overlaps only: the start of the other range) |
| `LIMIT_EXCEEDED` | any limit in §4 (an `xmlDepth` or `xmlBytes` overrun in a non-manifest file is an issue instead) | `limit`, `max`, `observed`, `file?` |
| `MISSING_MANIFEST` | no `.xsf`, or more than one without `manifest.xsf` | `names` (comma-joined) |
| `UNSAFE_XML` | DOCTYPE in the manifest | `file`, `line`, `column` |
| `INVALID_XML` | malformed manifest, unsupported encoding, root not `xDocumentClass` | `file`, `line`, `column`, `encoding?` |
| `INTERNAL` | a builder did not consume a modelled node (§8.3) | `path` |

Non-fatal (`Issue`, in `issues`): `CHECKSUM_MISMATCH`, `MISSING_FILE`, `UNLISTED_FILE`,
`DUPLICATE_NAME`, `UNSAFE_NAME`, `URN_MISMATCH`, `UNRESOLVED_REFERENCE`, `UNSAFE_XML`,
`INVALID_XML` and `LIMIT_EXCEEDED` (for non-manifest files), `INVALID_ENCODING`, `XML_WARNING`,
`PATTERN_NOT_EVALUATED`. The last three are new in this design.

`AfterlifeError extends Error`, with `readonly code` and `readonly details`; `message` is English
for logs. User-facing text is mapped in the UI (structure.md). Any other exception escaping
`parseXsn` is a bug, and P1 catches it.

## 12. Workspace and tools (versions checked on npm, 2026-11-10)

| Tool | Version | Notes |
|---|---|---|
| Node | 22.23.4 (latest 22.x, 2026-10-20) | `engines.node: ">=22.12 <23"` in the root; `.node-version`; CI pins it (R18). Vitest 5 needs `^22.12` |
| pnpm | 12.18.0 | `packageManager: "pnpm@12.18.0"`; `pnpm-workspace.yaml`: `packages/*`, `apps/*`. No Corepack: an installed pnpm reads `packageManager` and runs the pinned version itself. Checked 2026-11-10 in a scratch folder with that field: the global pnpm on this machine (`/usr/local/bin/pnpm`, **11.5.2**, not 11.11.0) printed `12.18.0` for `pnpm --version`, under Node 26.13 and Node 22.23.4. CI uses `pnpm/action-setup`, which reads the same field |
| TypeScript | 6.0.3 | D10. `tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` (absent ≠ undefined, R7.5), `verbatimModuleSyntax`, `isolatedModules`, `module: "preserve"`, `moduleResolution: "bundler"`, `target: "ES2023"`, `noEmit` (apps bundle core from source) |
| core `tsconfig.json` | | `lib: ["ES2023", "WebWorker"]`, `types: []`. A use of `DOMParser`, `document` or a Node module in `src/` is a type error (R17.1). `test/` has its own tsconfig with `@types/node` 22.20.5 |
| `@xmldom/xmldom` | 0.9.12, exact pin | the only runtime dependency |
| vitest | 5.1.0 | projects: `node` (unit, golden, property), `browser` (Worker parity), `perf` (separate script) |
| vite | 8.3.6, exact pin in the root | vitest 5's required peer (`^6.4.0 \|\| ^7.0.0 \|\| ^8.0.0`); pinned so the browser project's bundler does not float |
| `@vitest/browser-playwright` | 5.1.0 | with `playwright` 1.65.0, Chromium |
| fast-check | 4.10.2 | |
| eslint | 10.14.0 | flat config; `@eslint/js` 10.0.1, `typescript-eslint` 8.72.1 (`recommendedTypeChecked`), `eslint-config-prettier` 10.1.8. Not 8.72.2: it was published 2026-11-09 17:08 UTC and fails pnpm's `minimumReleaseAge` check, which we keep on with no exclusions; 8.72.1 (2026-10-26) has the same peer range `typescript >=4.8.4 <6.1.0` |
| prettier | 3.9.10 | `printWidth: 100`, `singleQuote: true` |
| esbuild | 0.28.2 | dev only, for the browser bundle check and the spike |

eslint rules for `packages/core/src/**`:
- `no-restricted-imports`: `node:*`, `fs`, `path`, `zlib`, `crypto`, and `@xmldom/xmldom` outside `src/xml/parse.ts`;
- `no-restricted-globals`: `fetch`, `XMLHttpRequest`, `DOMParser`, `document`, `window`, `process`, `Buffer`, `require` (R17.1, R17.4).

Scripts (root): `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test` (node project),
`pnpm test:browser`, `pnpm test:perf`, and `pnpm check`, which runs the first five in that order
and is the "full suite" in `tasks.md`. The Forge app keeps its own bundler's TypeScript (5.9.2,
pinned by `@forge/bundler` 7.3.2); core is plain TS that both compile.

Local runs use Node 22: `.node-version` holds `22.23.4`, and on this machine Node 22 is put first
on `PATH` (`/opt/homebrew/opt/node@22/bin`) because the default `node` is 26.13.

**tech.md edit (D1), made 2026-11-10:** the Deflate line now says to use
`DecompressionStream('deflate-raw')` in every runtime (a global in Node 22 and in Web Workers),
with `zlib` only in tests as an oracle.

## 13. Test plan

### 13.1 Fixtures and oracles

- **Cabinets:** `samples/own/xsn/*.xsn` and `samples/public/theill-weight-keeper/*.xsn`, read in
  place. Nothing is copied.
- **Unpacked oracle:** `samples/own/forms/<slug>/` (R1.6). The public sample's hashes live in
  `test/oracles/public-sample.ts` (requirements Appendix B).
- **README table** (`test/oracles/readme-table.ts`): read `samples/own/README.md`. Find the first
  Markdown table whose header contains `Folder`, and map columns **by header name**, so reordering
  is harmless. Require `Views`, `Fields`, `Rules`, `Calcs`, `Checks`, `Repeating/optional`, and
  read the slug from the backticks in `Folder`. Fail on a missing column, a non-integer cell, a
  duplicate slug, a row with no `xsn/<slug>.xsn`, or an `.xsn` with no row (R16.3). New rows
  (forms 43–47) are picked up with no test change.
- **Golden snapshots:** `packages/core/test/golden/<slug>.json`, one per README row plus
  `theill-weight-keeper.json`. A test helper writes them: bytes are replaced by
  `{ size, sha256 }`, keys are sorted, arrays keep document order. The Node project uses
  `toMatchFileSnapshot`. The browser project imports the same JSON files and compares with
  `toEqual`, and never writes them. A changed snapshot is a reviewed diff (`vitest -u`), never an
  automatic accept.
- **Synthetic fixtures:** `packages/core/test/fixtures/synthetic/` holds hand-written `.xsf` and
  `.xsd` files for roles, print settings, SharePoint list adapters (`sharepointListAdapter`,
  `sharepointListAdapterRW`), `allowedControl`, `xsd:include`, `xsf3` (`baseUrl`, `errorBlank`,
  `signatureLines`), recursion, a remote `schemaLocation`, an XSD-only pattern, the modelled XSD
  constructs (a model group with a global definition, a `ref` with `minOccurs="0"
  maxOccurs="unbounded"` and a self-reference; an attribute group nested in another; a `list` by
  `itemType` and inline, with `length`; a `union` by `memberTypes` and inline), one schema per
  construct that stays unknown (`key`, `keyref`, `unique`, `redefine`, `notation`,
  `substitutionGroup`, `abstract`, `block`, `final`), the XML attack set (billion laughs, external
  entity, external DTD, parameter entity, depth 257 and 100,000), and the encoding set: Cyrillic
  text in `windows-1251`, `windows-1252`, `iso-8859-1` and `shift_jis` (positive), an unknown
  label, `iso-2022-kr` (maps to `replacement`), and each label in `REFUSED_ENCODINGS` (negative).
  Encoded fixtures are written by a test helper from UTF-8 source strings, so the repo holds no
  binary encoding files.
- **WHATWG label list:** `test/fixtures/whatwg-encodings.json`, a copy of the Encoding Standard's
  `encodings.json` (CC BY 4.0, attributed in the file's sibling `README.md`), used by the label
  parity test.
- **Cabinet writer (test only):** `test/helpers/cab-writer.ts` builds cabinets from files with
  Node `zlib.deflateRawSync`. It can split blocks, set reserve or spanning flags, set any
  compression type and corrupt checksums. R2.5, R3 and R19.2 use it.

### 13.2 Requirement → test

| Req | Kind | Fixture | File (`packages/core/test/…`) |
|---|---|---|---|
| R1 | golden, unit | all cabinets vs `forms/`; public hashes; synthetic type-0 and Windows-1252 names | `cab/read.samples.test.ts`, `cab/read.unit.test.ts` |
| R1.2, D2 | spike, then unit | the 7 multi-block cabinets: output equals the zlib-dictionary oracle, in Node and in a Worker | `cab/inflate.spike.test.ts`, `browser/inflate.browser.test.ts` |
| R2 | unit | cab-writer: types 2, 3, 7; flags 1, 2, 4 | `cab/unsupported.test.ts` |
| R3 | unit | truncations at every structure boundary; bad `CK`; wrong length; bad folder index; flipped checksum → one `CHECKSUM_MISMATCH` and the same files | `cab/corrupt.test.ts` |
| R3.7, R3.8, R4.7 | unit | overlapping folders; folder over the CFFILE area; 4,097 declared blocks; zero-length block; crafted 2 MiB cabinets (several folders on one run of tiny blocks) fail in under 100 ms | `cab/hardening.test.ts` |
| R4 | unit | cab-writer: 2,001 entries; a declared 51 MiB; 20 MiB + 1 input; `cbUncomp` 32,769; deep XML; `xmlBytes` | `limits.test.ts` |
| R5 | unit, browser | XML attack set; encoding set; WHATWG labels accepted the same way in Node and the Worker | `xml/safety.test.ts`, `xml/decode.test.ts`, `browser/encodings.browser.test.ts` |
| R6 | unit | synthetic packages via `parsePackage` | `xsn/package.test.ts` |
| R7–R12 | golden, unit | README forms + public sample; synthetic fixtures for items with no sample | `golden.samples.test.ts`, `xsf/build.test.ts` |
| R13 | unit, coverage | kitchen-sink manifest; enum violation; text; comments and PIs ignored | `xsf/vocabulary.coverage.test.ts`, `xsf/unknowns.test.ts` |
| R13.6, R15.6 | golden | every README row + public sample: `unknowns` is empty | `unknowns.samples.test.ts` |
| R13.8, D6 | unit | vocabulary ⊆ MS-IPFF2; `documented` true and false cases | `xsf/vocabulary.ms-ipff2.test.ts` |
| R14 | unit | the R14.8 oracle cases (forms 01, 04, 05, 45, 47); synthetic kind, group-cardinality, list, union, facet and pattern cases | `xsd/field-tree.test.ts`, `xsd/empty-string.test.ts` |
| R15 | unit | form 04 imports; synthetic include, extension, recursion, remote location, group, attribute group, list, union, unknown constructs | `xsd/schema-set.test.ts`, `xsd/groups.test.ts` |
| R16 | golden | README table + public constants via `countTemplate` | `counts.samples.test.ts` |
| R17.1, R17.4 | static, runtime | eslint rules; core `tsconfig` lib; golden runs with `fetch` stubbed to throw | `pnpm lint`, `pnpm typecheck`, `golden.samples.test.ts` |
| R17.3 | browser | every cabinet parsed in a dedicated Worker, compared with the golden JSON | `browser/worker-parity.browser.test.ts` (+ `browser/parse.worker.ts`) |
| R18 | perf | 20 warm runs per cabinet; p95 under 300 ms; form 08 reported on its own | `perf/parse.perf.test.ts` |
| R19 (P1) | property | §13.3 | `property/p1.property.test.ts` |
| R20 (P12) | property | §13.3 | `property/p12.property.test.ts` |

### 13.3 Properties

- **P1** (R19): three fast-check generators. 1,000 runs each in CI. Each run is timed with
  `performance.now()` and must finish in 1 s.
  1. `fc.uint8Array({ maxLength: 2 MiB })`;
  2. mutations of a sample cabinet: bit flips, truncation, splices of two cabinets, and header
     fields overwritten with boundary values;
  3. valid cabinets (cab-writer) whose manifest or schema text has been mutated: dropped tags,
     random characters, duplicate attributes, deep nesting.

  Pass: the promise resolves, or rejects with an `AfterlifeError` whose `code` is in §11. Failing
  seeds are copied into `test/property/regressions.ts` and replayed every run.
- **P12** (R20): insert 1–20 random nodes into a random README manifest: elements with random local
  names in `xsf`, `xsf2`, `xsf3` or a random URI (prefixes declared on the root), sometimes a real
  vocabulary name in a wrong place, with random attributes and depth 0–3, and attributes added to
  random modelled elements. The oracle walks the mutated DOM with its own code, independent of the
  table:
  - an element is *modelled* if the result contains an object with its path (§8.4);
  - it is *unknown* if an `unknowns` entry with `reason: 'notModelled'` has its path or an ancestor's;
  - the same for attributes, through `attrs` keys and `/@` paths.

  Assert exactly one of the two for every element and non-`xmlns` attribute, and that each inserted
  unmodelled node has an entry whose path selects it. 500 runs.

## 14. Risks and how the first tasks retire them

| Risk | Retired by |
|---|---|
| The stored-block prefix behaves differently in Vitest's browser Worker than in the throwaway spike | Task 2 is the spike as tests: the 7 multi-block cabinets (of 48), Node and a Worker, against the zlib-dictionary oracle |
| `DecompressionStream` behaviour differs by version (D1, D3) | The acceptance rule depends only on byte counts; the spike runs on Node 22.23.4 in CI and on Chromium |
| `TextDecoder` label support differs between Node 22 and Chromium (D11) | Task 2 measures every WHATWG label in both and fixes `REFUSED_ENCODINGS`; `browser/encodings.browser.test.ts` keeps them in step |
| The Forge Node 22 runtime might not ship full ICU, so legacy labels would fail there [VERIFY: not checkable from this repo before spec 07] | R5.3 needs only Node 22 and the Worker; the label test is cheap to run in a Forge function when spec 07 deploys one |
| Forms 43–47 arrive with constructs not in the table | Checked 2026-11-10: zero vocabulary problems (§8.1). They are README rows, so `unknowns.samples.test.ts` and the count test still fail loudly on any later sample |
| MS-IPFF2 XSDs disagree with real files (`runtimeCompatibility` is the known case) | Enumerations come only from explicit `xsd:enumeration` and `xdYesNo`; patterns are not enforced |
| A file that is valid but large hits the 1 s P1 bound in CI | `xmlBytes` (D7); per-run timing reported; limits are options |
| The vocabulary table grows large and hard to review | One entry per element, each with its `req` id; the coverage and MS-IPFF2 tests do the mechanical checking |
| Groups and attribute groups get no in-repo fixture (none of the 54 schemas uses them) | Synthetic schemas in `xsd/groups.test.ts`; the field-tree code path for a group `ref` is the same as for a `sequence`, so the README forms exercise it too |
