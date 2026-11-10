# Requirements: 01 .xsn parser (CAB + manifest + schema)

Source brief: `docs/spec-briefs/01-xsn-parser.md`. Phase 1 of 3 (requirements → design → tasks).
Status: **approved 2026-11-10**, with the decisions listed at the end. Amended the same day at
design approval (decisions 10–16): field kind (R14), encodings (R5.3), XSD groups, attribute
groups, lists and unions (R14, R15), forms 43–47, and one inflater (R17.2).

## Introduction

This spec delivers the first stage of `packages/core`: given the bytes of one `.xsn`, return
1. every file in the cabinet, byte for byte;
2. a typed model of `manifest.xsf`;
3. a field tree for the main schema and for each secondary data source schema;
4. a list of **unknown entries**: every manifest or schema element and attribute the parser does
   not model, each with its path.

Spec 02 (FormIR) consumes this output. No other spec reads `manifest.xsf` or the `.xsd` files.
Anything this parser drops is gone for every later stage. That is why R13 and P12 exist: the
product promise is that the app does more than InfoPath, never less, and that is not possible
if a feature is skipped at this stage without anyone being told.

The parser runs in Node 22 and in a browser Web Worker, with no native tools and no CAB library.

Out of scope, and the spec that owns each item:
- writing or repacking `.xsn` files (none); LZX and Quantum decompression (none, rejected by R2);
- parsing view XSL: controls, `xd:binding`, conditional formatting, label text (spec 03; labels in spec 02 AC2);
- evaluating XPath in rules, calculations and validations (spec 04);
- FormIR ids, dependency index, endpoint `internal`/`dead` classification, InfoPath generation (spec 02);
- coverage states for each element, including unknown entries (spec 05);
- filled records, `upgrade.xsl` execution, record counts (spec 11, spec 12).

## Glossary

- **.xsn**: an InfoPath form template; a Microsoft Cabinet file (signature `MSCF`).
- **CFFOLDER / CFDATA / CFFILE**: cabinet structures for a compressed stream, one compressed block
  of it, and one file entry.
- **MSZIP**: cabinet compression type 1. Each CFDATA block is `CK` followed by raw deflate data. The
  deflate history continues from the previous block in the same folder.
- **Package file**: a file inside the cabinet (`manifest.xsf`, `myschema.xsd`, `view1.xsl`, …).
- **Manifest**: `manifest.xsf`, root `xsf:xDocumentClass`.
- **xsf / xsf2 / xsf3**: the manifest namespaces
  `http://schemas.microsoft.com/office/infopath/2003/solutionDefinition`,
  `…/2006/solutionDefinition/extensions` and `…/2009/solutionDefinition/extensions`, as specified
  in Microsoft's public [MS-IPFF2] sections 2.2.1–2.2.3.
- **Main schema**: the schema named by `xsf:documentSchema[@rootSchema="yes"]`, normally `myschema.xsd`.
- **Secondary schema**: a schema named by `xsf:dataObject/@schema` and the schemas it imports.
- **Field tree**: one node per element or attribute that a form instance can contain, built from a
  schema starting at its root element.
- **Field kind**: decided by the content model (R14.1). `field`: an attribute, or an element with a
  simple type or simple content. `richText`: an element with mixed content holding an `xsd:any`
  in the XHTML namespace. `group`: every other complex type, including content made only of
  wildcards and empty content.
- **Rule**: one `xsf:rule` inside an `xsf:ruleSet`. A rule set holds one or more rules.
- **Event binding**: the place that runs a rule set: `xsf:domEventHandler` (field change),
  `xsf:onLoad`, a button, or `xsf:submit`.
- **Data connection**: an adapter under `xsf:dataObject/xsf:query`, `xsf:submit` or `xsf:dataAdapters`.
- **Unknown entry**: `{ kind: element | attribute | text, reason: notModelled | unexpectedValue | repeated,
  file, path, namespace, name, line, raw, documented }` for a node the parser does not model.
- **Path**: an XPath to one node, using the prefixes `xsf`, `xsf2`, `xsf3`, `xsd` for the known
  namespaces and `{uri}local` for any other, with a 1-based position on every step, e.g.
  `/xsf:xDocumentClass[1]/xsf:views[1]/xsf:view[2]/@printView`.
- **Fatal error**: an `AfterlifeError` thrown when there is no usable result (container or manifest).
- **Issue**: a non-fatal finding returned with the result (missing file, unresolved reference, …).
- **Oracle**: the reference a test compares against.

## Evidence checked for this spec (2026-11-10)

Counted with Python over `samples/own/` (42 forms) and `samples/public/` (1 form) unless stated,
before forms 43–47 arrived. The checks of forms 43–47 follow in a second list.

- `bsdtar 3.5.3` (libarchive 3.7.4) extracted all 42 `samples/own/xsn/*.xsn`. The 265 files are
  SHA-256 identical to `samples/own/forms/<slug>/`, with the same file set per form. The public
  sample has no unpacked copy; its 6 hashes are in Appendix B.
- All 43 cabinets: version 1.3, header flags 0 (no reserve, no spanning), 1 folder, type MSZIP.
  Largest cabinet 19,513 bytes. 59 CFDATA blocks, all start with `CK`, all have non-zero
  checksums, none exceeds 32,768 uncompressed bytes, up to 9 blocks per folder. File attributes
  are `0x20` or `0xA0` (`0x80` = name is UTF-8). All names are ASCII with no path separators.
- In 7 of the 43 cabinets, 16 of the 59 blocks cannot be inflated without the previous block's
  output as history. All 43 inflate correctly when history is carried.
- Every package file is listed in `xsf:package/xsf:files`, and every listed file is present (43/43).
- No package file has a `<!DOCTYPE`. All declare UTF-8.
- `template.xml` `mso-infoPathSolution/@name` equals `xDocumentClass/@name` in 43/43.
- Manifest vocabulary: only `xsf` and `xsf2` occur (no `xsf3`). Appendix A lists every element and
  attribute found.
- Schemas: 49 `.xsd` files. `ref` everywhere; `xsd:import` 3 times (form 04's secondary schemas);
  `xsd:choice` once (form 05); `xsd:attribute` 6 times (secondary schemas only); `xsd:any` 15
  times, all XHTML rich text, matching the 15 `editWith type="rich"`. No `xsd:include`, no named
  `complexType` or `simpleType`, no facets.
- `DOMParser` is not available in Web Workers; the Compression Streams API is (MDN, "Functions and
  classes available to Web Workers", fetched 2026-11-10). Confirmed in Chrome 157: `typeof
  DOMParser` is `undefined` in a dedicated Worker.
- Element and attribute names in R7–R12 were checked against the XSDs published in MS-IPFF2
  sections 5.1 (xsf), 5.2 (xsf2) and 5.3 (xsf3), fetched 2026-11-10. All 43 in-repo manifests
  validate against that element/attribute vocabulary with no exceptions.
- The 59 non-zero CFDATA checksums all match the MS-CAB checksum algorithm (data bytes, then the
  4 bytes of `cbData` and `cbUncomp`).
- The rows in `samples/own/README.md` can grow. Requirements that use the README as their oracle
  apply to every row, not to a fixed count.

Forms 43–47 (commit `1917d34`; generated 2026-11-10, never opened in InfoPath), checked
2026-11-10 after they arrived:
- `bsdtar -xf` of each new `.xsn` is identical to its `forms/<slug>/` folder (6 files each, 7 for
  form 47). All 48 cabinets inflate with the stored-block prefix in Node 22.23.4 and Node 26.13,
  main thread and `worker_threads`, equal to the zlib-dictionary oracle. Still 7 multi-block
  cabinets, none of them new.
- Manifest vocabulary: every element and attribute in the five new manifests is declared by the
  MS-IPFF2 5.1–5.3 XSDs at its position, and every enumerated value is inside its list. The new
  names are in Appendix A. `xmllint` (libxml 2.9.13) validates all 48 manifests against the three
  XSDs with no content errors; the only errors are `xsd:keyref` checks (`views_default` and the
  `ruleSetAction` keyrefs), which fail the same way on the InfoPath-saved public sample and on
  forms 01–42, so they are a validator limitation, not sample errors.
- Schemas: 54 `.xsd` files in total. The new ones add a wildcard-only complex type (form 45
  `signatures2`, `xsd:any` in the XML-DSig namespace), a named `complexType`, and named
  `simpleType`s with `pattern`, `enumeration` and `maxLength` (form 47). No in-repo schema uses
  `group`, `attributeGroup`, `list`, `union`, identity constraints, `redefine`, `notation` or
  `substitutionGroup`; no element is untyped; no complex type has `simpleContent`.
- The README counts of rows 43–47 follow from the R16.1 rules (Views, Fields, Rules, Calcs,
  Checks). Repeating/optional for form 44 is 1 (`Person`), while form 44 has no `xsf:editWith`
  for it (see R16.1).
- Form 44's ActiveX control is in `view1.xsl` only (`object class="xdActiveX"`); its manifest has
  no `xsf:permissions`. `handlerObject` occurs in form 47, not form 46.

## Requirements

### R1. Read every file from an MSZIP cabinet
Traces: brief AC1.

As Mai (IT admin), I want to drop any `.xsn` and see the files inside it, so I can judge what a
form contains without Windows or InfoPath.

1. WHEN given a cabinet whose folders use MSZIP, THE SYSTEM SHALL return every CFFILE entry with
   its name, uncompressed size, date, time, attributes and bytes.
2. THE SYSTEM SHALL carry the deflate history across CFDATA blocks within one folder, and start
   fresh history for each folder.
3. THE SYSTEM SHALL also read folders with compression type 0 (none).
4. WHEN attribute bit `0x80` is set, THE SYSTEM SHALL decode the file name as UTF-8; otherwise as
   Windows-1252.
5. THE SYSTEM SHALL return files in CFFILE order.
6. Oracle: for each `samples/own/xsn/<slug>.xsn`, the returned file set and bytes equal
   `samples/own/forms/<slug>/`. For all 47 forms, that folder is byte-identical to
   `bsdtar -xf` output (forms 01–42 and 43–47 checked separately on 2026-11-10). For the public sample, the SHA-256 of each file equals
   Appendix B. CI SHALL NOT need `bsdtar`. The test SHALL fail if an `.xsn` has no `forms/` folder,
   or a `forms/` folder has no `.xsn`.

### R2. Reject cabinets the parser does not support
Traces: brief AC2; Added: spanned cabinets and reserve fields (MS-CAB format features with no
in-repo fixture).

As a developer, I want a typed error that names what is unsupported, so the UI can explain it.

1. IF a folder uses LZX (type 3) or Quantum (type 2), THEN THE SYSTEM SHALL fail with
   `UNSUPPORTED_COMPRESSION` and name the method and folder index.
2. IF a folder uses any other compression type, THEN THE SYSTEM SHALL fail with
   `UNSUPPORTED_COMPRESSION` and the numeric type.
3. IF the header says the cabinet is part of a multi-cabinet set (flags `0x0001` or `0x0002`),
   THEN THE SYSTEM SHALL fail with `UNSUPPORTED_CAB` naming the feature.
4. WHEN the header has reserve fields (flag `0x0004`), THE SYSTEM SHALL skip the header, folder
   and data reserve areas and read the cabinet normally.
5. Oracle: synthetic cabinets built in the test suite (headers only; no LZX encoder needed).

### R3. Fail on input that is not a valid cabinet
Traces: brief AC3; Added: checksum and size checks; R3.7–R3.8 added 2026-11-10 at the task 5
review (a crafted cabinet could point several folders at the same bytes and multiply the work
past P1's 1 s bound, R19).

As a developer, I want a typed error with a byte offset, so a broken upload can be diagnosed. As
Mai, I want a slightly damaged template to open anyway, because this product exists to rescue old
files.

1. IF the first four bytes are not `MSCF`, THEN THE SYSTEM SHALL fail with `CORRUPT_CAB` at offset 0.
2. IF any structure, block or file range lies outside the input, THEN THE SYSTEM SHALL fail with
   `CORRUPT_CAB` and the byte offset where the read was attempted.
3. IF an MSZIP block does not start with `CK`, does not inflate, or inflates to a length other than
   its `cbUncomp`, THEN THE SYSTEM SHALL fail with `CORRUPT_CAB` and the block's offset.
4. IF a CFDATA checksum is non-zero and does not match the block, AND the block still inflates to
   exactly `cbUncomp` bytes, THEN THE SYSTEM SHALL record a `CHECKSUM_MISMATCH` issue with the
   block's offset, the stored and the computed checksum, and continue. A block that fails to
   inflate or has the wrong length stays fatal under R3.3, whatever its checksum.
5. IF a CFFILE entry refers to a folder that does not exist, or its range lies outside the
   folder's uncompressed data, THEN THE SYSTEM SHALL fail with `CORRUPT_CAB`.
6. Oracle: truncations and byte flips of the in-repo cabinets (also exercised by P1). For R3.4, an
   in-repo cabinet with one checksum byte flipped: parses, returns the same files, and has exactly
   one `CHECKSUM_MISMATCH` issue.
7. IF the CFDATA ranges of two folders overlap, or a folder's CFDATA range overlaps the CFFILE
   area, THEN THE SYSTEM SHALL fail with `CORRUPT_CAB` naming both offsets (`offset`, the start
   of the later range, and `otherOffset`, the start of the range it runs into). A folder's range
   is known only by walking its block headers, so THE SYSTEM SHALL walk every block header of
   every folder, checking each against the input length, before the first block is inflated.
   Added (see Traces). Oracle: synthetic cabinets in `cab/hardening.test.ts`.
8. IF an MSZIP or stored block declares `cbUncomp` 0, THEN THE SYSTEM SHALL fail with
   `CORRUPT_CAB` at the block. In MS-CAB only the split blocks of multi-cabinet sets have it, and
   those are refused by R2.3. Added (see Traces).

### R4. Enforce resource limits
Traces: brief AC4; Added: input size, block size and XML depth limits (tech.md "Security rules");
R4.7 added 2026-11-10 at the task 5 review, with R3.7 (P1 bound).

As Mai, I want a hostile or broken file to stop quickly, so one bad file cannot freeze the batch.

1. IF the total declared or actual uncompressed size exceeds 50 MiB, THEN THE SYSTEM SHALL stop
   with `LIMIT_EXCEEDED` (limit `uncompressedBytes`) before inflating further.
2. IF the cabinet declares more than 2,000 files, THEN THE SYSTEM SHALL stop with
   `LIMIT_EXCEEDED` (limit `entries`) before reading them.
3. IF the input is larger than 20 MiB, THEN THE SYSTEM SHALL stop with `LIMIT_EXCEEDED` (limit
   `inputBytes`) before parsing. The largest in-repo cabinet is 19.5 KB.
4. IF a CFDATA block declares more than 32,768 uncompressed bytes, THEN THE SYSTEM SHALL fail with
   `CORRUPT_CAB` (the MSZIP maximum).
5. IF an XML document nests deeper than 256 elements, THEN THE SYSTEM SHALL stop parsing it with
   `LIMIT_EXCEEDED` (limit `xmlDepth`). The check SHALL run before the document is built, because
   the XML parser has no depth limit of its own.
6. THE SYSTEM SHALL accept every limit as an option with these values as defaults, and report the
   limit name, the limit and the observed value in the error. Sizes are binary: 1 MiB is
   1,048,576 bytes.
7. IF the folders declare more than 4,096 CFDATA blocks in total (the sum of the CFFOLDER
   `cCFData` values), THEN THE SYSTEM SHALL stop with `LIMIT_EXCEEDED` (limit `blocks`) before any
   block header is read. 50 MiB at 32 KiB per block is 1,600 blocks, so 4,096 leaves room for
   writers that use smaller blocks; the in-repo cabinets have at most 9 blocks per folder.
   Added (see Traces).

### R5. Parse XML safely
Traces: brief AC7; Added: DOCTYPE rejection, encodings, Worker-safe parser.

As Mai, I want uploaded templates treated as hostile input, so a crafted file cannot read local
files or exhaust memory.

1. THE SYSTEM SHALL NOT load DTDs, resolve external entities or fetch any URL while parsing XML.
2. IF a package file contains a document type declaration, THEN THE SYSTEM SHALL refuse that
   document with `UNSAFE_XML` without expanding any entity. No in-repo file has one.
3. THE SYSTEM SHALL detect UTF-8 and UTF-16 by byte-order mark, or by the first bytes of the XML
   declaration when there is no BOM, and otherwise read the declared `encoding`. WHEN the declared
   label is one that `TextDecoder` accepts (WHATWG Encoding Standard), THE SYSTEM SHALL decode the
   document with it. IF the label is unknown to `TextDecoder`, or maps to the `replacement`
   encoding, THEN THE SYSTEM SHALL refuse the document with `INVALID_XML` naming the label.
   Decoding is not a safety risk; old schemas imported from other systems use `windows-1252`,
   `iso-8859-1`, `shift_jis` or `windows-1251`. WHERE a label is accepted by `TextDecoder` in
   only one of Node 22 and the Web Worker, THE SYSTEM SHALL refuse it in both with `INVALID_XML`,
   so both runtimes give the same result (R17.3). That list is measured in the first tasks and
   fixed in core.
4. IF the manifest is refused or malformed, THEN THE SYSTEM SHALL fail with that error and the
   line and column. IF any other XML file is, THEN THE SYSTEM SHALL record an issue for that file
   and continue.
5. THE SYSTEM SHALL use `@xmldom/xmldom` in both Node and the Web Worker, behind one core
   abstraction. No other module in core imports the parser directly.
6. THE SYSTEM SHALL report the line and column of every parse error and keep them on every
   element it extracts.
7. Oracle: unit fixtures for billion laughs, an external entity (`file:///etc/passwd`), an
   external DTD, a parameter entity, and deep nesting (257 levels, and 100,000). Encodings:
   `windows-1251` with Cyrillic text, `windows-1252`, `iso-8859-1` and `shift_jis` decode to the
   expected strings (positive cases); an unknown label and a label that maps to `replacement`
   (`iso-2022-kr`) are refused. Measured 2026-11-10: Node 22.23.4 rejects `iso-8859-16` and
   `x-user-defined`, which Node 26.13 accepts; Chromium is checked in the spike task.

### R6. Find the manifest and check package references
Traces: Added. The brief assumes `manifest.xsf` exists and its references resolve; the
coverage promise needs a broken reference reported, not skipped.

As Mai, I want to know when a template points at files it does not contain, so I see damage before
migrating.

1. THE SYSTEM SHALL use the package file named `manifest.xsf` (case-insensitive). IF there is none,
   THEN it SHALL use the only `*.xsf` file. IF there is no `.xsf` or more than one, THEN it SHALL
   fail with `MISSING_MANIFEST` and list the file names.
2. THE SYSTEM SHALL resolve every package file reference in the manifest case-insensitively. The
   references are: `xsf:file/@name`, `mainpane/@transform`, `useTransform/@transform`,
   `initialXmlDocument/@href`, `documentSchema/@location`, `dataObject/@schema`,
   `xmlFileAdapter/@fileUrl` (when relative), `operation/xsf:input/@source`, script and code file names.
3. IF a referenced file is absent, THEN THE SYSTEM SHALL record a `MISSING_FILE` issue with the
   reference's path.
4. IF a package file is not listed in `xsf:files`, THEN THE SYSTEM SHALL record an `UNLISTED_FILE`
   issue. In-repo: 0 of 43 forms.
5. IF two entries have the same name ignoring case, or a name contains `..`, a drive letter or a
   leading separator, THEN THE SYSTEM SHALL keep the bytes and record an issue.
6. WHEN `template.xml` carries `mso-infoPathSolution`, THE SYSTEM SHALL record an issue if its `name`
   differs from `xDocumentClass/@name` (InfoPath rejects that; infopath-domain.md). In-repo: 0 of 43.

### R7. Form identity, versions and runtime settings
Traces: brief AC5 (`publishUrl`, `solutionVersion`, `productVersion`, `trustLevel`); Added: the
items marked + below.

As Quang (head of IT), I want each form's identity and target runtime, so the Triage can match
records and say what killed the form.

1. THE SYSTEM SHALL extract from `xsf:xDocumentClass`: `publishUrl`, `solutionVersion`,
   `productVersion`, `trustLevel`; + `name` (the URN that records use, spec 11),
   + `solutionFormatVersion` (input to InfoPath generation, spec 02), + `trustSetting`,
   + `requireFullTrust`.
2. + THE SYSTEM SHALL extract `xsf2:solutionDefinition/@runtimeCompatibility` and
   `@allowClientOnlyCode`, and the attributes of `xsf2:server` (`formLocale`, `isMobileEnabled`,
   `isPreSubmitPostBackEnabled`) and `xsf2:offline` (`openIfQueryFails`, `cacheQueries`).
   `runtimeCompatibility` containing `server` is the evidence for the death-certificate cause
   `forms-services-spo` (spec 12). In-repo fixture: form 43 (`"client server"`).
3. + THE SYSTEM SHALL extract `xsf:documentVersionUpgrade/xsf:useTransform` (`transform`,
   `minVersionToUpgrade`, `maxVersionToUpgrade`) for spec 11.
4. + THE SYSTEM SHALL extract `xsf:fileNew/xsf:initialXmlDocument` (`href`, `caption`),
   `xsf:documentSchemas`, `xsf:package/xsf:files` with each file's `fileProperties`
   (including `rootElement` and `namespace`), `xsf:importParameters`, and
   `xsf:applicationParameters/xsf:solutionProperties`.
5. THE SYSTEM SHALL keep every attribute value as the original string; absent attributes are
   absent, not defaulted.
6. Oracle: own forms carry `trustSetting="automatic"` and no `trustLevel`; the public sample has
   `trustLevel="restricted"`, `productVersion="11.0.6357"`, `solutionFormatVersion="1.100.0.0"`.

### R8. Views and editing controls
Traces: brief AC5 (views and their XSL files, `fragmentToInsert`); Added: default view, print
settings, `xmlToEdit`/`editWith`, buttons (coverage F; the README "Repeating" oracle, R16).

As Tim (form owner), I want every view and every editable area listed, so nothing on screen is lost.

1. THE SYSTEM SHALL extract each `xsf:view` in document order: `name`, `caption`, `printView`, its
   `mainpane/@transform`, and whether it is `xsf:views/@default`.
2. THE SYSTEM SHALL extract `xsf:printSettings`, `xsf:header` and `xsf:footer` of each view, and
   `xsf2:viewExtension`, `xsf2:mergedPrintView` and `xsf3:viewExtension` linked to the view by `ref`.
3. THE SYSTEM SHALL extract each `xsf:xmlToEdit` (`name`, `item`, `container`) with its
   `xsf:editWith` (`component`, `type`, `caption`, other attributes) and the
   `xsf:fragmentToInsert/xsf:chooseFragment` content as raw XML with `innerFragment`.
4. THE SYSTEM SHALL extract `xsf:menuArea` and `xsf:toolbar` buttons (`action`, `xmlToEdit`,
   `caption`, `showIf`) and `xsf:unboundControls/xsf:button` with the rule set it runs.
5. Oracle: form 05 has 3 views with 3 `switchViewAction` buttons. Across forms 01–42: 18
   `xCollection`, 1 `xOptional`, 2 `xReplace`, 15 `type="rich"`, 21 `fragmentToInsert`.

### R9. Rules, actions and event bindings
Traces: brief AC5 (rule sets, rules and actions: assignment, dialog, switchView, query, submit,
openNew, close; `domEventHandlers`); Added: the items marked +.

As Tim, I want every rule with its trigger, so I can see what used to happen and when.

1. THE SYSTEM SHALL extract each `xsf:ruleSet` (`name`) and each `xsf:rule` in it, in document
   order, with `caption`, `condition` and `isEnabled`.
2. THE SYSTEM SHALL extract each action in order with all its attributes and text:
   `assignmentAction`, `dialogBoxMessageAction`, `dialogBoxExpressionAction`, `switchViewAction`,
   `queryAction`, `submitAction`, `openNewDocumentAction`, `closeDocumentAction`;
   + `changeAdapterProperty`, `webPartConnectionAction`, `signSignatureLineAction` (MS-IPFF2
   2.2.1.2.114).
3. + THE SYSTEM SHALL record `xsf:exitRuleSet` as the rule's "stop processing remaining rules" flag.
   MS-IPFF2 2.2.1.2.114 defines only `caption`, `condition` and `isEnabled` on `xsf:rule`, and an
   optional empty `exitRuleSet` child after the actions.
4. + THE SYSTEM SHALL extract every `xsf:ruleSetAction` with its parent as the event binding:
   `domEventHandler/@match`, `onLoad`, a view or unbound button, or `submit`.
   `ruleSetAction` is the most frequent action in the corpus (37; feature-coverage C) and is not
   in the brief.
5. THE SYSTEM SHALL extract `xsf:domEventHandler` attributes (`match`, `handlerObject`,
   `dataObject`) whether it binds a rule set or code.
6. Oracle: 9 rules in 8 rule sets in 5 forms; 7 assignment, 3 switchView, 1 query,
   1 dialogBoxExpression, 8 ruleSetAction (2 `onLoad`, 1 `domEventHandler`, 5 buttons).

### R10. Calculations and validation
Traces: brief AC5 (`calculatedFields`, `errorConditions`); Added: + items (coverage E).

As Lan (form filler), I want every check and its exact message kept, so the converted form stops
me in the same places with the same words.

1. THE SYSTEM SHALL extract each `xsf:calculatedField` (`target`, `expression`, `refresh`).
2. THE SYSTEM SHALL extract each `xsf:customValidation/xsf:errorCondition` (`match`,
   `expressionContext`, `expression`) with its `xsf:errorMessage` (`type`, `shortMessage`, text).
3. THE SYSTEM SHALL keep message text and `shortMessage` verbatim, including whitespace and case
   (corpus-facts.md: "keep it verbatim and never rewrite it").
4. + THE SYSTEM SHALL extract `xsf3:customValidation/xsf3:errorBlank` (MS-IPFF2 2.2.3.2.18) and
   `xsf:schemaErrorMessages`. No in-repo fixture.
5. Oracle: 19 calculated fields in own forms plus 1 in the public sample; 38 error conditions,
   all in own forms; per-form counts in R16.

### R11. Data connections and submit
Traces: brief AC5 (`dataObjects` with adapter types and URLs, submit configuration); Added: +
items (coverage G; infopath-domain.md adapter list).

As Mai, I want every connection with its endpoint, so I can see which ones point at servers that
no longer exist.

1. THE SYSTEM SHALL extract each `xsf:dataObject` (`name`, `schema`, `initOnLoad`) and its
   `xsf:query` adapter.
2. THE SYSTEM SHALL extract `xsf:submit` (`caption`, `onAfterSubmit`, `showStatusDialog`,
   `disableMenuItem`), its adapter or handler, its rule set, and its `successMessage` and
   `errorMessage`; + `xsf:dataAdapters` (submit connections outside `xsf:submit`).
3. THE SYSTEM SHALL record for every adapter its kind, `name`, `queryAllowed`, `submitAllowed` and
   every endpoint attribute as written. Kinds: `xmlFileAdapter`, `adoAdapter`,
   `webServiceAdapter` (with `operation`, `input`), `sharepointListAdapter`,
   `sharepointListAdapterRW`, `davAdapter` (with `folderURL`, `fileName`), `emailAdapter` (with
   `to`, `cc`, `bcc`, `subject`, `intro`, `attachmentFileName`), `submitToHostAdapter`,
   `bdcAdapter`, `hwsAdapter`, `useHttpHandler`, `useScriptHandler`,
   `useQueryAdapter`. All are in the `xsf` namespace. `grooveAdapter` is not modelled: MS-IPFF2 5.1
   declares it as a global element but places it under no element, so a file that has it gets an
   unknown entry. Its `documented` is `false`, because R13.8 asks whether MS-IPFF2 defines the
   element at that position, and it defines it at none. The spelling `sharepointListAdapterRW` is The spelling `sharepointListAdapterRW` is
   the one in the MS-IPFF2 5.1 XSD; the element index in 2.2.1 writes `sharePointListAdapterRW`.
   Any other spelling becomes an unknown entry (R13).
4. + THE SYSTEM SHALL extract `xsf2:dataConnections` children and link each to its adapter by `ref`,
   including `xsf2:connectoid` (a reference to an external `.udcx` connection file).
5. + WHEN an `adoAdapter/@connectionString` contains `Password=` or `Pwd=`, THE SYSTEM SHALL set a
   `containsCredential` flag on that adapter. The value is still returned; display layers mask it.
6. + THE SYSTEM SHALL build a field tree (R14) for each secondary schema, keyed by data object name.
7. Oracle: form 04 has `adoAdapter` (`Data Source=sql-legacy01`) and `webServiceAdapter`
   (`http://forms-legacy/budget/…`); form 03 has `xmlFileAdapter fileUrl="locations.xml"`; forms
   01, 02 and 07 submit through `emailAdapter`; form 44 has a `submitToHostAdapter` and form 46 a
   `davAdapter`. The SharePoint list adapters have synthetic fixtures only.

### R12. Promoted fields, signatures, roles, ActiveX and code
Traces: brief AC5 (`listProperties`, `signedDataBlocks`, code-behind file names); Added: roles,
scripts and ActiveX permissions (coverage H; brief 12 causes `activex`, `code-behind`, `signatures`).

As the auditor, I want signatures, roles and code listed, so I know which parts need a manual
decision.

1. THE SYSTEM SHALL extract `xsf:listProperties/xsf:fields/xsf:field` (`name`, `columnName`,
   `node`, `type`, `aggregation`, `maxLength`, `required`, `viewable`) and
   `xsf2:listPropertiesExtension`.
2. THE SYSTEM SHALL extract `xsf:documentSignatures` (`signatureLocation`) and each
   `xsf:signedDataBlock` (`name`, `data`, `signatureLocation`, `mode`, and its `message` text), and
   `xsf3:signatureLines`. `mode` is `single`, `cosign` or `countersign` (MS-IPFF2 5.1,
   `xdSignatureRelationEnum`).
3. + THE SYSTEM SHALL extract `xsf:roles` (`default`, `initiator`, each `xsf:role` and each
   `xsf:membership` entry).
4. THE SYSTEM SHALL extract code references: `xsf2:managedCode` (`language`, `version`,
   `projectPath`, `enabled`), `xsf:scripts` (`language`, `enforceScriptTimeout`) with each
   `xsf:script/@src`, and `domEventHandler/@handlerObject`. MS-IPFF2 gives `managedCode` no
   attribute for the assembly name, so THE SYSTEM SHALL list package files named `*.dll`,
   `*.pdb`, `*.js` or `*.vbs` as code files, whether or not the manifest refers to them.
5. + THE SYSTEM SHALL extract `xsf:permissions/xsf:allowedControl` (`clsid`, `cabFile`,
   `version`), the manifest's record of ActiveX controls. Controls placed in a view are found in
   the view XSL (spec 03).
6. Oracle: the public sample has 1 promoted field (`Date`). Form 45 (countersigned
   `signedDataBlock` with a `message`), form 46 (`managedCode`, C#, no assembly in the package) and
   form 47 (JScript `xsf:scripts`, `script.js`, two `domEventHandler`s with `handlerObject`) are
   the in-repo fixtures. Form 44's ActiveX control is placed in `view1.xsl` and its manifest has no
   `xsf:permissions`, so `allowedControl` (R12.5) and roles have synthetic fixtures only.

### R13. Report unknown manifest content instead of dropping it
Traces: Added (the user's requirement and the product principle "Never lose a feature silently");
R13.9 added 2026-11-10 at the task 14 review (a repeated element is well-formed XML, so R5.4 does
not make it fatal; old and hand-edited files must still open).

As Tim, I want every part of my template that the app does not understand to be named, so nothing
disappears between InfoPath and Jira without someone seeing it.

An element is **modelled** when the parser's vocabulary declares it at that position and the
result carries it as a typed object with its path and line. An attribute is modelled when the
vocabulary declares it for that element and its value appears in that object. Everything else is
unknown.

1. THE SYSTEM SHALL report as an unknown entry every element in the manifest that R7–R12 do not
   model, with its path, namespace, local name, line and outer XML. Its descendants are part of that
   one entry, not separate entries.
2. THE SYSTEM SHALL report as an unknown entry every attribute of a modelled element that R7–R12 do
   not model, with its path and value. Namespace declarations are not attributes for this purpose.
3. THE SYSTEM SHALL report non-whitespace text inside a modelled element that has no text content
   in the model as an unknown entry of kind `text`.
4. WHEN an attribute that MS-IPFF2 defines as an enumeration (an `xsd:enumeration` list or
   `xdYesNo`) has a value outside it (for example `editWith/@component="xFoo"`), THE SYSTEM SHALL
   keep the value and also report it as an unknown entry of kind `attribute` with reason
   `unexpectedValue`. Attributes typed only by a pattern, such as `runtimeCompatibility`, are not
   enumerations.
5. THE SYSTEM SHALL NOT report comments, processing instructions or whitespace-only text.
   Payload content (`fragmentToInsert` XML, message text) is modelled as raw XML, not unknown.
6. WHEN the manifest belongs to any form listed in the `samples/own/README.md` table, or to the
   public sample, THE SYSTEM SHALL report zero unknown entries. Appendix A lists what forms 01–47
   use. IF a new sample produces unknown entries, THEN the fix is to model those nodes (when
   MS-IPFF2 defines them) or to correct the sample (when it does not). An allow-list that hides
   them is not a fix.
7. THE SYSTEM SHALL return unknown entries in document order with the rest of the result.
   Specs 02 and 05 carry them forward and give each one a coverage state.
8. + THE SYSTEM SHALL mark each unknown entry `documented: true` when MS-IPFF2 (sections 5.1–5.3)
   defines that element or attribute in that position, and `documented: false` otherwise. Spec 05
   then knows "an InfoPath feature we do not handle" from "not InfoPath at all".
9. WHEN an element occurs more often than MS-IPFF2 allows at its position (a second `xsf:fileNew`,
   a second adapter in one `xsf:dataObject/xsf:query`, whose `xsd:choice` allows one member), or
   more often than the parser models it (a second `xsf2:solutionDefinition` or
   `xsf3:solutionDefinition` across all `xsf:extension` elements), THE SYSTEM SHALL model the
   first occurrence in document order, report each later occurrence as one unknown entry of kind
   `element` with reason `repeated` and `documented: true` for its whole subtree, and record a
   `REPEATED_ELEMENT` issue naming the element, the parent path and the number allowed (1). The
   template SHALL still parse. Added (see Traces).

### R14. Build the field tree
Traces: brief AC6, with the corrected "required" rule (4), now also in the brief; Added: raw
cardinality, optional, choice, attribute and rich-text nodes; kind from the content model, groups,
lists and unions (design approval, 2026-11-10).

As Tim, I want every field with its type and cardinality, so the converter maps each one to the
right Jira field.

1. THE SYSTEM SHALL build a tree from the root element named by the manifest (`rootElement` file
   property, else the first global element of the main schema). Each node SHALL have name,
   namespace, kind (`group`, `field`, `richText`), node type (element or attribute), XSD type
   (built-in QName or the resolved base type), default and fixed values, and its source (file and
   line). THE SYSTEM SHALL decide the kind from the content model only:
   - `field`: an attribute, or an element whose type is a simple type or has simple content;
   - `richText`: an element with mixed content holding an `xsd:any` in the XHTML namespace;
   - `group`: an element of any other complex type, including element-only content made only of
     wildcards, and empty content.
2. THE SYSTEM SHALL keep `minOccurs`, `maxOccurs` and `nillable` on every node twice: raw (the
   attribute strings exactly as written on the declaration and on the `ref`, absent when absent)
   and effective (numbers and a boolean after applying XSD defaults and the enclosing particle).
   Nothing derived in 3–5 replaces the raw values.
3. THE SYSTEM SHALL set `repeating` when the effective `maxOccurs` is greater than 1 or
   `unbounded`, and `optional` when the effective `minOccurs` is 0. Effective cardinality combines
   the element with its enclosing `sequence`, `choice` and `all`, and with every `xsd:group`
   reference on the way, whose `minOccurs` and `maxOccurs` multiply like those of a `sequence`.
4. THE SYSTEM SHALL set `required` only on a node of kind `field` that is present by schema
   (effective `minOccurs` ≥ 1, not nillable) **and** whose type does not accept the empty string.
   `group` and `richText` nodes are never `required`. A rule of "minOccurs ≥ 1 and not nillable"
   alone would mark every text field required: in form 01, `reason` is a non-nillable
   `xsd:string`, empty in `template.xml`, has no error condition, and the record opens in
   InfoPath. Types that accept the empty string: `string` and types derived from it without a
   `minLength` ≥ 1 or a pattern that rejects it, `anyURI`, `base64Binary`, `hexBinary`, every
   `xsd:list` type (a list of zero items), and an `xsd:union` when any member type does. Facets on
   a list or union restrict that result as they do for any other type. "Cannot be blank" checks
   written as validations are spec 02's job (R10 gives it the raw data).
5. THE SYSTEM SHALL mark the members of an `xsd:choice` as alternatives of one choice group.
6. THE SYSTEM SHALL represent `xsd:any` with XHTML namespace in mixed content as kind `richText`
   and SHALL NOT count it as a separate node. Other `xsd:any` and `xsd:anyAttribute` SHALL be
   recorded as wildcards on the parent, with their `namespace` and `processContents`.
7. + THE SYSTEM SHALL record simple-type facets (`enumeration`, `pattern`, `length`, `minLength`,
   `maxLength`, `minInclusive`, `maxInclusive`, `minExclusive`, `maxExclusive`, `totalDigits`,
   `fractionDigits`, `whiteSpace`) for the converter (feature-coverage E, spec 05), including
   facets on `list` and `union` types, and record the variety (`atomic`, `list` with its item type,
   `union` with its member types). In-repo fixture: form 47.
8. Oracle: form 01 `reason` → `required: false`; `daysRequested` (nillable integer) → `required:
   false`; form 04 `needsAccounting` (non-nillable boolean) → `required: true`; form 04 `line` →
   `repeating: true`, raw `minOccurs "0"`, raw `maxOccurs "unbounded"`; form 05 `relocation` →
   `optional: true`, `fullTime`/`contractor` → one choice group; form 05 `welcomeNote` →
   `richText`; form 45 `signatures1` → `group`, `required: false`; form 45 `signatures2` →
   `group`, `required: false`, no child nodes, one `any` wildcard with namespace
   `http://www.w3.org/2000/09/xmldsig#` and `processContents="lax"`; form 47 `assetTag`
   (`pattern` `[A-Z]{3}-[0-9]{4}`) → `required: true`; `assetCondition` (`enumeration` New, Good,
   Worn and `maxLength` 10) → `required: true`; `borrower` (named `complexType` `personType`) →
   `group` with `borrowerName` and `borrowerEmail`. Synthetic schemas cover a group reference with
   `maxOccurs="unbounded"`, an attribute group, a list and a union.

### R15. Resolve schema references and report unknown schema content
Traces: brief AC6 (`include`, `import`, `ref`, named complex types); Added: cycles, unresolved
references, unknown constructs; groups, attribute groups, lists and unions (design approval,
2026-11-10).

As a developer, I want schema references resolved inside the package, so the tree is complete
without network access.

1. THE SYSTEM SHALL resolve `ref`, `type` (named `complexType` and `simpleType`, including
   `extension` and `restriction` of them), `xsd:group` and `xsd:attributeGroup` (global
   definitions and `ref`, resolved like named types), the `itemType` of an `xsd:list` and the
   `memberTypes` and inline members of an `xsd:union`, `xsd:include` and `xsd:import` across the
   package's `.xsd` files by target namespace and `schemaLocation`. An attribute group adds its
   attributes and `anyAttribute` to the element that references it.
2. THE SYSTEM SHALL NOT fetch a `schemaLocation` that is a URL or an absolute path. IF a reference
   cannot be resolved inside the package, THEN THE SYSTEM SHALL record an `UNRESOLVED_REFERENCE`
   issue and keep the node with its declared name.
3. IF an element's content refers back to an ancestor, THEN THE SYSTEM SHALL stop expanding at the
   repeat, mark the node `recursive` and continue. A group that refers back to itself is cut the
   same way.
4. THE SYSTEM SHALL model `xsd:group`, `xsd:attributeGroup`, `xsd:list` and `xsd:union` (forms
   built from existing web-service, line-of-business and government schemas use them, and an
   unmodelled group would mean fields missing from the tree). THE SYSTEM SHALL report every other
   schema element and attribute it does not model as an unknown entry with path, as in R13, with
   `documented: true` when XML Schema 1.0 defines it at that position. Unknown with
   `documented: true`: `xsd:key`, `xsd:keyref`, `xsd:unique`, `xsd:redefine`, `xsd:notation`, and
   the attributes `substitutionGroup`, `abstract`, `block` and `final`.
   `xsd:annotation/xsd:documentation` text is kept on the node as its description.
5. Oracle: form 04 `Vendors.xsd` imports `Vendors1.xsd` and `Vendors2.xsd`, which declare
   attributes (as does form 03 `locations.xsd`); form 47 uses named `complexType` and
   `simpleType` with facets. Synthetic schemas cover `include`, extension, recursion, a remote
   `schemaLocation`, a model group (global definition, `ref`, `minOccurs`/`maxOccurs` on the
   reference, and a self-referencing group), an attribute group (nested in another attribute
   group), a `list` (`itemType` and inline item type, with a `length` facet), a `union`
   (`memberTypes` and inline members), and one schema with each construct that stays unknown.
6. WHEN the schema belongs to any form listed in the `samples/own/README.md` table, or to the
   public sample, THE SYSTEM SHALL report zero unknown schema entries.

### R16. Per-form counts match `samples/own/README.md`
Traces: Added (testing.md "CI checks the per-form counts"; feature-coverage K.1).

As Quang, I want the numbers in the Triage to be the numbers in the files, so I can trust the plan.

1. THE SYSTEM SHALL produce, for every row of the README table, outputs whose counts equal the
   row's columns as follows (each rule checked against rows 01–42 and, separately, rows 43–47 on
   2026-11-10):

   | README column | Parser output | Rule |
   |---|---|---|
   | Views | `manifest.views` | number of `xsf:view` |
   | Fields | main field tree | number of element nodes, root included; attributes and `xsd:any` excluded. For forms 01–47 this equals the number of named `xsd:element` declarations in `myschema.xsd` |
   | Rules | `manifest.ruleSets[].rules` | number of `xsf:rule` (not rule sets, not actions) |
   | Calcs | `manifest.calculations` | number of `xsf:calculatedField` |
   | Checks | `manifest.validations` | number of `xsf:errorCondition` (excludes schema checks and `xsf3:errorBlank`; none in forms 01–47) |
   | Repeating/optional | main field tree | nodes with `repeating` **or** `optional`. Form 05 counts its optional `relocation` section. For forms 01–42 and 45–47 this equals the count of `editWith` with `component` `xCollection` or `xOptional`. It does not for form 44: its repeating `approvers/Person` group is edited through an ActiveX control, so the view has no `editWith` for it (README 1, `editWith` 0). The oracle is the field tree, not `editWith` |
   | Records | not this spec | files in `records/<slug>/` except `<slug>-000-empty.xml` (spec 11, spec 12) |

2. THE SYSTEM SHALL produce for the public sample: Views 1, Fields 5, Rules 0, Calcs 1, Checks 0,
   Repeating/optional 4 (four `minOccurs="0"` fields). These come from the same rules applied on
   2026-11-10, not from InfoPath.
3. The test SHALL read the README table directly, so adding a row or changing a value changes the
   oracle without editing the test. The test SHALL fail if a README row has no `.xsn`, or an `.xsn`
   has no README row.
4. THE SYSTEM SHALL have a golden snapshot of the full parser output (JSON, file bytes replaced by
   size and SHA-256) for every README form and the public sample.

### R17. Same result in Node 22 and in a Web Worker
Traces: Added (the user's constraint; tech.md; brief 12 AC5–6).

As a developer, I want one parser for every surface, so the web viewer, the Forge resolver and the
tests agree.

1. THE SYSTEM SHALL run in Node 22 and in a dedicated Web Worker without native binaries, a CAB
   library, `DOMParser`, or Node-only modules in the browser bundle.
2. THE SYSTEM SHALL inflate with `DecompressionStream('deflate-raw')` in every runtime (design D1;
   `zlib` is used only in tests, as an oracle), and carry history across blocks (R1.2) by putting the
   previous output (at most 32 KB) in front of each block as an uncompressed deflate block, then
   dropping that many bytes from the output. `DecompressionStream` has no preset-dictionary
   option; this method needs none. Proved on 2026-11-10 with a throwaway script: the 7 multi-block
   cabinets (and the other 36) gave the same bytes as a zlib-dictionary oracle in Node main
   thread, Node `worker_threads` and a Chrome 157 dedicated Worker; re-run in Node on all 48
   cabinets after forms 43–47 arrived. Tasks repeat this proof in the test suite first.
3. WHEN the same bytes are parsed in Node and in a Web Worker, THE SYSTEM SHALL return deep-equal
   results. Oracle: the golden snapshots of R16.4, run in both.
4. THE SYSTEM SHALL make no network request and read no file outside the input bytes.

### R18. Parse within the performance budget
Traces: brief AC8; tech.md performance budgets.

As Mai, I want a folder of 300 templates to triage in minutes, so I can work through it in one sitting.

1. THE SYSTEM SHALL parse each `.xsn` in `samples/own/xsn/` and `samples/public/` in under 300 ms at
   p95 over at least 20 runs each on Node 22 (CI pins Node 22; numbers from other versions are
   informative only), covering cabinet, manifest and all schemas.
2. The largest in-repo form is `08-big-form` (209 fields). The test SHALL report its p95 separately.

## Correctness properties

### R19. Property P1: the parser never hangs and never throws an untyped error
Traces: brief P1.

1. For any byte array up to 2 MiB, generated as random bytes or as mutations of the in-repo
   cabinets (bit flips, truncation, splices, header field changes), THE SYSTEM SHALL return a
   result or throw an `AfterlifeError` with a code from this spec within 1 s.
2. The same SHALL hold for mutated manifests and schemas repacked into a valid cabinet, so the
   XML stages are exercised and not only the CAB reader.
3. At least 1,000 runs per generator in CI; failing seeds are kept as regression fixtures.

### R20. Property P12: every manifest node is accounted for exactly once
Traces: Added (enforces R13; P2–P11 are taken in testing.md, so this takes P12).

1. For any manifest produced by inserting random elements and attributes (random names, known and
   unknown namespaces, random depth) into the in-repo manifests, THE SYSTEM SHALL report each
   inserted node that is not modelled as exactly one unknown entry whose path selects that node in
   the input.
2. For any such manifest, every element and attribute node SHALL be either modelled or inside
   exactly one unknown entry; none is in both and none is in neither. Unknown entries of R13.4
   (a modelled attribute with an unexpected value, `reason: "unexpectedValue"`) annotate a
   modelled node and are not counted here. Entries of R13.9 (`reason: "repeated"`) are counted
   as unknown: the repeated subtree is not modelled. The generator MAY insert a repeat of a
   held-once element (added 2026-11-10 with R13.9).
3. At least 500 runs in CI.

## Traceability

| Brief item | Requirements |
|---|---|
| AC1 MSZIP, bytes equal `bsdtar` | R1, R16.4, R17.3 |
| AC2 LZX/Quantum | R2 |
| AC3 not a cabinet / truncated | R3 (R3.7–R3.8 added) |
| AC4 50 MiB / 2,000 entries | R4 |
| AC5 manifest extraction | R7–R12; completeness R13, R20 |
| AC6 field tree, include/import/ref/named types | R14, R15 |
| AC7 no XXE, no DTD | R5 |
| AC8 300 ms p95 | R18 |
| P1 | R19 |
| Notes: README counts as reference numbers | R16 |
| Added | R6, R13, R16, R17, R20; + items in R2–R5, R7–R12, R14–R15 |

## Decisions (2026-11-10)

These were the open questions of the first draft. Each is resolved in the requirement named.

1. **XML parser:** `@xmldom/xmldom` 0.9.12 (MIT, no dependencies) in Node and the Worker, behind
   one core abstraction (R5.5). tech.md updated. Checks are in design.md.
2. **Inflate with history in the browser:** the stored-block prefix method (R17.2). It is the
   first spike task, proved on the 7 multi-block cabinets in Node and in a Worker.
3. **`required`:** R14.4 is approved. `minOccurs`, `maxOccurs` and `nillable` are kept raw on
   every node (R14.2). Brief 01 AC6 updated to match.
4. **Repeating column:** the README header is now `Repeating/optional`, compared with
   `repeating + optional` (R16.1).
5. **Doc corrections:** made in infopath-domain.md, feature-coverage.md (C and E, citing
   MS-IPFF2), brief 02 (FormIR `unknowns[]`) and tech.md.
6. **Limits:** 20 MiB input and XML depth 256 are approved (R4.3, R4.5).
7. **Checksum mismatch:** not fatal. A `CHECKSUM_MISMATCH` issue when the block still inflates to
   exactly `cbUncomp`; inflate failure or a wrong length stays fatal (R3.3, R3.4).
8. **Fixtures:** forms 43–47 (browser-compatible; ActiveX with `submitToHostAdapter`;
   countersigned `signedDataBlock`; managed code with `davAdapter`; JScript with named types and
   facets) are being added to `samples/own/`, marked "generated, not opened in InfoPath". R1.6,
   R13.6, R15.6 and R16 hold for every README row. Roles, print settings, SharePoint list
   adapters, `xsd:include` and `xsf3` stay synthetic fixtures in `packages/core/test/fixtures/`.
9. **Node:** CI pins Node 22 (R18.1).

Added at design approval (2026-11-10):

10. **Field kind** comes from the content model (R14.1). Only `field` nodes can be `required`
    (R14.4). Form 45's wildcard-only `signatures2` is a `group`, not a required `field` (R14.8).
11. **Encodings** (R5.3, replacing the first wording): any label `TextDecoder` accepts is decoded;
    unknown and `replacement` labels are refused, and so is any label only one runtime accepts.
    The Windows-1251 fixture is a positive case (R5.7).
12. **XSD constructs** (R14.3, R14.4, R14.7, R15.1, R15.4, R15.5): `group`, `attributeGroup`,
    `list` and `union` are modelled; identity constraints, `redefine`, `notation`,
    `substitutionGroup`, `abstract`, `block` and `final` stay unknown with `documented: true`.
13. **R16.1:** the `editWith` equality holds for forms 01–42 and 45–47, not 44.
14. **Forms 43–47** are checked (evidence section) and their manifest names are in Appendix A.
15. **R12.6 oracle corrected:** form 44's ActiveX control is in the view only (no
    `xsf:permissions`), and `handlerObject` is in form 47, not form 46. `allowedControl` keeps a
    synthetic fixture.
16. **R17.2 follows D1:** one inflater, `DecompressionStream('deflate-raw')`, in every runtime;
    tech.md updated to match.

## Appendix A: manifest vocabulary of forms 01–47 and the public sample (must give zero unknown entries)

Forms 01–42 and the public sample use the names below without a marker. Names marked † first
appear in forms 43–47 (checked 2026-11-10 against MS-IPFF2 5.1–5.3: each is declared at that
position, and each enumerated value is inside its list).

Elements (`xsf`): `adoAdapter`, `applicationParameters`, `assignmentAction`, `attachmentFileName`,
`button`, `calculatedField`, `calculations`, `chooseFragment`, `customValidation`, `dataObject`,
`dataObjects`, `davAdapter` †, `davAdapter/fileName` †, `davAdapter/folderURL` †,
`dialogBoxExpressionAction`, `documentSchema`, `documentSchemas`, `documentSignatures` †,
`documentVersionUpgrade`, `domEventHandler`, `domEventHandlers`, `editWith`, `editing`,
`emailAdapter`, `errorCondition`, `errorMessage` (global; the child of `errorCondition`),
`extension`, `extensions`,
`field` (global; reached through `listProperties` → `fields` → `field`), `fields`, `file`,
`fileNew`, `fileProperties`, `files`, `fragmentToInsert`,
`importParameters`, `initialXmlDocument`, `input`, `intro`, `listProperties`, `mainpane`,
`menuArea`, `onLoad`, `operation`, `package`, `property`, `query`, `queryAction`, `rule`,
`ruleSet`, `ruleSetAction`, `ruleSets`, `script` †, `scripts` †, `signedDataBlock` †,
`signedDataBlock/message` †, `solutionProperties`, `subject`, `submit`, `submit/errorMessage` †,
`submitToHostAdapter` †, `switchViewAction`, `to`, `unboundControls`, `useTransform`, `view`,
`views`, `webServiceAdapter`, `xDocumentClass`, `xmlFileAdapter`, `xmlToEdit`.

Elements (`xsf2`): `dataConnections`, `emailAdapterExtension`, `managedCode` †, `offline`,
`server`, `solutionDefinition`, `viewExtension`, `viewsExtension`.

Attributes, by element:
- `xDocumentClass`: `name`, `productVersion`, `publishUrl`, `solutionFormatVersion`,
  `solutionVersion`, `trustLevel`, `trustSetting`
- `adoAdapter`: `commandText`, `connectionString`, `queryAllowed`, `submitAllowed`
- `webServiceAdapter`: `name`, `queryAllowed`, `submitAllowed`, `wsdlUrl`;
  `operation`: `name`, `serviceUrl`, `soapAction`; `input`: `source`
- `xmlFileAdapter`: `fileUrl`; `emailAdapter`: `name`, `submitAllowed`;
  `to`, `subject`, `attachmentFileName`: `value`, `valueType`; `intro`: `value`
- `submit`: `caption`, `disableMenuItem`, `onAfterSubmit`, `showStatusDialog`
- `submitToHostAdapter` †: `name`, `submitAllowed`
- `davAdapter` †: `name`, `overwriteAllowed`, `submitAllowed`; `davAdapter/folderURL` †: `value`;
  `davAdapter/fileName` †: `value`, `valueType`
- `signedDataBlock` †: `data`, `mode`, `name`, `signatureLocation` (`documentSignatures` and
  `signedDataBlock/message` carry no attributes in form 45)
- `scripts` †: `enforceScriptTimeout`, `language`; `script` †: `src`
- `dataObject`: `initOnLoad`, `name`, `schema`; `queryAction`: `adapter`
- `view`: `caption`, `name`; `views`: `default`; `mainpane`: `transform`; `menuArea`: `name`
- `button`: `action`, `caption`, `name`, `showIf`, `xmlToEdit`
- `xmlToEdit`: `container`, `item`, `name`; `chooseFragment`: `innerFragment`
- `editWith`: `autoComplete`, `caption`, `component`, `proofing`, `type`, `xd:autogeneration`
- `rule`: `caption`, `condition`, `isEnabled`; `ruleSet`: `name`; `ruleSetAction`: `ruleSet`
- `assignmentAction`: `expression`, `targetField`; `switchViewAction`: `view`
- `calculatedField`: `expression`, `refresh`, `target`; `domEventHandler`: `match`,
  `handlerObject` †
- `errorCondition`: `expression`, `expressionContext`, `match`; `errorMessage`: `shortMessage`, `type`
- `field` (in `listProperties/fields`): `columnName`, `name`, `node`, `type`
- `file`: `name`; `property`: `name`, `type`, `value`; `extension`: `name`
- `documentSchema`: `location`, `rootSchema`; `initialXmlDocument`: `caption`, `href`
- `useTransform`: `maxVersionToUpgrade`, `minVersionToUpgrade`, `transform`
- `importParameters`: `enabled`; `applicationParameters`: `application`
- `solutionProperties`: `automaticallyCreateNodes`, `fullyEditableNamespace`, `lastOpenView`,
  `lastVersionNeedingTransform`, `scriptLanguage` †
- `xsf2:solutionDefinition`: `allowClientOnlyCode`, `runtimeCompatibility`;
  `xsf2:offline`: `cacheQueries`, `openIfQueryFails`;
  `xsf2:server`: `formLocale`, `isMobileEnabled`, `isPreSubmitPostBackEnabled`;
  `xsf2:viewExtension`: `clientOnly`, `designMode`, `ref`;
  `xsf2:emailAdapterExtension`: `emailAttachmentType`, `ref`;
  `xsf2:managedCode` †: `language`, `projectPath`, `version`

## Appendix B: oracle for the public sample

`samples/public/theill-weight-keeper/theill__weight-keeper.xsn`, extracted with `bsdtar 3.5.3` on
2026-11-10. To be copied into `packages/core/test/fixtures/` in the tasks phase.

| File | Bytes | SHA-256 |
|---|---|---|
| manifest.xsf | 4509 | `4b5737eae97f769a76a444e99d270b99fb05ef5ed6e4d5d3c6b51f6af976fbd2` |
| myschema.xsd | 1248 | `2720127ce43389558ca5d66855cf079bfa40f99fb321f5443d1bd8bccf0505f9` |
| sampledata.xml | 741 | `537b00133ec30ff1e853b0c1354991ea712e0843f46d9cdc313e1b7bd07e69d2` |
| template.xml | 631 | `547a8c908c11f025e96adaca7465bdc71170236f522faa4de7b4dfde6fe0f8c6` |
| upgrade.xsl | 1579 | `569b7d3e2bbc70c4cf0b7c8617417bedd1db4fb91275809d8ba55ffc5211a4fd` |
| view1.xsl | 10138 | `65aa4b86435ba07108f288b5a69b082216d7ebb2004cdadfbb741b5c6d34c218` |
