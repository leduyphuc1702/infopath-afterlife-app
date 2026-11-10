# Requirements: 02 FormIR (intermediate representation)

Source brief: `docs/spec-briefs/02-form-ir.md`. Phase 1 of 3 (requirements → design → tasks).
Status: **approved 2026-11-10** (revision 2, with the answers to its open questions applied).
Revision 2 applies the maintainer's decisions 1–10 on the first draft (listed at the end) and the
private-corpus evidence. Depends on spec 01 (committed `f8582a3`) **and on its addendum R21** (spec 01 tasks
29–34: `Manifest.namespaces`, the real-file manifest elements, `FieldNode.sharePoint`), which is
done before spec 02 starts.

## Introduction

This spec turns spec 01's `ParsedTemplate` into **FormIR**: one versioned, JSON-serialisable model
of a form that every later surface reads instead of the manifest. It is a pure, synchronous
transform of an already-validated result. It adds four things spec 01 does not have:
1. stable ids and data paths for fields, rules, calculations, validations and data connections;
2. a static scan of each view's XSL for its bound controls, which gives labels, the views that use
   a field, the data source behind a list, and ActiveX objects;
3. a dependency index: for every field, what reads it and what writes it;
4. an `internal`/`unknown` verdict for every connection endpoint.

The test for every requirement is one question: do the web viewer (spec 09: X-ray, dependency
map, data lineage, dead connections) or the Triage (spec 12: counts, generation, causes of death)
need it? Things that only the converter, the runtime or Rovo need are out of scope here and are
listed below with the spec that owns them.

**Expressions stay strings.** Rule conditions, calculations, validation expressions and action
expressions are carried exactly as written in the manifest. This spec reads them only to find the
fields they refer to (R11). Parsing and evaluating XPath belongs to spec 04.

Out of scope, and the spec that owns each item (approved, decision 6):
- promoted fields (`listProperties`) and their link to Jira fields: spec 05 (brief 05 AC9);
- user roles: spec 05 (Manual classification, brief 05 AC6);
- default values from `template.xml`, and formula defaults: spec 04 (the runtime starts from
  `template.xml`) and spec 05. FormIR keeps only the XSD `default` and `fixed` values;
- static choice lists (the `<option>` values of a dropdown): spec 05 (question choices);
- conditional formatting conditions in view XSL (`xsl:if`/`xsl:choose` around `style`): spec 04;
- rules in plain English: spec 09 (deterministic summary in the viewer) and spec 10 (Rovo);
- the `dead` state of an endpoint, which needs a network check: spec 09 and spec 06;
- coverage states (Native, App, Manual, Unsupported): spec 05;
- record matching, `upgrade.xsl`, record counts and the `browser-xslt` cause: spec 11 and spec 12;
- editing FormIR by hand (brief "Out of scope"; the mapping UI stores overrides separately).

## Glossary

- **FormIR**: the model this spec defines; `irVersion` 1.
- **ParsedTemplate**: spec 01's result (`parseXsn`, design §5).
- **Field tree**: spec 01's `FieldTree` for the main schema or one secondary data source.
- **FormIR field**: one field-tree node of kind `field` or `richText`. **FormIR group**: one node of
  kind `group`. Both keep the spec 01 node's values unchanged.
- **Data path**: the location path of a field-tree node from its root, e.g.
  `/my:leaveRequest/my:employeeName`, using the prefixes in `Manifest.namespaces` (spec 01
  R21.1), or `{uri}local` for a namespace with no prefix there (spec 01 glossary "Path").
- **Data source**: `main`, or the `xsf:dataObject/@name` of a secondary source (`Locations`).
- **View scan**: reading a view's XSL as XML to list its bound controls, without running XSLT.
- **Bound control**: an element in view XSL with an `xd:binding` attribute.
- **Template context**: the data path a `xsl:template` runs on: its `match` for the template
  without `mode`, and for a moded template the context of the `xsl:apply-templates` that calls it
  plus that call's `select`.
- **ScreenTip**: a control's `title` attribute, which InfoPath shows on hover.
- **Label**: the text a person reads next to a field on the form. **Label source**
  (`labelSource`): which R5.1 step gave it: `title`, `cell`, `leftCell`, `checkboxText`,
  `columnHeader`, `schemaDisplayName`, `otherView` or `name`.
- **Repeating row**: the part of a view that InfoPath repeats per item: a moded `xsl:template`
  called from inside a table, or the body of an `xsl:for-each` inside a table (InfoPath marks
  its `tbody` with `xd:xctname="repeatingtable"`).
- **Expression**: an XPath string from the manifest: a rule `condition`, an action's `targetField`
  or `expression`, a dialog's expression text, a calculation's `target` or `expression`, a
  validation's `match`, `expressionContext` or `expression`, a submit value with
  `valueType="expression"`.
- **Expression context**: the node a relative path in an expression starts from (R11.2).
- **Location path**: an XPath 1.0 location path (XPath 1.0 §2), optionally starting with
  `xdXDocument:GetDOM("name")` or `current()`.
- **Reference**: one location path in an expression or view, resolved to a data path.
- **Dependency index**: for every FormIR field and group, the elements that read or write it.
- **Endpoint**: a host, URL, file path or connection string in a data connection or in
  `publishUrl`.
- **Liveness**: `internal` (R8.3), `package` (a file inside the template) or `unknown`. There is
  no `dead` in FormIR (decision 4).
- **InfoPath generation**: `2003`, `2007`, `2010`, `2013` or `unknown` (R2.2).
- **README table oracle**: `packages/core/test/oracles/readme-table.ts`, the
  `samples/own/README.md` table read as data (spec 01 R16.3).
- **Golden harness**: `packages/core/test/helpers/snapshot.ts` with `toMatchFileSnapshot`
  (spec 01 R16.4).
- **The 48 samples**: the 47 templates in `samples/own/xsn/` and the public sample.
- **Private corpus**: the 29 InfoPath-saved templates named by `AFTERLIFE_PRIVATE_SAMPLES` (spec 01
  R21.6). They never enter the repo, and no text from them is copied into it; only counts are.

## Evidence checked for this spec (2026-11-10)

Counted with throwaway Python 3 + lxml scripts kept outside the repo, over the 48 samples and the
spec 01 parser output for them (bundled with esbuild and run in Node 26.13, the `parseXsn` of
commit `f8582a3`). The tasks repeat every count below as a test.

- **Namespace prefixes.** Every expression uses prefixes (`my:`, `dfs:`, `tns:`). In all 48
  manifests, every namespace declaration is on the root element; in the private corpus, 1 of 29
  declares one prefix lower down (`xsf2`, used by no expression). Spec 01 R21.1 adds
  `Manifest.namespaces` (decision 1).
- **Views.** 53 views in 48 forms. 707 bound controls. Every view has exactly one template
  without `mode`; no moded template is called from more than one `xsl:apply-templates`. With the
  template-context rule, 707 of 707 bindings resolve to a field-tree node.
- **Generation evidence.** In-repo: `productVersion` is `15.0.0` in the 47 own forms and
  `11.0.6357` in the public sample. Private corpus (29 forms, read by the maintainer and re-counted
  by the agent): `11.0.5329` 3 and `11.0.6357` 1 (InfoPath 2003), `12.0.0` 10 (2007), `14.0.0` 2
  (2010), `15.0.0` 13 (2013). `solutionFormatVersion` varies on its own (`1.0.0.0`, `1.100.0.0`,
  `2.0.0.0`, `3.0.0.0`, `15.0.0.0`): a 2013-saved form can carry `2.0.0.0`. The folder a vendor
  put a template in does not prove its version. InfoPath 2013 was the last release.
- **Browser-compatible.** `runtimeCompatibility` contains `server` in form 43 only (1 of 48).
- **Form name.** All 48 manifests have `xsf:fileNew/xsf:initialXmlDocument/@caption`.
- **Fields.** 606 FormIR fields (kind `field` or `richText`) and 123 groups in the 48 main trees.
  587 fields have a bound control in the default view, 14 only in another view (forms 03, 05, 41,
  42), 5 in no view (form 44's three `approvers/Person` children, edited through the ActiveX
  control; the public sample's `field1` and `field2`).
- **Labels, in-repo** (forms 01–08 default views, 290 fields with a bound control; the human label
  is the one in `samples/own/screenshots/`, 98 of the 290 visible there, the rest read off the XSL,
  which uses the same three layouts):

  | Rule | Right | Wrong label | No guess |
  |---|---|---|---|
  | Brief AC2 as written: nearest preceding cell in XSL document order with text | 251 | 39 | 0 |
  | First draft: left cell, else checkbox text, else column header | 290 | 0 | 0 |
  | R5.1 order (ScreenTip first) | 290 | 0 | 0 |

  The brief rule's 39 wrong labels are 27 checkboxes and 12 repeating-table columns, which get
  the label of the cell above them in the XSL. **ScreenTips in our samples:** 704 of the 705 bound
  controls in forms 01–47 have a non-empty `title` (the one without is form 44's ActiveX object).
  A date picker's `title` sits on its outer `xd:xctname="DTPicker"` element, not on the inner part
  that carries `xd:binding`; the first draft missed that and said date pickers had none. In forms
  01–08 every `title` equals the human label. The public sample, the only view InfoPath itself
  saved, has `title=""` and gets `Date` and `Weight` from the left cell after the trailing colon
  is removed.
- **Labels, private corpus** (measured by the maintainer, 2026-11-10; counts only): the default
  views of 19 forms (the five 2013 Microsoft templates and the 14 non-Microsoft forms), 169
  top-level bound controls.
  - The brief rule returns a section heading for most fields of the Microsoft templates (10 of the
    12 fields of one of them).
  - The first-draft rule labels about 41 of the 169.
  - Four layouts occur: (1) the label in the control's own cell, before it, inline or in a block
    above it, throughout the Microsoft templates; (2) the label in the left cell; (3) no visible
    label, only the ScreenTip; (4) repeating tables built with `xsl:for-each` inside
    `tbody xd:xctname="repeatingtable"`, with the column headers in a row above.
  - A non-empty ScreenTip is on 86 of the 169 controls and is the better label where present: it
    tells apart two fields whose cells hold the same short word, gives the full wording where the
    cell holds a short form, and tells apart two checkboxes that share one cell (whose cell text is
    the same for both).
  - ScreenTip first, then same cell, then left cell: 86 `title`, 11 `cell`, 35 `leftCell`, 37 none.
    The 37 are mostly `for-each` repeating columns and fields bound to secondary sources or
    attributes, which R4.2 and R5.1 steps 5–6 now cover.
- **Private corpus, parser.** All 29 parse with 0 issues; the 348 unknown entries are modelled by
  spec 01 R21, which leaves 0. 2 of the 29 carry SharePoint `ma:displayName` on 77 schema
  elements (spec 01 R21.5), the input of R5.1 step 6.
- **Dependency extraction.** A tokenizer that implements XPath 1.0 §3.7 lexical rules (operator
  names after an operand, function calls, string literals, predicates) and groups location paths
  was run over every expression and view reference:

  | Source | Strings | References | Resolve to a field-tree node |
  |---|---|---|---|
  | Calculations (`target`, `expression`) | 40 | 49 | 49 |
  | Validations (`match`, `expression`; every `expressionContext` is `.`) | 88 | 98 | 98 |
  | Rule conditions, assignment `targetField`/`expression`, dialog text | 19 | 14 | 14 |
  | Submit values with `valueType="expression"` (3 e-mail `to`, 1 DAV file name) | 4 | 5 | 5 |
  | View `xd:binding` | 707 | 707 | 707 |
  | View `xsl:for-each/@select` starting with `GetDOM` (forms 03, 04) | 5 | 9 | 9 |
  | Absolute paths: `xmlToEdit` `item`/`container`, `domEventHandler/@match`, `listProperties` `node`, `signedDataBlock/@data` | 684 | 684 | 684 |
  | **Total** | 1,547 | **1,566** | **1,566** |

  A hand count of the 151 manifest expressions gives the same 166 references, so the miss rate on
  the samples is **0 of 166** for manifest expressions and 0 of 1,566 overall. This says little
  about real forms: our expressions are simple (`. = ""`, `xdMath:Nz(../my:x) * …`, `sum(…)`).
  Blind spots, with their sample counts:
  - a path inside a string argument, as in `xdMath:Eval(nodes, "expr")`: 0 in the samples, 12
    uses in the 71-form corpus (`docs/feature-coverage.md` D);
  - `GetDOM` with a non-literal argument: 0 (all 7 calls use a string literal);
  - variables (`$val`): 3 in views, each bound with `select` to a field that the same control
    already binds; not resolved;
  - conditional-formatting tests in views (`xsl:if`/`xsl:when`): 685 tests, 675 of them InfoPath's
    generated control-state pattern (`my:x = "v"` on the control's own field, or
    `function-available`); the other 10 refer only to fields bound in the same view, or to
    `$val`. Not scanned (spec 04);
  - `//`, `*` and axes other than `child`, `attribute`, `self` and `parent`: 0 in the samples.
- **Endpoints.** Form 04: `Data Source=sql-legacy01` (ADO), `http://forms-legacy/budget/…`
  (`wsdlUrl` and `serviceUrl`). Form 46: `folderURL` `http://forms-legacy/vendors/`. Form 03:
  `fileUrl="locations.xml"` (a package file). `publishUrl`: 45 forms `C:\forms\<slug>.xsn`, the
  public sample `D:\svn.commanigy.com\…`, forms 43 and 44
  `https://intranet.contoso-fictional.example/…`. `soapAction` is an identifier, not an endpoint.
  The SharePoint list adapters name their site in
  `siteUrl` (`sharepointListAdapter`) and `siteURL` (`sharepointListAdapterRW`), and a
  `xsf2:connectoid` its `.udcx` file in `source` (MS-IPFF2 5.1 and 5.2, via spec 01's
  `ms-ipff2.ts`).
- **ActiveX.** Form 44 `view1.xsl` has one `object class="xdActiveX"` with
  `classid="clsid:61e40d31-993d-4777-8fa0-19ca59b6d0bb"` and `xd:binding="my:approvers"`. No
  sample manifest has `xsf:allowedControl` (spec 01 R12.6).

## Requirements

### R1. Build FormIR from a parsed template
Traces: brief AC1 (the parts), brief summary ("never the raw manifest"); Added: purity and
runtimes (tech.md, spec 01 R17), expressions as strings (user instruction 2026-11-10).

As a developer, I want one model built from the parser's result, so the viewer, Triage, Studio and
Rovo agree on what a form contains.

1. WHEN given a `ParsedTemplate`, THE SYSTEM SHALL return a FormIR with `irVersion` 1 and the parts
   `meta`, `fields`, `groups`, `views`, `rules`, `calculations`, `validations`,
   `dataConnections`, `codeBehind`, `signatures`, `activeX`, `dependencies`, `unknowns` and
   `issues`, synchronously, with no network access and no input other than the `ParsedTemplate`
   (view XSL is read from its `files`, through core's `xml/` layer). Every element SHALL carry the
   spec 01 `source` (file, path, line, column) it came from. Oracle: the golden harness over the 48
   samples (R13.3), and the spec 01 lint restrictions (`test/lint/restricted.test.ts`) extended to
   the new module.
2. THE SYSTEM SHALL carry every expression as the exact string in the `ParsedTemplate`, and SHALL
   NOT rewrite, normalise or evaluate it. Oracle: for every sample, each FormIR expression string
   equals the spec 01 attribute or text it came from (a test that walks both).
3. THE SYSTEM SHALL return spec 01's `issues` unchanged, followed by the issues this spec adds, and
   SHALL NOT throw for any `ParsedTemplate` that `parseXsn` returned. Oracle: the 48 samples give
   zero FormIR issues; synthetic `ParsedTemplate`s (missing main schema, a view with broken XSL, an
   unresolved binding) give one issue each and a FormIR.
4. WHERE `AFTERLIFE_PRIVATE_SAMPLES` is set, THE SYSTEM SHALL build FormIR for every template in it
   with no throw, and the spec 01 local check (R21.6) SHALL also print, as counts only, the
   FormIR issue codes, the `meta.generation` values and the `labelSource` values. Oracle: run
   locally by the maintainer, compared with the Evidence section; CI skips it.

### R2. Form identity and generation
Traces: brief AC1 `meta`; brief 12 per-form metrics (name, URN, generation, browser-compatible).

As Quang (head of IT), I want each form's name, identity and InfoPath generation in the Triage, so
I can see what I own and how old it is.

1. THE SYSTEM SHALL set `meta.name` to `xsf:initialXmlDocument/@caption`, else to the form-name
   part of the URN; and `meta.urn`, `solutionVersion`, `productVersion`, `solutionFormatVersion`
   and `publishUrl` to the strings as written, absent when absent. It SHALL set
   `meta.browserCompatible` to true WHEN `runtimeCompatibility` contains `server`. Oracle: form 01
   name "Leave Request"; `browserCompatible` true for form 43 only of the 48.
2. THE SYSTEM SHALL keep `productVersion` and `solutionFormatVersion` as written, and set
   `meta.generation` from the major number of `productVersion` only: 11 → `2003`, 12 → `2007`,
   14 → `2010`, 15 → `2013`; any other value, or none, → `unknown`, with the raw value kept.
   `solutionFormatVersion` SHALL NOT change the generation. THE SYSTEM SHALL record the
   attribute's source path as evidence. Oracle: the public sample → `2003`, the 47 own forms →
   `2013`; unit cases `11.0.5329`, `12.0.0`, `14.0.0`, `15.0.0` with `solutionFormatVersion`
   `2.0.0.0`, `16.0`, `13.0` and absent; locally, the private corpus gives 2003 ×4, 2007 ×10,
   2010 ×2, 2013 ×13 (R1.4).

### R3. Fields and groups
Traces: brief AC1 `fields[]`, `groups[]`; brief 12 counts; Added: secondary sources (data
lineage, brief 09 AC1).

As Tim (form owner), I want every field with its path and type, so the X-ray shows the whole form
the way InfoPath's Fields pane did.

1. THE SYSTEM SHALL produce one FormIR field per field-tree node of kind `field` or `richText`, and
   one FormIR group per node of kind `group`, for the main tree and for each secondary tree, in
   tree order. Each SHALL have `id`, `dataSource`, `path` (data path), `name`, `kind`, `xsdType`,
   `required`, `repeating`, `optional`, `choiceGroup`, `groupId` (the nearest enclosing group, absent
   for the root), the XSD `default` and `fixed` values, and `source`, with values copied from the
   spec 01 node and never re-derived. Oracle: golden harness; form 04 `line` group repeating, form
   01 `reason` not required (spec 01 R14.8 values reappear unchanged).
2. THE SYSTEM SHALL write data paths with the prefixes in `Manifest.namespaces` (spec 01 R21.1),
   and `{uri}local` for a namespace with no prefix there; `id` SHALL be unique across all data
   sources of the form. Oracle: form 04's two secondary roots, both `dfs:myFields`, get different ids;
   every FormIR expression reference in the samples resolves to a FormIR id (R11.5).
3. THE SYSTEM SHALL give counts equal to the README columns Fields (main-tree element fields and
   groups, root included, attributes excluded) and Repeating/optional (main-tree fields and groups
   with `repeating` or `optional`). Oracle: the README table oracle, every row, plus the public
   sample's spec 01 R16.2 values (Fields 5, Repeating/optional 4).

### R4. Views and their bound controls
Traces: brief AC1 `views[]`; Added: the view scan, which brief AC2 (labels), AC3 ("views … that
read or write it"), brief 09 AC1 (lineage) and brief 12 (`activex` cause) all depend on. Spec 01
put "controls, `xd:binding`" in spec 03; decision 2 moves the static scan here.

As Tim, I want to see which view shows each field and what feeds each list, so I know what the
screen depended on.

1. THE SYSTEM SHALL produce one FormIR view per `xsf:view`, in document order, with `name`,
   `caption`, `xslFile` (the first `mainpane/@transform`), `isDefault` and `isPrint` (`printView`
   is `yes`). Oracle: the README Views column; form 05 has 3 views with `HR` the default; the
   spec 01 synthetic print-settings manifest gives `isPrint` true.
2. THE SYSTEM SHALL scan each view's XSL and record every bound control, in document order, with
   its view, `xd:xctname`, `xd:CtrlId`, the binding as written, its source line, and the FormIR id
   it resolves to. A binding SHALL be resolved against its template context and the `select` of
   every enclosing `xsl:for-each`; `.`, `..`, `@name`, child steps and a leading
   `xdXDocument:GetDOM("name")` (a control bound to a secondary source) SHALL be supported. A date
   picker's binding sits on its inner `DTPicker_DTText` part; that part is the control. Several
   controls may bind one field (option buttons); each is recorded. Oracle: 707 of 707 bindings in
   the 53 sample views resolve, 0 issues; form 02's `my:amount` resolves to
   `/my:expenseClaim/my:expenses/my:expense/my:amount`.
3. IF a binding does not resolve to a field-tree node, or its template is never reached from the
   template without `mode`, or a moded template is called from more than one place, THEN THE
   SYSTEM SHALL keep the control with its raw binding, resolve against every call site found, and
   record an `UNRESOLVED_BINDING` issue with the view and line. IF a view's XSL is missing, is not
   well-formed, or is refused by the `xml/` layer, THEN THE SYSTEM SHALL record an issue for that
   view and scan the others. Oracle: synthetic views.
4. WHEN a bound control contains an `xsl:for-each` whose `select` starts with
   `xdXDocument:GetDOM("name")`, THE SYSTEM SHALL record on that control `choicesFrom`: the data
   connection of data object `name`, the path as written, and the FormIR fields that path's
   predicates refer to. Oracle: form 03 `destCountry` from `Locations`, `destCity` from
   `Locations` filtered by `destCountry`; form 04 `vendorId` from `Vendors` (the ADO connection).
5. THE SYSTEM SHALL record every view element with `class="xdActiveX"` or a `classid` attribute in
   `FormIR.activeX`, with its `classid`, view, line and resolved binding, together with each
   manifest `xsf:allowedControl` (`clsid`, `cabFile`). Oracle: form 44, one control
   `clsid:61e40d31-993d-4777-8fa0-19ca59b6d0bb` bound to the `approvers` group; the spec 01
   synthetic `allowedControl` fixture.

### R5. Label guess
Traces: brief AC2, with the rule replaced (decisions 3 and 7; Evidence "Labels").

As Tim, I want each field to carry the label people saw on the form, and to see where it came
from, so the converted question and the X-ray use words people know instead of `my:claimantDept`.

1. THE SYSTEM SHALL label a FormIR field from its first bound control in the default view by the
   first of these steps that gives non-empty text, and set `labelSource` to the step's name:
   1. `title`: the control's non-empty ScreenTip, or that of the composite control around its
      bound part (a date picker's `DTPicker` element);
   2. `cell`: text in the control's own table cell before it, back to the previous bound control
      in that cell or the cell's start, inline or in a block above it;
   3. `leftCell`: the cell to the left in the same row, when it holds no bound control;
   4. `checkboxText`: for a `CheckBox`, text after it in its own cell, up to the next bound
      control;
   5. `columnHeader`: for a control in a repeating row (a moded template or an `xsl:for-each`),
      the cell at the same column index in the table's header row, the first row outside the
      repeated part;
   6. `schemaDisplayName`: the field's `sharePoint.displayName` (spec 01 R21.5);
   7. `otherView`: steps 1–5 in the other views, in manifest order;
   8. `name`: the field name in Title Case (split at `_`, `-`, `.` and lower-to-upper changes; each
      word capitalised; runs of capitals kept).

   Text means literal text and `xsl:text`, without other XSL instructions and without bound
   controls. Groups always use step 8. For a field bound to option buttons, THE SYSTEM SHALL take
   steps 1–3 and 5 from the first button only, skip step 4, and keep each button's own text as
   that choice's label on its bound control record (R4.2), with the button's value (decision 11). Oracle: forms 01–08 default views, 290 of 290 equal the
   human label (98 checked against the screenshots); over the 606 fields of the 48 samples,
   `labelSource` is `title` 585, `leftCell` 2 (the public sample), `otherView` 14 and `name` 5
   (form 44's three `Person` children; the public sample's `field1` and `field2`). These four
   numbers are derived from the control counts in Evidence, and a test counts them.
2. THE SYSTEM SHALL collapse whitespace in a label and remove one trailing colon. Oracle: the public
   sample gives `Date` and `Weight`.
3. THE SYSTEM SHALL record `labelEvidence` on every field: the step, and for steps 1–5 and 7 the
   view, file and line of the text used, so the viewer can say where a label came from. Oracle:
   golden harness.
4. THE SYSTEM SHALL have one synthetic view per layout, written for this project in our own
   wording, each with the expected label and `labelSource`: a ScreenTip that differs from the cell
   text; inline text before the control; a block above the control in the same cell; a left
   cell; no visible text but a ScreenTip; two checkboxes in one cell, with and without ScreenTips;
   a repeating table by moded template; a repeating table by `xsl:for-each` in
   `tbody xd:xctname="repeatingtable"`; a field with only `ma:displayName`; a field shown only in a
   second view; a field with no label anywhere; two option-button groups in one view, one labelled
   by its left cell and one by the first button's ScreenTip, with empty ScreenTips on the other
   buttons, where each button's text becomes its choice label and never the field label. Oracle:
   `labels.test.ts` over those fixtures; locally, the private-corpus `labelSource` counts (R1.4),
   which the maintainer compares with the Evidence table.

### R6. Rules
Traces: brief AC1 `rules[]`; brief 12 counts.

As Tim, I want every rule with what triggers it, so I can see what used to happen and when.

1. THE SYSTEM SHALL produce one FormIR rule per `xsf:rule`, in document order, with `id`,
   `ruleSet`, `caption`, `condition`, `enabled` (false only when `isEnabled` is `no`),
   `stopProcessing` (`xsf:exitRuleSet` present), and `actions` in order, each with its kind, all
   attributes as written and its dialog text. Oracle: README Rules column; 9 rules in 8 rule sets
   in 5 forms (spec 01 R9.6).
2. THE SYSTEM SHALL give each rule `triggers`: one entry per `xsf:ruleSetAction` that runs its rule
   set, as `fieldChange` (with the FormIR id of `domEventHandler/@match`), `onLoad`, `submit` or
   `button` (with view and button name); a rule set that nothing runs SHALL have `triggers: []`.
   Oracle: 8 triggers: 2 `onLoad` (forms 01, 07), 1 `fieldChange` on form 03 `destCountry`, 5
   `button` (2 in form 04, 3 in form 05).

### R7. Calculations and validations
Traces: brief AC1 `calculations[]`, `validations[]`; brief 12 counts.

As Lan (form filler), I want every check kept with its exact message, so the X-ray shows what
stopped me before.

1. THE SYSTEM SHALL produce one FormIR calculation per `xsf:calculatedField` with `id`, the FormIR
   id of `target`, `expression` and `refresh`. Oracle: README Calcs column; 1 in the public sample.
2. THE SYSTEM SHALL produce one FormIR validation per `xsf:errorCondition` (`kind: errorCondition`)
   and per `xsf3:errorBlank` (`kind: blank`), with `id`, the FormIR id of `match`,
   `expressionContext`, `expression`, and the message `type`, `shortMessage` and text verbatim.
   Oracle: README Checks column (errorCondition only); form 01 `endDate` has 2 validations; the
   spec 01 synthetic `errorBlank` fixture.

### R8. Data connections and endpoint classification
Traces: brief AC1 `dataConnections[]`, AC4; brief 12 causes `internal-sql`, `internal-service`;
Added: credential redaction (tech.md security rules: FormIR goes to Rovo and MCP), `package`.

As Mai (IT admin), I want every connection with an `internal` badge where the file proves the host
is private, so I can see which ones cannot work from the cloud.

1. THE SYSTEM SHALL produce one FormIR data connection per adapter in `ParsedTemplate`
   (`xsf:dataObject` query, the main query, `xsf:submit` adapters, `xsf:dataAdapters`), with `id`,
   `name`, `adapterKind`, `dataSource` (the data object name, when it has one), `isSubmit`,
   `isQuery`, all attributes and child values as written, and `endpoints[]`. Oracle: form 04 has 2
   query connections (`adoAdapter`, `webServiceAdapter`); forms 01, 02, 07 an `emailAdapter`
   submit; form 44 `submitToHostAdapter` (no endpoint); form 46 `davAdapter`.
2. THE SYSTEM SHALL record as an endpoint, with the attribute it came from, the extracted host and
   its liveness: `wsdlUrl`, `serviceUrl`, `fileUrl`, `folderURL`, `siteUrl`
   (`sharepointListAdapter`), `siteURL` (`sharepointListAdapterRW`), `connectoid/@source`,
   the `Data Source`, `Server` or `Address` value of an ADO `connectionString` (dropping
   `\instance`, `,port` and `tcp:`), and `meta.publishUrl`. `soapAction` and e-mail values are
   not endpoints. Oracle: form 04 gives hosts `sql-legacy01` and
   `forms-legacy` (twice); the spec 01 synthetic SharePoint adapters give their site hosts.
3. THE SYSTEM SHALL set liveness `internal` WHEN the host is a single-label name, `localhost`, a
   name ending in `.internal`, `.localhost`, `.local` or `.home.arpa`, a private or loopback IPv4
   address (`10/8`, `172.16/12`, `192.168/16`, `127/8`, `169.254/16`) or IPv6 address (`::1`, `fc00::/7`,
   `fe80::/10`), `(local)` or `.` in a connection string, or WHEN the endpoint is a file path (drive
   letter, UNC `\\host\…`, `file:` URL); `package` WHEN it is a relative name of a file in the
   template; `unknown` otherwise. THE SYSTEM SHALL NOT make a network call and SHALL NOT produce
   `dead`. Oracle: form 04 3 × `internal`, form 46 `internal`, form 03 `locations.xml` `package`,
   46 `publishUrl`s `internal` (45 `C:\`, 1 `D:\`), forms 43 and 44 `publishUrl` `unknown`; unit
   cases for every rule and its boundary (`172.15.0.1` and `172.32.0.1` are `unknown`).
   Added (decision 9): `.localhost`, `.local`, `.home.arpa` (RFC 6761, 6762, 8375 reserve them
   for local use) and `.internal` (ICANN Board, 2024-07-29, reserved permanently for private use;
   checked 2026-11-10).
4. WHEN an ADO `connectionString` contains `Password=` or `Pwd=`, THE SYSTEM SHALL replace each
   such value with `***` in FormIR and set `credentialRedacted: true` on the connection, so Triage
   and the X-ray can report an embedded password as a finding (decision 5). Oracle: the spec 01
   R11.5 unit cases: the value is redacted and the flag set; every sample has
   `credentialRedacted: false`.
   Changed at task 7: a secret is now the value of any key that, compared case-insensitively, is
   `password` or `pwd` or ends in whitespace or `:` followed by one of them (so `Jet OLEDB:Database
   Password` and `Jet OLEDB:New Database Password` of Access connection strings count), with the
   whitespace around the value kept; and the password of a URL userinfo (`http://user:***@host/…`,
   the user name kept, the URL never re-serialised). This applies to every connection attribute,
   and spec 01's `containsCredential` gives the same answer (one implementation,
   `src/xsf/credentials.ts`; one shared test, `test/xsf/credentials.test.ts`). The first version
   missed both Jet keys and URL userinfo, and dropped the space after `=` in `PWD = xyz`.

### R9. Code-behind and signatures
Traces: brief AC1 `codeBehind`, `signatures`; brief 12 causes `code-behind` ("listed with the
event names it handled") and `signatures`.

As the auditor, I want the code and signatures listed with the fields they touch, so the death
certificate can name them.

1. THE SYSTEM SHALL set `codeBehind.present` WHEN the template has `xsf2:managedCode`, `xsf:scripts`
   or a spec 01 code file, with `language` values, `files` (spec 01 `codeFiles` and script `src`),
   and `handlers`: each `domEventHandler` with a `handlerObject`, as the FormIR id of its `match`
   and the handler name. Oracle: form 46 present, `CSharp`, no files; form 47 JScript, `script.js`, 2
   handlers (`assetTag`, `returnDue`); the other 46 forms not present.
2. THE SYSTEM SHALL list each `xsf:signedDataBlock` with `name`, `mode`, its `message` and the FormIR
   id of `data`, and each `xsf3:signatureLine`. Oracle: form 45, one countersigned block on the root
   group; the spec 01 synthetic signature-line fixture.

### R10. Unknown entries carried over
Traces: brief AC1 `unknowns[]` (spec 01 R13).

As Tim, I want every part of the template the parser did not understand to stay visible, so
nothing disappears between the file and Jira.

1. THE SYSTEM SHALL set `FormIR.unknowns` to spec 01's `unknowns`, deep-equal, in the same order,
   with every field (`kind`, `reason`, `file`, `path`, `namespace`, `name`, `line`, `column`, `raw`,
   `documented`). Oracle: 0 entries for the 48 samples; the spec 01 synthetic manifests and schemas
   with unknown entries (`test/fixtures/synthetic/`) give deep-equal lists.

### R11. Dependency index
Traces: brief AC3; brief 06 S2 and brief 09 AC1 (dependency map, data lineage).

As Tim, I want to select a field and see every rule, calculation, check, view and connection that
uses it, so I can change a form without breaking something I cannot see.

1. THE SYSTEM SHALL find references with a tokenizer, not an XPath parser: it SHALL split an
   expression into XPath 1.0 tokens (string literals, numbers, names, operators, with the §3.7
   rule that a name or `*` after an operand is an operator), and take each maximal location path,
   including paths in predicates and paths after `xdXDocument:GetDOM("name")` or `current()`.
   Function names, node-type tests and literals are not references. Oracle: unit cases (`div`,
   `mod`, `and` as operators and as element names, `*` as multiply and as a wildcard, a path in a
   string literal, nested predicates); every manifest expression of the samples gives the 166
   references counted by hand (Evidence).
2. THE SYSTEM SHALL resolve a relative path against its expression context: a calculation's
   `target`; a validation's `match` followed by its `expressionContext`; for a rule and its
   actions, the field of a `fieldChange` trigger, else the main root; for a submit value, the main
   root; for a view reference, its template context. A rule run from several triggers SHALL be
   resolved once per distinct context. `current()` is the expression context; a path after
   `GetDOM("name")` belongs to data source `name`. Oracle: form 03 `../my:destCity` resolves to
   `/my:travelRequest/my:destCity`; form 04 `GetDOM("BudgetService")/…/tns:costCenter` to the
   `BudgetService` tree.
3. THE SYSTEM SHALL give every FormIR field and group `dependencies.readBy` and
   `dependencies.writtenBy`, each a list of `{ elementId, role }` in a fixed order: rule conditions,
   action expressions and dialog text read; assignment `targetField` writes; calculation
   `expression` reads and `target` writes; validation `match` and `expression` read; view bindings
   read and write; `choicesFrom` predicates read; submit values read; code handlers read
   (`match`); `fieldChange` triggers read (the handler's `match`); signed data blocks read
   (`data`) and write (`signatureLocation`). A data connection SHALL list the fields of its data
   source that are read or written, so the UI can show lineage. Oracle: form 04 `grandTotal` is
   written by one calculation and its control in the view `Request`, and read by 2 rule
   conditions, 1 dialog action and that control; form 03 `destCountry` is read by a validation, the `destCity` `choicesFrom`
   predicate, the `clearCity` trigger and both views.
   Changed at task 10: a bound control reads and writes, so `grandTotal`'s control is in both
   lists (design §5 notes); the text said "written by one calculation". Signed data blocks gained
   the write role `signatureLocation` (review decision 1), which brings the Evidence row
   "Absolute paths" to 684 (`signatureLocation` was counted there but not named).
4. IF a location path cannot be resolved to one field-tree node (a variable, `//`, `*`, an axis
   other than `child`, `attribute`, `self` or `parent`, a `GetDOM` argument that is not a string
   literal, `..` above the root, a path not in the tree), or a string argument holds an expression
   (`xdMath:Eval`), THEN THE SYSTEM SHALL keep the path text on the element's `unresolvedRefs`
   with its reason and record an `UNRESOLVED_REFERENCE` issue. A prefix missing from
   `Manifest.namespaces` is one such reason. A reference SHALL never be dropped
   silently. Oracle: unit cases, one per reason; 0 such entries and issues in the 48 samples.
5. THE SYSTEM SHALL resolve every reference in the 48 samples to a FormIR field or group. Oracle:
   1,566 of 1,566 references (Evidence table), counted by a test over the samples; per-form golden
   files hold the index.

### R12. Property P13: the dependency index is complete
Traces: brief "Dependency index completeness" property. P1–P11 are in testing.md and spec 01 took
P12, so this takes P13.

1. For any expression generated from the data paths of a sample's field tree (absolute, relative to
   a chosen context, with `..`, in predicates, after `GetDOM("name")` for a secondary source),
   combined with XPath operators, InfoPath and XPath function calls, numbers and string literals
   that contain path-like text, THE SYSTEM SHALL list every inserted field in that field's
   `readBy` for the element holding the expression, and SHALL list no field that was only inside a
   string literal. At least 500 runs in CI, failing seeds kept as regression cases.

### R13. Stable JSON
Traces: brief AC5; brief user story (Tim diffs two template versions as text).

As Tim, I want two versions of my template to give FormIR files I can diff line by line, which
InfoPath never allowed.

1. THE SYSTEM SHALL serialise FormIR as JSON with object keys sorted, arrays in document order, no
   `undefined`, no non-finite numbers, two-space indentation and a final newline. The same input
   bytes SHALL give byte-identical JSON in Node 22 and in a Web Worker. Oracle: the spec 01
   Worker-parity harness (`test/browser/worker-parity.browser.test.ts`) run on FormIR JSON for the
   48 samples.
2. THE SYSTEM SHALL derive every id from the template alone: a field or group id from its data
   source and data path; every other id from its element kind and spec 01 source path. Ids SHALL be
   unique within a FormIR, and no id SHALL depend on time, randomness or parse order. Oracle: every
   sample built twice gives equal JSON; uniqueness checked over the 48 samples; form 01 and form 07
   (same fields, one added) share the ids of their common fields.
3. THE SYSTEM SHALL have a golden FormIR JSON file for every README form and the public sample.
   Oracle: the golden harness, `toMatchFileSnapshot`, one file per sample.

### R14. Property P6: FormIR JSON round trip
Traces: brief P6.

1. For every one of the 48 samples, and for any FormIR produced by a fast-check generator of the
   FormIR types, `parseFormIR(serialiseFormIR(ir))` SHALL deep-equal `ir`, and
   `serialiseFormIR(parseFormIR(s))` SHALL equal `s`. IF the JSON is not a FormIR, THEN
   `parseFormIR` SHALL throw `AfterlifeError` `INVALID_IR` with the JSON path; IF `irVersion` is not
   1, THEN `UNSUPPORTED_IR_VERSION`. At least 500 generated runs in CI.

### R15. Performance
Traces: Added (tech.md budget "parse one .xsn in under 300 ms (p95, Node)"; the view scan adds XSL
parsing, up to 171 KB for form 08).

As Mai, I want a folder of templates to triage in minutes, so FormIR must not become the slow step.

1. THE SYSTEM SHALL run `parseXsn` followed by building FormIR in under 300 ms at p95 over at least
   20 runs for each of the 48 samples on Node 22, and the view XSL read by the scan SHALL count
   against a limit (`viewXmlBytes`, default 4 MiB, overridable) whose overrun is an issue that
   skips the remaining views. Oracle: the spec 01 perf harness (`test/perf/`); form 08 reported
   separately. [VERIFY: not measured yet; spec 01 gives 6.37 ms p95 for form 08 without views.]

## Traceability

| Brief item | Requirements |
|---|---|
| AC1 `irVersion`, `meta` | R1.1, R2 |
| AC1 `fields[]`, `groups[]` | R3 (label guess R5) |
| AC1 `views[]` | R4.1 (scan R4.2–R4.5, decision 2) |
| AC1 `rules[]` | R6 |
| AC1 `calculations[]`, `validations[]` | R7 |
| AC1 `dataConnections[]` | R8 (`credentialRedacted`, decision 5) |
| AC1 `codeBehind`, `signatures` | R9 |
| AC1 `promotedFields[]` | moved to spec 05 (decision 6a) |
| AC1 `unknowns[]` | R10 |
| AC1 default value | R3.1 (XSD only; `template.xml` moved, decision 6c) |
| AC1 liveness (`unknown`, `dead`, `internal`) | R8.3 (`internal`, `package`, `unknown`; `dead` moved, decision 4) |
| AC2 label guess | R5 (rule replaced, decisions 3 and 7) |
| AC3 dependency index | R11 |
| AC4 `internal` endpoints, no network | R8.2–R8.3 (`.internal` added, decision 9) |
| AC5 stable JSON, deterministic ids | R13 |
| P6 round trip | R14 |
| Dependency index completeness | R12 (P13) |
| User story: diff template versions | R13 |
| Out of scope: editing FormIR | Introduction |
| Depends on spec 01 R21 | R3.2, R5.1 step 6, R11.4 (`Manifest.namespaces`, `FieldNode.sharePoint`) |
| Added | R1.2–R1.4, R4.2–R4.5, R8.4, R15; `activeX` (R4.5) for brief 12 cause `activex` |

## Decisions (2026-11-10)

Decisions 1–10 answer the first draft; 11–14 answer revision 2.

1. `Manifest.namespaces` is added to spec 01 first (spec 01 R21.1, tasks 29–34, with the other
   real-file fixes).
2. Spec 02 owns the static view scan (R4.2–R4.5); spec 03 only renders.
3. The label rule is the eight-step order of R5.1, with `labelSource` and `labelEvidence`.
4. No `dead` in FormIR.
5. Passwords in connection strings are redacted, with `credentialRedacted: true` (R8.4).
6. The scope moves in the Introduction are approved.
7. A non-empty ScreenTip is the first label source.
8. Generation from the `productVersion` major number (R2.2); raw values kept.
9. `.internal`, `.local`, `.localhost` and `.home.arpa` hosts are `internal` (R8.3).
10. The Node and Web Worker JSON parity check stays (R13.1).

11. Option buttons (answer to open question 2): the one real form with option buttons has
    `title=""` on every button, and each button's text is a choice label. The field takes steps
    1–3 and 5 from its first button, skips step 4, and keeps each button's text as that choice's
    label (R5.1, fixture in R5.4).
12. The private folder variable is `AFTERLIFE_PRIVATE_SAMPLES`, as in steering (R1.4, spec 01
    R21.6).
13. Publish paths in `xsf2:solutionPropertiesExtension`, `xsf3:solutionMode` and
    `xsf:taskpane/@href` are not endpoints in FormIR.
14. The spec 01 out-of-scope line now gives the static view-XSL scan to spec 02 and rendering to
    spec 03 (spec 01 requirements, `Changed:` note); briefs 02 and 03 were edited by the
    maintainer (`88e05c3`).

## Open questions

None open. The four questions of revision 2 are answered by decisions 11–14.
