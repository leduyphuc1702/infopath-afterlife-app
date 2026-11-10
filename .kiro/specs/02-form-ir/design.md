# Design: 02 FormIR

Phase 2 of 3. Requirements: `requirements.md` (R1–R15, approved 2026-11-10). Status: **approved
2026-11-10** (checkpoint `89930d3`), with the review changes below.

Changed at review (2026-11-10): E5 and §9 (strict parsing; a new part bumps `irVersion`); §5
imports from the owning modules; §5, §6.1, §7.4 and §8 for four shapes found in the private
corpus views (ExpressionBox bindings that are expressions, `GetDOM` bindings, `xctname` case,
ActiveX attribute value templates, group bindings and `xd:server`); §10 typo; §12 answered.

Spec 01's design is the reference for everything this one does not restate: workspace and tools
(§12), module rules and the public API through `src/index.ts` (§3, §4), `Located`, `Issue` and
`UnknownEntry` (§5), the error model (§11), the XML layer (§7), the golden helper and
`toMatchFileSnapshot` (§13.1), fast-check style and regression seeds (§13.3), the Worker build and
parity harness (task 24), the perf project (task 27), and the local private check (§15.4).

## 1. Overview

- `buildFormIR` is synchronous and pure: its only input is the `ParsedTemplate` and the options.
  No network, no clock, no randomness. It runs unchanged in Node 22, a Web Worker and Forge.
- It never throws for a `ParsedTemplate` that `parseXsn` returned (R1.3). Problems become `Issue`s
  appended after spec 01's.
- One resolver turns location paths into field ids. View bindings (R4.2) and manifest expressions
  (R11) both use it, so a binding and an expression that name the same field always agree.

## 2. Decisions

| # | Decision | Alternatives | Why |
|---|---|---|---|
| E1 | **Match fields by expanded name** (namespace URI + local name per step), not by prefix. Manifest expressions resolve prefixes through `Manifest.namespaces`; view XSL resolves them with `XmlElement.lookupNamespace` on the element that holds the expression. | match prefixed strings | A view must declare its own prefixes (infopath-domain.md, "Traps"), and those prefixes need not equal the manifest's. URIs are what the field tree holds. |
| E2 | **One tokenizer and one resolver for bindings and expressions** (§7). | a separate binding resolver | Spec 04 can replace the tokenizer later behind the same `resolvePath` contract. |
| E3 | **Ids are readable strings derived from paths** (§4), not hashes. | SHA-256 of the path | Tim diffs FormIR as text (R13). A hash hides what changed. The ids are longer, but the JSON is for diffs and tools, not people. |
| E4 | **A hand-written validator for `parseFormIR`, strict about extra keys.** | zod or ajv; lenient parsing | tech.md allows no new dependency without need. Strict parsing makes `serialise(parse(s)) === s` exact (R14). |
| E5 | **FormIR keeps only what R1–R11 name.** Facets, `sharePoint` and promoted fields stay in `ParsedTemplate`. Any new part, optional or not, bumps `irVersion`. | copy the whole field node; optional parts with no version change | Lean output; the viewer and Triage do not need them. FormIR is derived data, never the source of truth: a consumer that meets another version rebuilds it from the `.xsn`, so version skew costs nothing (review answer 1). |
| E6 | **The view scan is a static walk of the XSL tree.** No XSLT runs (spec 03 renders). Only the constructs in §6.1 are understood; a control under anything else is kept with an `UNRESOLVED_BINDING` issue. | run the XSLT with instrumentation | The scan must work before spec 03 exists, and it must name what it did not understand. |
| E7 | **View XSL gets its own XML context** with `xmlBytes` set to `viewXmlBytes` (default 4 MiB, R15). | share spec 01's 4 MiB budget | Form 08's view alone is 171 KB; the budgets cover different files. |

## 3. Module layout

New folder `packages/core/src/ir/` (reserved in structure.md). The stage table in §3.2 names each
module; `types.ts`, `ids.ts` (§4) and `json.ts` (§9) complete it. Only §3.1 is public.

### 3.1 Public API (added to `src/index.ts`)

```ts
export function buildFormIR(t: ParsedTemplate, options?: FormIROptions): FormIR;
export function serialiseFormIR(ir: FormIR): string;
export function parseFormIR(json: string): FormIR;
export const FORMIR_VERSION: 1;
export interface FormIROptions { readonly viewXmlBytes?: number } // default 4 MiB (R15)
export type { FormIR, /* every part type of §5 */ };
```

`ErrorCode` gains `INVALID_IR` (`details.path`) and `UNSUPPORTED_IR_VERSION` (`details.found`).
`IssueCode` gains `UNRESOLVED_BINDING` and `DUPLICATE_ID`; `UNRESOLVED_REFERENCE` (spec 01, R15.2)
is reused with `details.kind: 'expression'`. View files that fail to read give the issue code of
the `AfterlifeError` the XML layer threw (`INVALID_XML`, `UNSAFE_XML`, `LIMIT_EXCEEDED`), as for
non-manifest files in spec 01 R5.4.

### 3.2 Pipeline

| Stage | Module | Input | Output |
|---|---|---|---|
| 1 meta | `meta.ts` | `manifest.documentClass`, `fileNew`, `solution` | `Meta` (R2) |
| 2 data tree | `data-tree.ts` | `schemas.main`, `schemas.secondary`, `manifest.namespaces` | `fields`, `groups`, `NameIndex` (§7.3) (R3) |
| 3 manifest elements | `elements.ts` | `ruleSets`, `bindings`, `calculations`, `validations`, `blankChecks`, `domEventHandlers`, `scripts`, `solution.managedCode`, `codeFiles`, `signatures`, view `signatureLines` | rules, calculations, validations, code, signatures, plus `PendingExpr[]` (expression, context, role, element id) |
| 4 connections | `connections.ts`, `endpoints.ts` | adapters of `mainQuery`, `dataObjects`, `submit`, `dataAdapters`; `connectionExtensions` | `dataConnections`, more `PendingExpr` (submit values) |
| 5 view scan | `views/scan.ts` | each `View`, its XSL file, `NameIndex` | `views[].controls`, `activeX`, binding references |
| 6 labels | `views/labels.ts` | controls, scan cells, `sharePoint` of each field node | `label`, `labelSource`, `labelEvidence` on fields and groups |
| 7 references | `xpath/*`, `dependencies.ts` | every `PendingExpr` and binding | `dependencies.references`, per-node `readBy`/`writtenBy`, `unresolvedRefs`, connection lineage |
| 8 finish | `build.ts`, `ids.ts` | everything | unknowns and issues passed through (R10, R1.3), id uniqueness check, the `FormIR` |

Stages 5 and 7 call the same resolver (E2). The data tree must exist before either.

## 4. Ids (R13.2)

Every id is a string built from the template alone:

| Element | Id | Built from |
|---|---|---|
| field | `f:<dataSource>:<dataPath>` | data source name (`main` or the data object's `name`) and data path |
| group | `g:<dataSource>:<dataPath>` | same |
| manifest element | `<kind>:<manifest path without the leading /xsf:xDocumentClass[1]>` | kind: `rule`, `action`, `calc`, `val`, `conn`, `view`, `handler`, `sig`, `allowed` |
| view element | `<kind>:<xsl file>:<compact path>` | kind `ctl` (bound control) or `ax` (ActiveX object); compact path below |

- **Data path:** `/` then one step per node from the tree root, each step `prefix:local` with the
  first prefix in `Manifest.namespaces` bound to the node's namespace; `{uri}local` when no
  non-empty prefix is bound to it; `local` for no namespace; attributes as `@step`. No positions:
  a field is a schema node, not an instance node.
- **Compact path:** the path the XML layer gives the element (spec 01 glossary "Path"), with the
  root step dropped and `{http://www.w3.org/1999/XSL/Transform}` written `xsl:` and
  `{http://schemas.microsoft.com/office/infopath/2003}` written `xd:`. Spec 01's `path.ts` is not
  changed; the compaction is local to `ids.ts`.
- **Uniqueness:** checked once at the end. A repeat keeps the first and gives later ones the
  suffix `#2`, `#3` …, with a `DUPLICATE_ID` issue. No sample is expected to have one.
  [VERIFY: counted over the 48 samples by the task 9 test.]

Worked examples (paths from the samples, checked 2026-11-10 against the spec 01 golden files and
the expression strings):
1. Form 04's line total is the calculation target `/my:purchaseRequest/my:lines/my:line/my:lineTotal`
   in the main tree, so its id is `f:main:/my:purchaseRequest/my:lines/my:line/my:lineTotal`. Form
   03's secondary source `Locations` has no target namespace; the attribute the city list filters
   on is `f:Locations:/locations/country/@code`.
2. Form 04's first rule ("Query budget service") is at
   `/xsf:xDocumentClass[1]/xsf:ruleSets[1]/xsf:ruleSet[1]/xsf:rule[1]`, so its id is
   `rule:/xsf:ruleSets[1]/xsf:ruleSet[1]/xsf:rule[1]`, and its query action is
   `action:/xsf:ruleSets[1]/xsf:ruleSet[1]/xsf:rule[1]/xsf:queryAction[1]`. Forms 01 and 07 share the
   URN and the `my` namespace, so both have `f:main:/my:leaveRequest/my:employeeName` (R13.2).

## 5. Types

All in `src/ir/types.ts`. Spec 01 types are imported, not re-declared. Every property is
`readonly` and every array `readonly`; both are left out below for length. Optional properties are
absent, never `undefined` (`exactOptionalPropertyTypes`, as spec 01).

```ts
import type { Issue } from '../errors';                 // spec 01, from the owning modules:
import type { Located, UnknownEntry } from '../unknown'; // src/ never imports src/index.ts
import type { FieldNode } from '../xsd/types';
type Attrs = Record<string, string>;
type DataSource = string;                           // 'main' or an xsf:dataObject/@name

export interface FormIR {
  irVersion: 1; meta: Meta;
  fields: IrField[]; groups: IrGroup[];             // main tree, then secondary trees by name; tree order
  views: IrView[]; rules: IrRule[]; calculations: IrCalculation[]; validations: IrValidation[];
  dataConnections: IrConnection[]; codeBehind: CodeBehind; signatures: Signatures; activeX: ActiveX;
  dependencies: { references: Reference[] };
  unknowns: UnknownEntry[];                         // spec 01's, deep-equal, same order (R10)
  issues: Issue[];                                  // spec 01's, then this spec's (R1.3)
}
export interface Meta {                                                                    // R2
  name: string; nameSource: 'caption' | 'urn' | 'none';
  urn?: string; solutionVersion?: string; productVersion?: string;
  solutionFormatVersion?: string; publishUrl?: string;
  generation: '2003' | '2007' | '2010' | '2013' | 'unknown';
  generationEvidence?: Located;                     // the productVersion attribute
  browserCompatible: boolean; publishEndpoint?: Endpoint; source: Located;
}
interface IrNode {                                                                         // R3.1
  id: string; dataSource: DataSource; path: string; name: string; namespace: string | null;
  nodeType: FieldNode['nodeType']; groupId?: string;   // nearest enclosing group; none for a root
  repeating: boolean; optional: boolean; choiceGroup?: string;
  label: string; labelSource: LabelSource; labelEvidence: LabelEvidence;              // R5
  dependencies: { readBy: DepRef[]; writtenBy: DepRef[] };                           // R11.3
  source: Located; use?: Located;
}
export interface IrField extends IrNode {
  kind: 'field' | 'richText'; xsdType: FieldNode['xsdType']; required: boolean;
  default?: string; fixed?: string;
}
export interface IrGroup extends IrNode { kind: 'group' }
export type LabelSource = 'title' | 'cell' | 'leftCell' | 'checkboxText' | 'columnHeader'
  | 'schemaDisplayName' | 'otherView' | 'name';
export interface LabelEvidence {                                                           // R5.3
  step: LabelSource;
  viewStep?: 'title' | 'cell' | 'leftCell' | 'checkboxText' | 'columnHeader'; // set for otherView
  view?: string; at?: Located;                      // the text or attribute used; none for 'name'
}

export interface IrView {                                                                  // R4.1
  id: string; name: string; caption?: string; xslFile?: string; isDefault: boolean; isPrint: boolean;
  scanned: boolean;                                 // false when the XSL is missing or unreadable (R4.3)
  controls: BoundControl[]; source: Located;
}
export interface BoundControl {                                                            // R4.2
  id: string; xctname?: string; ctrlId?: string;
  binding: string;                                  // as written
  targetId?: string;                                // the field or group, when the whole binding is one path
  readOnly: boolean;                                // ExpressionBox: the binding is an expression
  title?: string;                                   // static non-empty ScreenTip, own or of its DTPicker
  dynamicAttrs?: string[];                          // read attributes that are dynamic AVTs (§6.1), e.g. ['title']
  inRepeat: boolean;                                // inside a repeating row (§6.1)
  choice?: { label: string; value?: string };       // option buttons (R5.1)
  choicesFrom?: ChoicesFrom; source: Located;
}
export interface ChoicesFrom {                                                             // R4.4
  dataSource: DataSource; connectionId?: string;
  select: string; filterIds: string[];              // for-each select as written; fields in its predicates
}

export interface IrRule {                                                                  // R6
  id: string; ruleSet: string; caption?: string; condition?: string;
  enabled: boolean; stopProcessing: boolean; actions: IrAction[]; triggers: Trigger[];
  unresolvedRefs: UnresolvedRef[]; source: Located;
}
export interface IrAction { id: string; kind: string; attrs: Attrs; text?: string; source: Located }
export type Trigger = { source: Located } & (
  | { kind: 'fieldChange'; match: string; targetId?: string }
  | { kind: 'onLoad' } | { kind: 'submit' } | { kind: 'button'; view?: string; button?: string });
export interface IrCalculation {                                                           // R7.1
  id: string; target: string; targetId?: string; expression: string; refresh?: string;
  unresolvedRefs: UnresolvedRef[]; source: Located;
}
export interface IrValidation {                                                            // R7.2
  id: string; kind: 'errorCondition' | 'blank'; match: string; matchId?: string;
  expressionContext?: string; expression?: string;
  message?: { type?: string; shortMessage?: string; text: string };
  unresolvedRefs: UnresolvedRef[]; source: Located;
}

export interface IrConnection {                                                            // R8
  id: string; name?: string; adapterKind: string;   // local name: 'adoAdapter', …
  dataSource?: DataSource; isQuery: boolean; isSubmit: boolean;
  attrs: Attrs;                                     // connectionString redacted (R8.4)
  children: { kind: string; attrs: Attrs; source: Located }[];
  endpoints: Endpoint[]; credentialRedacted: boolean;
  lineage: { fieldIds: string[]; usedBy: string[] };                                  // R11.3
  unresolvedRefs: UnresolvedRef[];                  // submit values
  source: Located;
}
export interface Endpoint {                                                                // R8.2
  attribute: string; value: string;                 // 'wsdlUrl', 'publishUrl', …; redacted for connection strings
  host?: string; liveness: 'internal' | 'package' | 'unknown'; reason: LivenessReason;
  source: Located;
}
export type LivenessReason = 'singleLabel' | 'localhost' | 'reservedSuffix' | 'privateIp'
  | 'loopbackIp' | 'linkLocalIp' | 'localServer' | 'filePath' | 'packageFile' | 'public' | 'unparsed';

export interface CodeBehind {                                                              // R9.1
  present: boolean; languages: string[]; files: string[];
  handlers: { id: string; match: string; targetId?: string; handler: string; source: Located }[];
}
export interface Signatures {                                                              // R9.2
  blocks: { id: string; name?: string; mode?: string; message?: string; data?: string;
            dataId?: string; source: Located }[];
  signatureLines: { id: string; view?: string; attrs: Attrs; source: Located }[];
}
export interface ActiveX {                                                                 // R4.5
  controls: { id: string; view: string; classid?: string; binding?: string; targetId?: string;
              server?: Endpoint;                    // xd:server (§8)
              source: Located }[];
  allowed: { id: string; clsid?: string; cabFile?: string; source: Located }[];
}

export type DepRole = 'condition' | 'actionExpression' | 'dialogText' | 'assignmentTarget'
  | 'calcExpression' | 'calcTarget' | 'validationMatch' | 'validationExpression' | 'binding'
  | 'choicesFilter' | 'submitValue' | 'codeHandler' | 'trigger' | 'signedData';
export interface DepRef { elementId: string; role: DepRole }
export interface Reference extends DepRef { targetId: string; text: string }
export interface UnresolvedRef {
  role: DepRole; text: string;
  reason: 'variable' | 'descendant' | 'wildcard' | 'axis' | 'dynamicGetDom' | 'aboveRoot'
    | 'notInTree' | 'unknownPrefix' | 'unknownDataSource' | 'stringExpression';
}
```

Rules the types do not show:
- `writtenBy` holds `assignmentTarget`, `calcTarget` and `binding` (a control reads and writes);
  `readBy` holds the rest and `binding` again. Order: `DepRole` order above, then element order.
- `isQuery`: spec 01 `role` is `query` or `queryAllowed="yes"`. `isSubmit`: `role` is `submit` or
  `submitAllowed="yes"`. `dataSource` is the data object name, or `main` for `mainQuery`.
- `Meta.name`: `initialXmlDocument/@caption`; else the URN segment after `infopath:` up to `:-`;
  else `''` with `nameSource: 'none'`.

## 6. Static view scan (R4.2–R4.5)

Each view's first `mainpane/@transform` is read from `t.files` (case-insensitive name, as spec 01
R6.2) and parsed with `parseXml` under the E7 context. The scan walks the element tree once,
carrying a **context**: a data source and a node path in it (or `unknown`), plus the repeat state.

### 6.1 Constructs matched

Only these, each seen in our 53 views or recorded for the private corpus in requirements
"Evidence":

| Construct | Seen | Effect on the scan |
|---|---|---|
| `xsl:template` with `match` and no `mode` (one per view) | 53 of 53 own views; public sample | Root context: `match` read as a relative path from the document node of the main tree (`my:leaveRequest`). `match="/"` gives the document node. [VERIFY: `match="/"` is not in our samples] |
| `xsl:template[@mode]` reached by `xsl:apply-templates[@select][@mode]` | forms 02–08 | Context: the caller's context plus `select`. Called from inside a `table` → repeating row. A mode called from 0 or several sites → `UNRESOLVED_BINDING` per control (R4.3); 0 of 53 views have either |
| `xsl:for-each[@select]` | forms 03, 04 (`GetDOM` lists); corpus repeating tables inside `tbody[@xd:xctname="repeatingtable"]` | Context: previous plus `select`, which may move into a secondary tree. Inside a `table` → repeating row. Inside a bound control with a `GetDOM` select → `choicesFrom` (R4.4) |
| `xsl:if`, `xsl:choose`/`xsl:when`/`xsl:otherwise` | all views | Transparent: children scanned in the same context; tests not read (spec 04) |
| `xsl:text` | all views | Label text (§6.2) |
| `xsl:value-of`, `xsl:attribute`, `xsl:variable` | all views; `$val` 3 times | Ignored for context and text |
| any element with `xd:binding` | 707 in 53 own views; 423 in 36 private views | A bound control (R4.2), resolved against the context. Inner bound parts do not occur nested (0 of 707). The binding may start with `xdXDocument:GetDOM("name")` (private: 4 `PlainText` bound to `GetDOM("…")/z:row/@ows_…`), resolved by §7 with prefixes from the control's scope (E1). It may resolve to a group (ActiveX, below) |
| `xd:xctname="ExpressionBox"` | private: 14 controls | Read-only. The binding is an expression (`xdMath:Avg(<path>)`, `string("…")`): tokenised as in §7; each resolved path is a `readBy` with role `binding`, never `writtenBy`; `targetId` only when the whole binding is one path; only literals → no reference, no issue |
| `xd:xctname` of a control and of its parent, compared case-insensitively and kept as written | PlainText, dropdown (private: also `DropDown` ×2), DTPicker_DTText (parent DTPicker), CheckBox, OptionButton, RichText, FileAttachment, InlineImage | `xctname`; the parent `DTPicker`'s `title` stands in for the control's (R5.1 step 1); `OptionButton` gives `choice` (value `xd:onValue`, label = text after it up to the next control) |
| `td`, `th`, `tr`, `table`, `thead`, `tbody`, in no namespace or XHTML | all views | Cells for labels (§6.2) |
| `object` with `classid`, or `class` containing `xdActiveX` | form 44; private: 7 in 2 workflow-task forms, all `clsid:61e40d31-993d-4777-8fa0-19ca59b6d0bb` (the Contact Selector [VERIFY: the name]) | `activeX.controls` (R4.5). Its `xd:binding` (with `xd:boundProp="xd:inline"`) resolves like any control, here to a group id. `xd:server` is an endpoint (§8) |
| attribute value templates on literal result elements (XSLT 1.0 §7.6.2) | private: `xd:xctname="{{61e40d31-…}}"` on every ActiveX object | Every attribute the scan reads (`title`, `xd:xctname`, `xd:CtrlId`, `classid`, `xd:server`, `xd:onValue`) is decoded: `{{` → `{`, `}}` → `}`. A value with an unescaped `{…}` is dynamic: the property is absent and its name goes to `dynamicAttrs`. A dynamic `title` is not a label source (R5.1 step 1). `xd:binding` is read as written |

Changed at task 7: "called from inside a `table`" means the repeat point's nearest table
ancestor (`td`, `th`, `tr`, `tbody`, `thead`, `tfoot`, `table`) is not a cell. A moded template
called from inside a layout cell (form 02's claimant section) is not a repeating row; one called
from a `tbody` (form 02's expense rows) is. Reasons on `UNRESOLVED_BINDING` are the §7.3 ones plus
`modeCallSites`, `modeNotCalled`, `namedTemplate`, `matchPattern`, `noSelect`, `notOnePath` and
`xsl:<name>` for a control under another XSL instruction. A view whose XSL file is missing keeps
`scanned: false` and adds no issue of its own: spec 01's `MISSING_FILE` already names it.

Not understood, so a control under them gets `UNRESOLVED_BINDING`: `xsl:call-template` and named
templates, `xsl:import`/`xsl:include` in a view, `match` patterns with `|` or predicates, and
`select` values containing a variable. Bindings are resolved by §7 with the control as the
namespace scope (E1).

### 6.2 Cells

For each control the scan records its own cell (nearest `td`/`th` ancestor), the row, and, for a
control in a repeating row, the **header row**: from the repeat point (`apply-templates` or
`for-each`) go up to the nearest `table`; the header row is the last `tr` in that table that
precedes the repeat point and does not contain it. Column index counts `td`/`th` siblings and
ignores `colspan`. [VERIFY: no sample uses `colspan` in a header row.]

**Text** of a node means its text children and `xsl:text` contents in document order, stopping at
(and excluding) any bound control and any other `xsl:*` element, with whitespace collapsed.

Changed at task 8: (1) text after a `CheckBox` or `OptionButton` belongs to it (its checkbox text
or choice label), so R5.1 step 2 gives nothing for the next control in that cell when the
previous bound control is one of these; without this, the second of two checkboxes without
ScreenTips in one cell took the first one's text. (2) Whitespace-only text between elements is
not text: XSLT 1.0 §3.4 strips it from the stylesheet, so `<b>Site</b> <xsl:text>x</xsl:text>`
reads `Sitex`. Block elements (`div`, `p`, `br`, table parts, headings, lists) separate words.
(3) The default view is the one `isDefault` marks; with none marked, the first scanned view.
(4) R5.1's counts are over the 606 main-tree fields; the 9 secondary-source fields of forms 03
and 04 have no control and get step 8.

## 7. References: tokenizer and resolver (R11)

### 7.1 Tokenizer (`xpath/tokens.ts`)

Lexes XPath 1.0 (XPath 1.0 §3.7) into: string literal (`"…"`, `'…'`), number, `/`, `//`, `.`,
`..`, `@`, axis name `name::`, name test (`NCName`, `prefix:NCName`, `prefix:*`, `*`), variable
`$name`, operator (`= != < <= > >= + - | , ( ) [ ]`), and operator names. The §3.7 rule: after an
operand (a name, number, literal, `)`, `]`, `.`, `..`), `*` is multiply and `and`, `or`, `div`,
`mod` are operators; elsewhere they are name tests. A name followed by `(` is a function call,
except the node types `node`, `text`, `comment`, `processing-instruction`.

Grouping: a **location path** is a maximal run of steps joined by `/` or `//`, starting with `/`,
`//`, a step, `xdXDocument:GetDOM("name")` followed by `/`, or `current()` followed by `/`. Each
step keeps its predicates; the paths inside a predicate are collected too, with that step as their
context. A lexing error leaves the whole string as one `UnresolvedRef` with reason
`notInTree` and an `UNRESOLVED_REFERENCE` issue. [VERIFY: no sample expression fails to lex; the
first-draft prototype lexed all 1,547 strings.]

Not references: function names, node-type tests, literals (so a path inside `"…"` is never one),
numbers, variables. `xdMath:Eval` is the one function whose string argument is an expression: its
second argument gives one `UnresolvedRef` with reason `stringExpression` (R11.4).

### 7.2 Contexts (R11.2)

| Expression | Context |
|---|---|
| calculation `expression` | the node of `target` |
| validation `expression` | the node of `match`, then `expressionContext` applied as a relative path |
| rule `condition`, action `expression`, `targetField`, dialog text | per `fieldChange` trigger: the node of its `match`; with no such trigger, the main root. Several distinct contexts → resolved once each, references merged |
| submit value with `valueType="expression"` | the main root |
| absolute-only strings (`target`, `match`, `domEventHandler/@match`, `signedDataBlock/@data`) | the document node |
| view binding, `for-each` select | the scan context (§6) |

`current()` is the context of the whole expression (for a view select, the template context).
`GetDOM("name")` switches to the document node of secondary tree `name`.

### 7.3 Resolver (`xpath/resolve.ts`)

`NameIndex` maps `(dataSource, parent id, nodeType, namespace URI, local name)` to a node id, built
in stage 2. A step's prefix is expanded by the scope: `Manifest.namespaces` for manifest strings,
`lookupNamespace` on the holding XSL element for view strings. An unprefixed name is in no
namespace (XPath 1.0). Supported: child and attribute steps, `.`, `..`, axes `child::`,
`attribute::`, `self::`, `parent::`. A path resolves to exactly one node or to an `UnresolvedRef`
whose reason names the first thing that failed: `$var` at the start (`variable`), `//`
(`descendant`), `*` or `prefix:*` (`wildcard`), another axis (`axis`), `GetDOM` with a non-literal
argument (`dynamicGetDom`) or naming no secondary tree (`unknownDataSource`), `..` above the root
(`aboveRoot`), a prefix not in scope (`unknownPrefix`), a step with no matching child
(`notInTree`).

Each `UnresolvedRef` also gives one `UNRESOLVED_REFERENCE` issue (`details.kind: 'expression'`,
`details.reason`, `details.elementId`). Nothing is dropped silently. The first draft's prototype
resolved 1,566 of 1,566 references in the 48 samples with these rules (requirements "Evidence").

### 7.4 Assembly (`dependencies.ts`)

A control's binding reference is both `readBy` and `writtenBy` (role `binding`), except for a
read-only control (ExpressionBox), which is `readBy` only. Each resolved reference becomes a
`Reference` in `dependencies.references` (element order of the
FormIR arrays, then text order) and one `DepRef` on the target's `dependencies.readBy` or `.writtenBy`
(§5 notes). A connection's `lineage.fieldIds` are the nodes of its `dataSource` tree that any reference
reaches; `usedBy` are the ids of elements with such a reference plus controls whose `choicesFrom`
names the connection.

## 8. Endpoints (R8.2–R8.4)

Sources: `xd:server` on ActiveX controls (static values only; private: `http://<single-label host>:<port>`, so `internal`, `singleLabel`), `wsdlUrl`, `serviceUrl` (on `xsf:operation`), `fileUrl`, `folderURL/@value`, `siteUrl`,
`siteURL`, `connectoid/@source` (via `connectionExtensions`), ADO `connectionString`, and
`meta.publishUrl`. `soapAction` and e-mail values are not endpoints.

**Host extraction:**
- a URL (`scheme:`) is parsed with the WHATWG `URL` global, present in Node 22 and Workers;
  a `file:` URL is a file path;
- `\\host\…` (UNC) and a drive letter (`C:\`, `D:\`) are file paths;
- a connection string is split on `;` into `key=value` pairs (keys case-insensitive, quoted values
  `"…"`/`'…'` kept whole). The host is the first of `Data Source`, `Server`, `Address`, `Addr`,
  `Network Address`, with `tcp:`, `,port` and `\instance` removed;
- a relative name is checked against `t.files` (case-insensitive, last segment).

**Liveness**, first match wins:

| Test | Liveness | Reason |
|---|---|---|
| file path | internal | `filePath` |
| relative name of a package file | package | `packageFile` |
| connection-string host `(local)` or `.` | internal | `localServer` |
| `localhost` | internal | `localhost` |
| ends in `.localhost`, `.local`, `.home.arpa`, `.internal` | internal | `reservedSuffix` |
| IPv4 `127/8`, IPv6 `::1` | internal | `loopbackIp` |
| IPv4 `10/8`, `172.16/12`, `192.168/16`; IPv6 `fc00::/7` | internal | `privateIp` |
| IPv4 `169.254/16`; IPv6 `fe80::/10` | internal | `linkLocalIp` |
| a name with no dot | internal | `singleLabel` |
| any other host | unknown | `public` |
| no host found | unknown | `unparsed` |

IPv4 is parsed as four decimal octets; IPv6 is taken from URL brackets and compared by prefix.
Hosts are compared lower-case with one trailing dot removed.

**Redaction:** in `connectionString`, every value of a key matching `/^\s*(password|pwd)\s*$/i`
is replaced by `***` and the rest is kept byte for byte; `credentialRedacted` is true when at least
one was replaced. The connection's `attrs.connectionString` and its endpoint `value` both hold the
redacted string. Spec 01's `containsCredential` regex finds the same keys.

Changed at task 7 (R8.4): the key test is `/(^|[\s:])(password|pwd)$/i` on the trimmed key, the
whitespace around the value is kept, and a URL userinfo password becomes `***` (the user name
kept, no `URL` serialisation). Every connection attribute is redacted this way. Spec 01's
`containsCredential` is now `redactSecrets(cs).redacted`, from the shared `src/xsf/credentials.ts`.

## 9. JSON (R13.1, R14)

- `serialiseFormIR`: a stable stringify in `json.ts`, the same rules as spec 01's test helper
  `snapshot.ts` (keys sorted by `Array.prototype.sort` on `Object.keys`, arrays in order,
  two-space indent, final newline). It throws `INTERNAL` on `undefined`, non-finite numbers, `-0`
  or a non-plain object, which would be a builder bug. The test helper is not imported by `src/`.
- `parseFormIR`: `JSON.parse` (a syntax error is `INVALID_IR` with path `$`), then `irVersion`
  (anything but `1` is `UNSUPPORTED_IR_VERSION`), then a hand-written check of every part against
  §5: required keys, no extra keys, value types and enum members. The first failure is
  `INVALID_IR` with `details.path` such as `$.fields[3].labelSource`. Record-typed values (`attrs`)
  are copied into objects with only own keys, so a key named `__proto__` round-trips as data.
- Strict on purpose (review answer 1): an unknown part or key is `INVALID_IR`, and any new part,
  optional or not, bumps `irVersion`. A consumer that gets `UNSUPPORTED_IR_VERSION` rebuilds the
  FormIR from the `.xsn` with its own `buildFormIR`.

## 10. Test plan

Paths are relative to `packages/core/test/`. Golden FormIR files are
`golden/formir/<slug>.json`, one per README row plus `theill-weight-keeper.json`, written with
`toMatchFileSnapshot(serialiseFormIR(ir))` (the folder is under the existing `.prettierignore`
entry).

| Requirements | Kind | Fixture | File |
|---|---|---|---|
| R13.2, R14 (errors) | unit | hand-built ids and JSON | `ir/ids.test.ts`, `ir/json.test.ts` |
| R1.1, R1.3, R2, R3, R10 | unit + samples | 48 samples, synthetic `ParsedTemplate`s | `ir/meta.test.ts`, `ir/data-tree.test.ts`, `ir/build.test.ts` |
| R6, R7, R9 | unit + samples | 48 samples; spec 01 synthetic manifests (`errorBlank`, signature lines) | `ir/elements.test.ts` |
| R8 | unit + samples | forms 03, 04, 43, 44, 46; spec 01 synthetic adapters; one case per liveness row | `ir/endpoints.test.ts`, `ir/connections.test.ts` |
| R4 | unit + samples | 53 views; synthetic views in `fixtures/synthetic/views/` | `ir/view-scan.test.ts` |
| R5 | unit + samples | the R5.4 fixtures in `fixtures/synthetic/views/labels/`, written for this project; forms 01–08 | `ir/labels.test.ts`, `ir/labels.samples.test.ts` |
| R11.1, R11.2, R11.4 | unit | the R11.1 tokenizer cases; one case per §7.3 reason | `ir/xpath-tokens.test.ts`, `ir/xpath-resolve.test.ts` |
| R11.3, R11.5 | samples | 48 samples: 1,566 of 1,566; forms 03, 04 oracles | `ir/dependencies.samples.test.ts` |
| R1.2, R3.3, R13.2, R13.3 | golden | 48 samples, built twice | `ir/golden.samples.test.ts` |
| R14 (P6) | property | 48 samples + generator, 500 runs | `property/p6.property.test.ts` |
| R12 (P13) | property | generator over sample trees, 500 runs | `property/p13.property.test.ts` |
| R13.1 | browser | the FormIR golden files | `browser/worker-parity.browser.test.ts` (extended) |
| R15 | perf | 48 samples, 20 runs | `perf/formir.perf.test.ts` |
| R1.1 (purity) | lint | `src/ir/**` | `lint/restricted.test.ts` (extended) |
| R1.4 | local only | `AFTERLIFE_PRIVATE_SAMPLES` | `private-corpus.local.test.ts` (extended) |

**Generators** (fast-check, spec 01 §13.3 style, failing seeds kept in `property/regressions.ts`):
- **P6** builds `FormIR` values directly from arbitraries per part. It varies: the number of each
  element (0–5), presence of every optional property, every enum member, strings with quotes,
  backslashes, newlines, non-BMP characters and keys such as `__proto__` in `attrs`, integer line
  and column values. The 48 sample FormIRs are run
  through the same round trip.
- **P13** takes a sample's `ParsedTemplate` and adds one calculated field (a `Modelled` object, no
  XML) whose target is a chosen field and whose expression mixes 1–4 inserted field references
  (absolute, relative with the right number of `..`, inside a predicate, after
  `GetDOM("name")` for a secondary tree) with operators (`+`, `div`, `and`, `=`), function calls
  (`xdMath:Nz(`, `sum(`, `concat(`), numbers and string literals containing path-like text. After
  `buildFormIR`, every inserted field has that calculation in `readBy`, and no field that appears
  only inside a literal does.

**Local private check (R1.4):** task 33's file gains a second assertion per template:
`buildFormIR` returns. `afterAll` adds three count lines: FormIR issue codes, `meta.generation`
values and `labelSource` values. Same rules: names and counts only, no snapshots, no writes.

## 11. Risks

| Risk | Retired by |
|---|---|
| The view scan misreads real layouts (corpus: 37 of 169 controls had no label before steps 5–6) | Task 5 builds the scan on the §6.1 table only; task 13's local run prints the `labelSource` counts for comparison with requirements "Evidence" |
| Label counts of R5.1 (`title` 585, `leftCell` 2, `otherView` 14, `name` 5) were derived, not run | Task 8's sample test counts them; a mismatch stops the task |
| Build time with view parsing | Task 12 measures; xmldom parses about 9.5 MB/s (spec 01 D7), so form 08's 171 KB view is about 18 ms |

## 12. Review answers (2026-11-10)

1. `parseFormIR` stays strict; any new part bumps `irVersion` (E5, §9).
2. Ids stay readable (E3).
