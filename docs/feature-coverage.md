# Feature coverage: every InfoPath capability we know of, and where it lands

The rule for this project is that a form which worked in InfoPath must not do less in Afterlife.
That is easy to say and easy to fake, so this file does two things instead: it lists the
capabilities, and every row carries a number from the corpus or a pointer to a spec. If a row has
neither, it is a guess and is marked as one.

Numbers come from `facts.json` (`python3 facts.py`), run over 71 unpacked templates: our 42 MIT
samples (forms 01–42; forms 43–47 came later and are not counted) plus 29 real third-party forms. The script and its output live in a research workspace
outside this repo, because 29 of the inputs may not be redistributed (`docs/SAMPLE-LICENSES.md`).
The spec 01 parser will reproduce the counts for the in-repo samples (`samples/own/`,
`samples/public/`); the third-party share can only be re-counted where `AFTERLIFE_PRIVATE_SAMPLES`
is set. Note the skew: 42 of the 71 were
written for this project, so the distribution describes our test set as much as the market.
What it does prove is that the parser and renderer are exercised by every row marked with a
count above zero.

Coverage classes:

- **Native** — becomes a real Jira/JSM feature. The form keeps working without us.
- **App** — we emulate it, and it keeps working only while the app is installed.
- **Manual** — we cannot carry it; we explain what to build instead (Automation, approvals, assets).
- **Unsupported** — deliberately out of scope, with a named reason.

Status column: `spec N` means a spec brief covers it. `parsed: spec 01` means the spec 01 parser
extracts that input from the `.xsn` and a test proves it (`.kiro/specs/01-xsn-parser/verification.md`);
the coverage state is still the owning spec's to deliver, and nothing past the parser is
implemented yet. "Synthetic fixture only" means no in-repo form uses it, so a hand-written
manifest is the evidence.
`ir: spec 02` means FormIR carries that input, with the label, dependency index, data lineage and
endpoint liveness built from it, and a spec 02 test proves it
(`.kiro/specs/02-form-ir/verification.md`). These are the inputs of the X-ray, dependency map,
data lineage and dead-connection check; the screens themselves belong to their specs.
`render: spec 03` means the view renderer draws it from the view XSL and a record, read-only, in
Node and a Web Worker, and a spec 03 test proves it (`.kiro/specs/03-view-renderer/verification.md`).
Editing, rules and live calculation are still spec 04's.

---

## A. Controls

`xctname` histogram across 83 view files: **1,266 controls, 17 distinct types.**

| Control | Count | InfoPath behaviour | Coverage | Status |
|---|---|---|---|---|
| Text (`PlainText`) | 602 | single-line input, type from schema | Native (`ts`/`tl`) | spec 05; render: spec 03 (quirks box, InfoPath row height) |
| Date picker (`DTPicker`) | 117 | `M/D/YYYY` + calendar button | Native (`da`/`dt`) | spec 05; render: spec 03 (our calendar icon) |
| Dropdown (`dropdown`) | 112 | fixed choices, no typing | Native (`cd`) | spec 05; render: spec 03 (selected value; `GetDOM` package lists) |
| Option buttons (`OptionButton`) | 104 | one of N, inline | Native (`cs`) | spec 05; ir: spec 02 (choice labels); render: spec 03 |
| Checkbox (`CheckBox`) | 72 | boolean | Native (`cm` single choice) | spec 05; ir: spec 02 (`checkboxText` label); render: spec 03 |
| Section (`Section`) | 59 | bordered group with title | Native (section) | spec 05; render: spec 03 |
| Repeating table (`RepeatingTable`) | 48 | N rows of fields, aggregate rows | App (repeating) | spec 03/04; ir: spec 02 (`inRepeat`, `columnHeader` label); render: spec 03 (rows of the record, each control marked with its row position) |
| Rich text (`RichText`) | 45 | HTML-lite with inline toolbar | Native (`rt`) | spec 05; render: spec 03 (sanitised, P5) |
| Button (`Button`) | 42 | runs rules, switches view, submits | App (action) | spec 04; ir: spec 02 (button triggers resolve from the row) |
| Expression box (`ExpressionBox`) | 30 | computed text, no border | App (read-only field) | spec 03; ir: spec 02 (read-only references; synthetic fixture only); render: spec 03 (the value the XSL computes; live recalculation is spec 04) |
| Repeating section (`RepeatingSection`) | 16 | N sections | App | spec 03; ir: spec 02 (`inRepeat`); render: spec 03 |
| ActiveX (GUID) | 7 | hosted COM control | Unsupported (no host) | spec 05; ir: spec 02 (form 44, `xd:server` endpoint); render: spec 03 (grey placeholder, `UNSUPPORTED_CONTROL`, form 44) |
| Attachment (`FileAttachment`) | 5 | file per field, icon + name + size | Native (`at`) | spec 05; render: spec 03 (icon, name, type, size block, from the MS-IPFFX header; the file itself is spec 11) |
| Combobox (`combobox`) | 3 | dropdown that accepts typing | Native (`cd` + other) | spec 05 |
| Choice section (`ChoiceSection`) | 2 | one of N sections | App | spec 05 |
| Choice group (`ChoiceGroup`) | 1 | one of N fragments | App | spec 05 |
| Picture (`InlineImage`) | 1 | embedded image | Native (attachment/image) | spec 05; render: spec 03 (the record's raster image as a data URL, form 06) |
| List box / multi-select | 0 in corpus | scrolling list, multi | Native (`cl`/`cm`) | spec 05 — **untested, no fixture** |
| Hyperlink, vertical label, scrolling region, horizontal region, plain/bulleted/numbered list, signature line, person picker, external item picker | 0 in corpus | — | Native/App per type | spec 05 — **untested, no fixture** |

The last two rows are the honest gap: the format allows 30-odd control types, the corpus
exercises 17, and our own generator wrote all 42 samples. Until a fixture exists for a control we
should not claim it works. `samples/own/` is MIT and can grow — adding one form per untested
control is the cheapest way to close this.

## B. Field types and formatting

| Capability | Evidence | Coverage | Status |
|---|---|---|---|
| Text, number, date, time, boolean, base64 in XSD | `myschema.xsd` in all 42 samples **[format]** | Native | spec 02; parsed: spec 01; ir: spec 02 |
| Currency / integer / decimal formatting via `xdFormatting:formatString` | 556 uses | Native (JSM field formatting) or App | spec 04; render: spec 03 (every corpus pattern, en-US) |
| Default values, including `xdDate:Today()` and `xdDate:Now()` | 30 + 2 uses | App (value on create) | spec 04 |
| Read-only and calculated fields | 52 `calculatedField` | App | spec 04; parsed: spec 01; ir: spec 02 |
| Repeating fields, optional fields | 59 / 4 declarations | App | spec 02; parsed: spec 01; ir: spec 02 |
| Promoted fields (`listProperties`) → Jira custom fields | format | Native (link by name) | spec 05 AC 9; parsed: spec 01 |
| Field-level help text and tooltips | format | Native (description) | spec 05; ir: spec 02 (ScreenTip is label step 1) |

## C. Rules and actions

7 action kinds, 94 actions in total. `facts.json` reports 8 kinds and 95, but one of them is not an
action (see the `containmentAction` note below the table).

| Action | Count | What it does | Coverage | Status |
|---|---|---|---|---|
| `ruleSetAction` | 37 | run another rule set | App (rule graph) | spec 04; parsed: spec 01; ir: spec 02 (triggers) |
| `assignmentAction` | 20 | set a field's value | App | spec 04; parsed: spec 01; ir: spec 02 |
| `closeDocumentAction` | 16 | close the form | App (redirect to request) | spec 04; parsed: spec 01 (synthetic fixture only) |
| `submitAction` | 12 | submit to a connection | Native (JSM submit) | spec 05; parsed: spec 01 (synthetic fixture only) |
| `switchViewAction` | 7 | change view | App (view switcher) | spec 03; parsed: spec 01; ir: spec 02 |
| `queryAction` | 1 | query a data connection | Manual → Automation/AQL | spec 05; parsed: spec 01; ir: spec 02 |
| `dialogBoxExpressionAction` | 1 | modal message built from fields | App (inline notice) | spec 04; parsed: spec 01; ir: spec 02 |
| `changeAdapterProperty`, `openNewDocumentAction`, `dialogBoxMessageAction`, `webPartConnectionAction`, `signSignatureLineAction` | 0 in corpus | defined in MS-IPFF2 2.2.1.2.114 | per action | spec 04/05 — **untested, no fixture**; parsed: spec 01 (synthetic fixture only) |
| Conditional formatting (show/hide, colour, disable) | 38 rule sets | visual changes driven by conditions | App (live binding) | spec 03/04 |
| Submit-only / "stop processing rules" (`xsf:exitRuleSet`) | format | short-circuits the rule chain | App | spec 04; parsed: spec 01 (synthetic fixture only) |

`containmentAction` was removed from this table on 2026-11-10. It is not an InfoPath action: the
child list of `xsf:rule` in MS-IPFF2 2.2.1.2.114 has no such element, and the three MS-IPFF2 XSDs
(sections 5.1–5.3) do not define it. The one occurrence is the form field `<my:containmentAction>`
inside form 23's `xsf:fragmentToInsert`; counting tag names that end in `Action` reproduces it.
`docs/corpus-facts.md` was corrected by hand on 2026-11-10; `facts.py` still counts it until the
script is fixed and re-run.
Insert/remove of optional and repeating blocks is real, but it lives in `xsf:editWith`
(`xCollection`, `xOptional`) and `xsf:menuArea` buttons, not in rules (spec 04 AC4).

## D. Expressions

XPath is the language of every calculation, validation and condition: **3,369 expressions** in
the corpus.

Core functions actually used: `node` 51, `not` 47, `string` 31, `sum` 12, `translate` 12,
`false` 12, `concat` 9, `position` 6, `count` 6, `and` 6, `substring` 3, `or` 3, `round` 1.

InfoPath extension functions actually used: `xdFormatting:formatString` 556, `xdXDocument:GetDOM`
68, `xdMath:Nz` 38, `xdDate:Today` 30, `xdXDocument:GetNamedNodeProperty` 27, `xdMath:Eval` 12,
`xdMath:Avg` 6, `xdMath:Min` 3, `xdMath:Max` 3, `xdDate:AddSeconds` 3, `xdDate:AddDays` 3,
`xdDate:Now` 2.

| Capability | Coverage | Status |
|---|---|---|
| Full XPath 1.0 | App (evaluator) | spec 04 |
| `xdMath` (Nz, Eval, Avg, Min, Max) | App | spec 04; render: spec 03 (Nz, Eval, Avg in views; Min and Max have no in-repo fixture) |
| `xdDate` (Today, Now, AddDays, AddSeconds, Add*) | App | spec 04; render: spec 03 (Today, Now from the `now` input) |
| `xdFormatting:formatString` (number/date patterns) | App | spec 04 — **the single highest-frequency function; a locale bug here breaks every sample.** The corpus uses 12 distinct patterns: `date` + `dateFormat:Short Date;` 123 times, `currency` + `numDigits:2;…currencyLocale:1033;` 59, `number` with `numDigits:0|2|auto` and `grouping:1|0` 63, `percentage` 6, `time` 6, `datetime` + `timeFormat:h:mm:ss tt|none` 9, `string` + `plainMultiline` 7 |
| `xdXDocument` (GetDOM, GetNamedNodeProperty, GetFileUrl) | App | spec 04; render: spec 03 (GetDOM for package sources, GetNamedNodeProperty gives the caller's default) |
| `xdUtil`, `xdUser`, `xdEnvironment`, `xdExtension` | App | spec 04; render: spec 03 (`xdUser:get-UserName` from the input; the others are unavailable, so guards take their fallback) |
| Anything not in that list | App, generic | spec 04 — evaluate, or mark the form Manual rather than silently returning empty |

## E. Validation

An earlier version of this table named a `requiredCondition` element. MS-IPFF2 has none: the
three XSDs (sections 5.1–5.3, checked 2026-11-10) contain no element or attribute of that name.
The 51 counted conditions are all `xsf:errorCondition` (MS-IPFF2 2.2.1.2.44).

| Mechanism | Count | Coverage | Status |
|---|---|---|---|
| `xsf:errorCondition` | 51 | Native (`rq`) + App (message text) | spec 05; parsed: spec 01; ir: spec 02 |
| `xsf3:errorBlank` ("cannot be blank", InfoPath 2010+; MS-IPFF2 2.2.3.2.18) | 0 in corpus | Native (`rq`) | spec 05 — **untested, no fixture**; parsed: spec 01 (synthetic fixture only); ir: spec 02 (synthetic fixture only) |
| Schema type and facet checks (length, range, pattern) | format | Native (`mnc/mxc`, `mnn/mxn`, `rgx`) | spec 05; parsed: spec 01 |
| Custom XPath validation with author message | 51 conditions, 13 distinct messages | App (validator) | spec 04; parsed: spec 01 — 25 conditions fall back to InfoPath's English `This field is required.`, so fallback text needs translating and authored text must not be; ir: spec 02 |
| Submit blocked by validation | format | Native (JSM form blocks submit) | spec 05 |
| Cross-field validation ("end after start") | format | App | spec 04 |

## F. Views and layout

| Capability | Count | Coverage | Status |
|---|---|---|---|
| Multiple views per form | 9 forms, max 4 | App + always-visible switcher | spec 03; parsed: spec 01; ir: spec 02; render: spec 03 (every view by name, 53 views; the switcher is spec 09) |
| Sections, nested sections | 59 | Native/App | spec 03; render: spec 03 |
| Tables used purely for layout | format | App (CSS grid from XSL) | spec 03; render: spec 03 (the XSL's tables, in MSHTML's quirks layout; row pitches within ±1 px of InfoPath) |
| Fixed page width, printing | format | App (print CSS) | spec 03; render: spec 03 (fixed widths; print CSS is not built) |
| Images and background images in views | 1 | Native (attachment) | spec 03; render: spec 03 (package images as data URLs; synthetic fixture only) |
| Fonts, colours, borders authored per control | format | App (must not restyle) | spec 03; render: spec 03 (view styles scoped to the render root; Calibri as Carlito, supplied by the page) |

## G. Data connections

| Kind | Count | Coverage | Status |
|---|---|---|---|
| `adoAdapter` (SQL Server) | 4 forms | Manual — Assets/CMDB or Automation | spec 05; parsed: spec 01; ir: spec 02 (`internal`, password redacted) |
| `webServiceAdapter` (SOAP) | 1 form | Manual — Automation HTTP call | spec 05; parsed: spec 01; ir: spec 02 (`internal`) |
| `xmlFileAdapter` | 6 forms | App (embedded XML becomes a choice list) | spec 05; parsed: spec 01; ir: spec 02 (`package`) |
| `emailAdapter` | format | Manual → Automation "send email" | spec 05; parsed: spec 01; ir: spec 02 |
| Secondary data sources driving dropdowns | 6 forms | App (lookup source) | spec 05; parsed: spec 01; ir: spec 02 (`choicesFrom`, lineage) |
| SharePoint list/library submit | format | Native (JSM request) | spec 05; parsed: spec 01; ir: spec 02 (synthetic fixture only) |
| `submitToHostAdapter` (submit handed to the hosting application) | form 44 in `samples/own/`; `docs/corpus-facts.md` has no count for the third-party corpus | Native (JSM request): the host that receives the submit becomes the JSM request create, so no app code is needed; spec 05 owns the final class | spec 05; parsed: spec 01; ir: spec 02 |
| Filtered / cascading dropdowns | format | Native (`cc`) when two-level | spec 05 AC 4; ir: spec 02 (`choicesFrom.filterIds`, form 03) |

## H. Runtime, code, security

| Capability | Count | Coverage | Status |
|---|---|---|---|
| InfoPath Forms Services (browser forms) | 12 forms | Gone; that is the reason for the project | —; parsed: spec 01 (`runtimeCompatibility`); ir: spec 02 (`browserCompatible`) |
| Managed code / VBA / script | 3 forms | Manual — rewrite as Automation or accept App emulation | spec 04; parsed: spec 01; ir: spec 02 |
| ActiveX controls | 7 | Unsupported, named in the Coverage Report | spec 05; parsed: spec 01 (manifest `allowedControl` only, synthetic fixture); ir: spec 02 (form 44 view control) |
| Digital signatures | 1 form | Manual — JSM approval + audit log | spec 05; parsed: spec 01; ir: spec 02 |
| User roles (`userRoles`) | format | Native — JSM project roles | spec 05; parsed: spec 01 (synthetic fixture only) |
| Trust levels, full-trust forms, `.xsn` signing | format | Not applicable once we stop trusting the template | —; parsed: spec 01 |

## I. Records

| Capability | Evidence | Coverage | Status |
|---|---|---|---|
| 348 filled records in `samples/own/records/`; for forms 01–42, one record per template was opened in the original (forms 43–47 were never opened) | `samples/own/records/`, `samples/own/README.md` | App (import + render) | spec 11 |
| Record knows its template by URN, then `href` | `mso-infoPathSolution` | App | spec 11; parsed: spec 01 (template side) |
| `upgrade.xsl` applied when the template version moved | form 07 vs 01 | App | spec 11; parsed: spec 01 (template side) |
| Attachments stored beside the record | 5 attachment controls | App | spec 11 |
| Printing a record as it looked | screenshots, 22 | App (print CSS) | spec 03; render: spec 03 (on screen, 16 baselines of forms 01–08 beside the InfoPath screenshots; print CSS is not built) |

---

## J. Where Afterlife is a superset, not a copy

Each line answers a defect recorded in `docs/infopath-ux.md`. None of these exist in InfoPath.

| Capability | Why it exists | Spec |
|---|---|---|
| Triage table for a whole folder, with a death certificate per form | nobody knows which of their 40 forms still matters | 12 |
| Coverage Report before publishing: Native / App / Manual / Unsupported per element | the original silently did less than the author thought | 05 |
| Rule trace: which rule fired, in order, what it changed | rules were invisible | 04 |
| Validation list that names the mechanism and links cause to field | three mechanisms looked identical | 04 |
| Always-visible view switcher | Filler had none | 03 |
| Import and search across years of records | records were files on a share | 11 |
| Coverage advice that turns a SQL connection into an Automation outline | the connection is dead, the logic still matters | 05 C |
| Dependency map: select a field, see every rule, calculation, check, view control, connection, handler and signature that reads or writes it | nobody could change a form without breaking something they could not see | 06 / 09; ir: spec 02 (`readBy`/`writtenBy`, 1,566 of 1,566 sample references) |
| Data lineage: for each list and secondary source, its connection, the fields it fills and what uses it | dropdown data came from places nobody remembered | 06 / 09; ir: spec 02 (`lineage`, `choicesFrom`) |
| Dead-connection check inputs: every endpoint with its host and an `internal`/`package`/`unknown` badge, passwords redacted | hard-coded internal hosts fail silently from the cloud | 06 / 09 / 12; ir: spec 02 (`endpoints`, `liveness`; `dead` is the viewer's check) |
| Label guess with its source: the text a person saw next to each field, and where it came from | field names such as `my:claimantDept` mean nothing to the people who filled the form | 05 / 06; ir: spec 02 (`label`, `labelSource`, `labelEvidence`) |
| Works with no server and no template URL | that is the failure mode that killed every form | 09 |
| Uninstall removes the app, not the forms | forms must survive us | 05 / 07 |

## K. How to prove none of this regressed

1. Run the app over `samples/own/` and its per-form counts must match `samples/own/README.md`;
   where `AFTERLIFE_PRIVATE_SAMPLES` is set, the 71-form totals must also match `facts.json`.
   Not every row with a count above zero has an in-repo fixture. Two groups:
   - **No fixture:** combobox, `xdMath:Min`/`Max` and `xdDate:AddDays`/`AddSeconds` occur only in
     the third-party forms (checked 2026-11-10, zero matches under `samples/own/forms/`, forms
     01–47). Treat those rows as "untested" in CI until a form is added to `samples/own/`.
   - **Fixture: form NN, generated, not opened in InfoPath.** Forms 43–47 were generated on
     2026-11-10 after the InfoPath trial expired, so they test the parser and converter, not what
     InfoPath accepts (`samples/own/README.md`):
     - browser compatibility (`runtimeCompatibility="client server"`, SharePoint `publishUrl`):
       form 43;
     - ActiveX control (`object class="xdActiveX"` in the view): form 44;
     - `submitToHostAdapter` submit: form 44;
     - digital signatures (`xsf:documentSignatures`, countersigned `signedDataBlock`, XML-DSig
       `xsd:any` containers): form 45;
     - managed code (`xsf2:managedCode`, C#, no assembly): form 46;
     - DAV submit (`davAdapter` with an expression file name): form 46;
     - script (`xsf:scripts`, JScript `script.js`, `domEventHandler/@handlerObject`): form 47;
     - named `simpleType`/`complexType` and facets (`pattern`, `enumeration`, `maxLength`):
       form 47.
2. Every row marked "untested, no fixture" is a task, not a claim. Add a form, add a row.
3. The demo video quotes only numbers from `facts.json`, so the claims and the evidence cannot
   drift apart.
