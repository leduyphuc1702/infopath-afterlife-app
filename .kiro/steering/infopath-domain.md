---
inclusion: fileMatch
fileMatchPattern: ["packages/core/**", "apps/**/classic/**"]
---

# InfoPath domain knowledge

## .xsn container
- A Microsoft Cabinet file (signature `MSCF`).
- All 29 third-party samples (not in the repo) and all 47 in `samples/own/` use **MSZIP**: each CFDATA block starts with `CK`, followed by a raw deflate stream. The deflate history carries over between blocks inside one folder, so use one inflater per folder.
- LZX and Quantum are possible in theory. Reject them with `UNSUPPORTED_COMPRESSION`.
- Typical contents:
  - `manifest.xsf`: the form definition.
  - `myschema.xsd`: the main schema; there may be more `*.xsd` files.
  - `view1.xsl` … `viewN.xsl`: XSLT 1.0 views.
  - `template.xml`: default data.
  - `sampledata.xml`: sample values.
  - `upgrade.xsl`: transforms old data to the current schema.
  - Images, and optionally `*.dll` (managed code) or `*.js`/`*.vbs` (script).

## manifest.xsf essentials (namespace `http://schemas.microsoft.com/office/infopath/2003/solutionDefinition`, plus xsf2/xsf3 extensions)
- The authoritative vocabulary is the XSDs in Microsoft's public [MS-IPFF2] sections 5.1 (xsf), 5.2 (xsf2) and 5.3 (xsf3). All 48 in-repo manifests (forms 01–47 and the public sample) conform to them (checked 2026-11-10; forms 43–47 were generated to match them and never opened in InfoPath).
- `xsf:xDocumentClass`: root. Attributes `name` (the URN), `solutionVersion`, `productVersion`, `solutionFormatVersion`, `publishUrl` (often a hard-coded local path or server), `trustSetting`, and optionally `trustLevel` and `requireFullTrust`. `trustLevel` is absent from all 47 own forms (they carry `trustSetting="automatic"`); the 2004 public sample has `trustLevel="restricted"`.
- `xsf:views/xsf:view`: name, `xsf:mainpane transform="view1.xsl"`, menus and toolbars, `xsf:unboundControls`.
- `xsf:documentSchemas`: root schema location.
- `xsf:fileNew/xsf:initialXmlDocument`: `template.xml`.
- `xsf:ruleSets/xsf:ruleSet/xsf:rule`: attributes `condition` (XPath), `caption`, `isEnabled`. "Stop processing rules" is not an attribute: it is an empty child element `xsf:exitRuleSet` after the actions (MS-IPFF2 2.2.1.2.114). Rule sets run from `xsf:ruleSetAction`, whose parent is the trigger: `xsf:domEventHandler`, `xsf:onLoad`, a button, or `xsf:submit`. Actions:
  - `xsf:assignmentAction` (`targetField`, `expression`);
  - `xsf:dialogBoxMessageAction`, `xsf:dialogBoxExpressionAction`;
  - `xsf:switchViewAction`;
  - `xsf:queryAction`;
  - `xsf:submitAction`;
  - `xsf:openNewDocumentAction`;
  - `xsf:closeDocumentAction`;
  - also `xsf:changeAdapterProperty`, `xsf:webPartConnectionAction`, `xsf:signSignatureLineAction` (MS-IPFF2 2.2.1.2.114). There is no `containmentAction`.
- `xsf:domEventHandlers`: links a field to a ruleSet (rules run on change), or to code.
- `xsf:calculations/xsf:calculatedField`: `target`, `expression`, `refresh="onChange|onInit"`.
- `xsf:customValidation/xsf:errorCondition`: `match`, `expressionContext`, `expression` (error when true), `showErrorOn`, `xsf:errorMessage` (`type="modeless|modal"`, `shortMessage`). InfoPath 2010+ adds `xsf3:customValidation/xsf3:errorBlank` (`match`, `expression`, `expressionContext`; MS-IPFF2 2.2.3.2.18) for "cannot be blank". There is no `requiredCondition` element.
- `xsf:dataObjects/xsf:dataObject`: secondary data sources, with adapters:
  - `xsf:xmlFileAdapter`;
  - `xsf:adoAdapter` (SQL);
  - `xsf:webServiceAdapter`;
  - `xsf:sharepointListAdapter` and `xsf:sharepointListAdapterRW` (both in the `xsf` namespace, spelled as in the MS-IPFF2 5.1 XSD; the 2.2.1 element index writes `sharePointListAdapterRW`);
  - `xsf:davAdapter`;
  - `xsf:emailAdapter`;
  - `xsf:submitToHostAdapter`.
- `xsf:submit`: main submit configuration.
- `xsf:listProperties`: fields promoted to SharePoint columns. These map to Jira fields and entity properties.
- `xsf:editing/xsf:xmlToEdit`: controls such as `xTextList`, `xCollection` (repeating). `xsf:fragmentToInsert` holds the XML inserted by "Insert item".
- `xsf:signedDataBlocks`: digital signature sets.
- `xsf:extensions` / `xsf2:solutionDefinition` / `xsf3:solutionDefinition`: browser-compatibility mode, list form settings, `xsf3:baseUrl`.

## View XSL conventions
- **Controls** are elements with:
  - `xd:xctname` (PlainText, RichText, DTPicker, dropdown, combobox, CheckBox, OptionButton, ExpressionBox, Button, Section, RepeatingSection, RepeatingTable, FileAttachment, InlineImage, ListBox, PeoplePicker, Hyperlink, …);
  - `xd:binding` (XPath relative to the current context);
  - `xd:CtrlId`;
  - `xd:boundProp` (e.g. `xd:num`, `value`);
  - class names `xdTextBox`, `xdDTPicker`, `xdRepeatingTable`, `xdSection`, `xdBehavior_*`.
- **Extension namespaces and functions to shim:**
  - `xdFormatting:formatString(value, type, options)`: number, currency, percentage, date, time and datetime formatting; the most-used extension function (556 uses across the 71-form corpus, `docs/corpus-facts.md`).
  - `xdXDocument:GetDOM("dataSourceName")`: returns a secondary DOM.
  - `xdImage:getImageUrl(base64)`.
  - `xdXDocument:GetNamedNodeProperty(node, name, default)`.
  - `xdDate:Today()`, `xdDate:Now()`.
  - `xdMath:Avg(nodes)`, `xdMath:Nz(nodes)`, `xdMath:Eval(nodes, expr)`.
  - `xdMath:Min`, `xdMath:Max`, `xdDate:AddDays`, `xdDate:AddSeconds` (3 uses each, all in the third-party part of the corpus).
  - `xdUser:get-UserName()`.
- Views re-render after each data change. Conditional formatting appears as `xsl:if`/`xsl:choose` blocks around `style` or `class` attributes.

## Rule and calculation functions (XPath 1.0 + InfoPath)
- **XPath 1.0:** `sum`, `count`, `concat`, `contains`, `starts-with`, `substring`, `substring-before`, `substring-after`, `string-length`, `normalize-space`, `translate`, `number`, `boolean`, `not`, `floor`, `ceiling`, `round`.
- **InfoPath additions:** `today()`, `now()`, `addDays(date, n)`, `addSeconds(dateTime, n)`, `nz(node)`, `eval(context, expr)`, `min(nodes)`, `max(nodes)`, `avg(nodes)`, `userName()`.

## Field and control frequency in 29 third-party samples (deduped versions; not in the repo; counts over all 71 forms are in `docs/corpus-facts.md`)
| Control | Occurrences / forms |
|---|---|
| PlainText | 130 / 19 |
| Button | 39 / 12 |
| dropdown | 17 / 6 |
| ExpressionBox | 17 / 3 |
| DTPicker | 16 / 8 |
| CheckBox | 11 / 2 |
| OptionButton | 11 / 1 |
| RichText | 10 / 5 |
| Section | 9 / 6 |
| RepeatingTable | 8 + 6 |
| RepeatingSection | 6 / 6 |
| combobox | 1 |
| FileAttachment | 1 |
| ActiveX GUID control | 1 |

| Manifest element | Count |
|---|---|
| ruleSetAction | 23 |
| closeDocumentAction | 16 |
| submitAction | 12 |
| assignmentAction | 7 |
| switchViewAction | 4 |
| calculatedField | 13 |
| errorCondition | 5 |
| customValidation | 4 |
| domEventHandler (code) | 3 |
| signedDataBlock | 1 |

## Filled record (.xml) header
```
<?mso-infoPathSolution solutionVersion="1.0.0.123" productVersion="15.0.0" PIVersion="1.0.0.0" href="http://server/lib/Forms/template.xsn" name="urn:schemas-microsoft-com:office:infopath:Name:-myXSD-2005-01-01T00-00-00" ?>
<?mso-application progid="InfoPath.Document" versionProgid="InfoPath.Document.3"?>
```
Match a record to its template by the `name` URN first, and by `href` second. If `solutionVersion` is older than the template, apply `upgrade.xsl`.

## Mapping table (InfoPath → JSM)
Use `docs/feature-coverage.md`. Every element must be classified Native, Emulated (labelled "App"), Manual or Unsupported, with a human-readable reason.

## Traps verified against real InfoPath 2013 (2026-11-04)

These were found by generating 42 templates and opening every one of them in InfoPath Filler
2013 on Windows 11. Treat them as facts about the format, not opinions:

- **The `name` URN may not contain spaces.** `urn:schemas-microsoft-com:office:infopath:IT Access
  Request:-myXSD-...` is rejected with "The following URN identifying the form template is either
  missing or not valid". Strip or replace spaces when deriving a URN from a form title.
- **`xdMath:Round()` does not exist.** Use the XPath `round()` function. An unknown extension
  function fails the whole view at load time, not at fill time.
- **`xdMath:Nz()` takes a node-set.** Passing a number (`Nz(sum(a) div count(b))`) throws
  "Type mismatch … call to property or method 'Nz'". Assign the expression to a calculated field
  and pass that field's node-set instead.
- **A view that uses a secondary data source must declare that source's namespace prefixes on its
  own `xsl:stylesheet`.** Otherwise the view fails with "the view file is not valid", even though
  the same prefixes are declared in the manifest.
- **Views are fragile when crowded.** One view combining three sections (one of them optional),
  rich text and a view-switch button produced "Catastrophic failure" on load. Split it.
- **A record resolves its template by solution `name` before `href`.** After rebuilding a template
  with the same name, InfoPath silently keeps the cached copy in
  `%LOCALAPPDATA%\Microsoft\InfoPath\FormCache4`. Any test harness must clear that folder between
  runs, or it will validate the previous build.
- **Duplicate element names across complex types in `myschema.xsd`** are rejected. Rename one.
- **`mso-infoPathSolution` `name=` and the manifest `xDocumentClass@name` must match exactly**,
  including case.

