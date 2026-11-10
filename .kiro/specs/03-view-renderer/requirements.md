# Requirements: 03 view renderer

Source brief: `docs/spec-briefs/03-view-renderer.md`. Phase 1 of 3 (requirements → design → tasks).
Status: **approved, 2026-11-10** (review answers applied; each change is marked `Changed at
review:`). Second review, 2026-11-10: five edits after the engine spike, also marked
`Changed at review:`. Depends on spec 01 (`ParsedTemplate`, the `xml/` layer) and spec 02 (FormIR: views,
bound controls, validations, ActiveX, data connections and their liveness), both closed.

## Introduction

This spec renders one InfoPath view, as InfoPath drew it, to safe HTML. The input is a template
and an XML document: a filled record, or the template's own `template.xml` for the empty form. The
output is HTML that the web viewer (spec 09) shows in its "paper" area, the Original view panels
(spec 08) show next to a JSM request, and the Classic runtime (spec 04) re-renders after each edit.

The demo this spec serves: in the web viewer, a dropped template opens on its default view, a view
selector switches views, and each record renders with its template. Chrome stops running XSLT from
version 158 (2026-11-17, tech.md), so the renderer brings its own XSLT 1.0 engine and runs in Node
22 and a Web Worker without a DOM.

The renderer is a pure function of its inputs. It runs no script from the form, makes no network
request and reads no clock; the current date and the user name are inputs.

Out of scope, and the spec that owns each item:
- live rules, calculations, live validation (the dashed red border, messages, the asterisk
  appearing or going away as the user types) and editing: spec 04, which calls this renderer.
  `Changed at review:` the static required asterisk on an empty control is in this spec (R6.6);
  the empty screenshots show it and the viewer demo uses only this spec;
- the viewer UI, including the view selector, zoom, the sepia fade and printing: spec 09;
- the Original view panel and the SHA-256 seal: spec 08;
- matching a record to its template, `upgrade.xsl`, embedded attachments: spec 11;
- the static scan of view XSL (controls, bindings, labels): spec 02, read through FormIR;
- data from live connections (SQL, web services, SharePoint): never fetched; spec 05 and spec 09
  report them.

## Glossary

- **ParsedTemplate**, **FormIR**, **bound control**, **data source**: as in specs 01 and 02.
- **View**: one `xsf:view`; its XSL is the first `mainpane/@transform` (FormIR `IrView.xslFile`).
- **Default view**: the FormIR view with `isDefault`; with none, the first view.
- **Empty form**: the file named by `xsf:fileNew/xsf:initialXmlDocument/@href` (`template.xml` in
  all 48 samples).
- **Empty record**: `samples/own/records/<slug>/<slug>-000-empty.xml`, one per own template (47).
  It differs from `template.xml` only in the `mso-infoPathSolution` `href`. The capture script
  `allshots.ps1` opened it for every "empty" screenshot. The public sample has none and uses
  `template.xml`. `Changed at review:` added; the empty-state oracles use it.
- **Record**: a filled XML document, such as `samples/own/records/<slug>/<slug>-001.xml`. Its
  `mso-infoPathSolution` processing instruction names the template URN and `solutionVersion`.
- **First record**: `<slug>-001.xml` (the public sample: `sampledata.xml`). The capture script
  opened it for every "filled" screenshot.
- **Blank check** (`Changed at review:` added for R6.6): a FormIR validation of `kind: blank`, or
  of `kind: errorCondition` whose `expressionContext` is `.` and whose expression, with whitespace
  removed, is `.=""`. Form 01's four asterisks come from the second kind (Evidence).
- **Engine**: the XSLT 1.0 processor with its XPath 1.0 evaluator, chosen in the design by a
  measured spike on the 53 views (tech.md). `Changed at review:` was open question 1.
- **Extension function**: a function in an InfoPath or MSXML namespace (`xdFormatting`,
  `xdXDocument`, `xdImage`, `xdDate`, `xdMath`, `xdUser`, `msxsl`, `ipApp`).
- **Guard**: `function-available('<name>')` in an `xsl:when` test, with an `xsl:otherwise`
  fallback. InfoPath writes one around most extension calls.
- **Render result**: the sanitised HTML of the view body, its scoped style rules, and the issues.
- **Sanitising**: removing from the render result everything that can run code, load a resource
  or leave the render area (R5).
- **Package image**: an image file inside the `.xsn`, referenced from the view by a relative name.
- **InfoPath resource**: a `res://infopath.exe/…` URL in a view (`calendar.gif`, `pictureclick.gif`).
- **Fallback mode**: a test-only engine setting in which `function-available` is false for every
  extension function, so every guard takes its `xsl:otherwise` branch, as `xsltproc` does (R10.1).
- **The 53 views**: the 52 view files of forms 01–47 and the public sample's `view1.xsl`.
- **Private corpus**: the 29 templates at `AFTERLIFE_PRIVATE_SAMPLES`; counts only, never content.

## Evidence checked for this spec (2026-11-10)

**Own views** (Python 3 over `samples/own/forms/*/view*.xsl` and the public sample's `view1.xsl`
extracted with `bsdtar`; XPath expressions in `select`, `test`, `match` and attribute value
templates; string literals removed before matching function names):

| Function | Calls | Forms |
|---|---|---|
| `function-available` (guard) | 195 | 44 |
| `xdFormatting:formatString` | 190 | 44 |
| `generate-id` | 104 | 14 |
| `xdXDocument:GetDOM` | 5 | 2 (03, 04) |
| `current`, `string`, `not` | 2, 2, 1 | 1 |

- Every own extension call is guarded: `function-available('xdFormatting:formatString')` 190 times
  and `('xdXDocument:GetDOM')` 5 times, equal to the call counts.
- `formatString` uses 5 patterns in our views: `date` + `dateFormat:Short Date;` 86, `currency` +
  `numDigits:2;…;currencyLocale:1033;` 60, `number` + `numDigits:0;…;grouping:1;` 31, `number` +
  `numDigits:2;…` 8, `datetime` + `dateFormat:Short Date;timeFormat:h:mm:ss tt;` 5. The 71-form
  corpus uses 12 (`docs/feature-coverage.md` D).
- XSLT instructions: `value-of` 1,191, `attribute` 1,025, `if` 488, `choose`/`when`/`otherwise`
  198 each, `template` 112, `apply-templates` 59, `copy-of` 15 (rich text, `my:x/node()`),
  `variable` 5, `for-each` 5, `output` 53.
- Images: 90 `res://infopath.exe/calendar.gif` (date pickers), 1 `res://infopath.exe/pictureclick.gif`
  (form 08 `InlineImage`). No own view references a package image; the 71-form corpus has 1
  (`docs/feature-coverage.md` F).
- ActiveX: form 44, one `object` (spec 02 R4.5).

**Private corpus** (58 `.xsl` files of the 29 templates, counted by the maintainer, 2026-11-10;
counts only). `Changed at review:` the 58 files are 36 `mainpane` views, 19 `upgrade.xsl` and 3
other `.xsl` files (engine spike, 2026-11-10); the 36 equal spec 02's count:

| Call | Count | Forms |
|---|---|---|
| `function-available` (guard) | 167 | 24 |
| `msxsl:node-set` | 115 | 19 |
| `xdFormatting:formatString` | 97 | 20 |
| `xdXDocument:GetNamedNodeProperty` | 24 | 9 |
| `xdXDocument:GetDOM` | 18 | 3 |
| `xdImage:getImageUrl` | 16 | 8 |
| `msxsl:string-compare` | 12 | 3 |
| `xdDate:Today` | 12 | 3 |
| `generate-id` | 11 | 1 |
| `xdMath:Avg` | 9 | 3 |

- Guards name `xdFormatting:formatString`, `xdXDocument:GetDOM`, `xdImage:getImageUrl`,
  `xdXDocument:GetNamedNodeProperty` and `ipApp:GetMajorVersion`.
- Instructions beyond ours include `copy-of` 422, `copy` 136, `call-template`, `param` and
  `with-param`.
- `GetNamedNodeProperty` is defined in MS-IPFF2 §2.4.3.9.3. Every private call reads state the
  InfoPath runtime sets (signature status `IsValidSignature`, `SignedBy`, `SignedOn`; a
  `filterVersion`; a control id on a repeating group), and each passes a literal default as its
  third argument (maintainer, 2026-11-10, shapes only).
- Of the 58 `.xsl` files, 22 are not `mainpane` views (19 `upgrade.xsl`, 3 others).
  `Changed at review:` the local check renders every view a `mainpane` names and counts the other
  `.xsl` files separately (R10.3).

**Required asterisk** (`samples/own/screenshots/01-leave-request-Request-empty.png`, checked
2026-11-10): the asterisk shows on Employee name, Employee ID, First day of leave and Last day of
leave. Those are exactly the four fields of form 01 with an `xsf:errorCondition` whose expression
is `. = ""` (`manifest.xsf` lines 79–82). Working days (`. < 1 or . > 30`) and Department show
none. Form 01 has no `xsf3:errorBlank`, and no FormIR `required` field (its strings are never
required, spec 01 R14.8, and its dates are `nillable`). `docs/infopath-ux.md` §3 lists three of
the four; it omits Employee ID.

**`xsltproc` as a reference** (`/usr/bin/xsltproc`, libxml 2.9.13, libxslt 1.1.35, run
2026-11-10):
- On form 02 with `sampledata.xml`, every guard takes the fallback, so currency shows `326.39`
  where InfoPath shows a formatted amount, and dates show `2025-06-26`.
- An unguarded `msxsl:node-set` fails the whole transform ("Unregistered function", no output).
  That is the private corpus's second most frequent call.
- So `xsltproc` cannot produce the reference pictures the brief asks for. It can serve as a
  structural oracle in fallback mode (R10.1).

**InfoPath appearance** (`docs/infopath-ux.md` §3–4, **[seen]**): a date shows as `M/D/YYYY`
(`11/3/2026`) with an 18 px calendar button inside the control; a calculated total shows
`$350.30`; an empty dropdown shows its authored placeholder (`Select...`).

**Screenshots:** 16 of the 22 in `samples/own/screenshots/` are default views (forms 01–08, empty
and filled). `Changed at review:` the capture script `allshots.ps1` opened the first record for
"filled" and the empty record for "empty" (maintainer, 2026-11-10).

## Requirements

### R1. Render a view
Traces: brief AC1 (inputs and output); Added: inputs from FormIR, the empty form, runtimes.

As Mai (IT admin), I want any dropped template to open on its default view, empty or with a
record, so that I can see a form nobody can open any more.

1. WHEN given a `ParsedTemplate`, its FormIR, a view name and an XML document, THE SYSTEM SHALL
   return a render result: the sanitised HTML of the view body, its scoped style rules and a list
   of issues. Oracle: a golden render result per view of the 53 views, for the empty record
   (`-000-empty.xml`; the public sample's `template.xml`) and for the first record.
   `Changed at review:` the empty state uses the empty record, which the screenshots show.
2. WHEN no view name is given, THE SYSTEM SHALL render the default view; WHEN no XML document is
   given, THE SYSTEM SHALL render the empty form. Oracle: form 05 renders `HR`; form 03 renders
   `Employee`; the result for form 01 with no document equals the result with `template.xml`.
3. IF the view name is not a FormIR view, or its XSL is missing or failed to parse (FormIR
   `scanned: false`), THEN THE SYSTEM SHALL throw an `AfterlifeError` naming the view and the
   reason, and SHALL NOT return partial HTML. Oracle: an unknown name; spec 02's missing-view and
   broken-view fixtures.
4. Preparing a view (compiling its XSL) MAY be asynchronous, once per view of a template.
   Rendering a prepared view SHALL be synchronous and pure: no network request, no file or clock
   access; spec 04 re-renders synchronously after each edit. The current date and time (`now`, a required ISO date-time with offset), the locale and the user
   name (optional, empty when not given) SHALL be inputs, with no fallback to a clock or the
   environment. It SHALL run unchanged in Node 22 and a Web Worker without a DOM. Oracle: the
   spec 01 lint restrictions and the spec 02 clock ban extended to the renderer's modules; a
   Worker build with Node built-ins refused (spec 01 R17.1); a call without `now` fails to
   type-check. `Changed at review:` `now` required, user name optional, no fallback.
   `Changed at review:` (second review) prepare may be async, render is sync; the chosen engine
   compiles asynchronously.
5. THE SYSTEM SHALL parse the XML document as hostile input through core's `xml/` layer, with its
   limits and no DTD. A document that is not well-formed SHALL be an `AfterlifeError`
   (`INVALID_XML`, `UNSAFE_XML` or `LIMIT_EXCEEDED`). Oracle: the spec 01 XML safety fixtures used
   as records.

### R2. The record's template and secondary data
Traces: brief user story (auditor); Added: secondary sources (`GetDOM`), record mismatch.

As the auditor, I want a 2014 record to render with its template even when the versions differ,
and to be told when they do.

1. WHEN the record's `mso-infoPathSolution` names a different URN or `solutionVersion` from the
   template, THE SYSTEM SHALL render it anyway and record a `RECORD_TEMPLATE_MISMATCH` issue with
   both values. It SHALL NOT apply `upgrade.xsl` (spec 11). Oracle: a form 01 record rendered with
   form 07 (same URN, different version) gives one issue; every own record with its own template
   gives none.
2. THE SYSTEM SHALL give `xdXDocument:GetDOM("name")` the package file of an `xmlFileAdapter`
   whose endpoint is `package` (spec 02 R8.3). For any other data source it SHALL give an empty
   document and record one `SECONDARY_DATA_UNAVAILABLE` issue per data source and render. Oracle:
   form 03's country list holds the countries of `locations.xml`; form 04's `Vendors` list is
   empty with one issue.

### R3. The XSLT 1.0 engine
Traces: brief summary ("a pure-JS XSLT engine"), brief AC1; Added: confinement, limits, licence
(tech.md security rules, samples-and-licensing.md).

As Hung (approver), I want every view to render, including the complex ones, so that I see the
form "like paper".

1. THE SYSTEM SHALL implement every XSLT 1.0 instruction and every XPath 1.0 and XSLT 1.0
   function that the 53 views or the private views use (Evidence), with the semantics of the XSLT
   1.0 and XPath 1.0 Recommendations. Oracle: the 53 views render the empty form and the first
   record with no engine error; the local check (R10.3).
2. THE SYSTEM SHALL resolve `xsl:import`, `xsl:include` and `document()` only against package
   files (`document('')` is the view itself). Any other URI SHALL give an empty node-set, or skip
   the import, and an `EXTERNAL_RESOURCE_BLOCKED` issue; nothing is fetched or read from disk.
   Oracle: synthetic views with an `http:` include, a `file:` `document()` and a package include.
3. IF a render exceeds its limits (output size, recursion depth, or evaluation steps; defaults set
   in the design, overridable), THEN THE SYSTEM SHALL stop with `AfterlifeError`
   `LIMIT_EXCEEDED` naming the limit. Oracle: synthetic views with an infinitely recursive
   template and an output bomb (nested `for-each` over a large record).
4. THE SYSTEM SHALL NOT use the browser's `XSLTProcessor` or `saxon-js`, and every runtime
   dependency SHALL be under MIT, Apache-2.0, BSD or ISC terms, with no exception
   (samples-and-licensing.md). Oracle: a lint rule bans `XSLTProcessor` in core; a test reads the
   `license` field from the installed `package.json` of every production dependency of
   `packages/core`, transitive ones included, offline. `Changed at review:` BSD-only became BSD
   or ISC; (second review) the `xslt-processor` exception is gone, because the spike chose
   `xsltjs` (MIT); (third review) the oracle reads installed `package.json` files, because
   `pnpm-lock.yaml` has no licence field.

### R4. InfoPath extension functions
Traces: brief AC2, extended by the Evidence tables; Added: `msxsl`, `function-available`.

As Lan (form filler), I want dates, amounts and lists to show as they did in InfoPath, so that I
recognise my form.

1. THE SYSTEM SHALL implement:
   - `xdFormatting:formatString`;
   - `xdXDocument:GetDOM` and `xdXDocument:GetNamedNodeProperty`;
   - `xdImage:getImageUrl`;
   - `xdDate:Today` and `xdDate:Now`;
   - `xdMath:Avg`, `xdMath:Nz` and `xdMath:Eval`;
   - `xdUser:get-UserName`;
   - `msxsl:node-set` and `msxsl:string-compare`.

   Each function's definition SHALL cite its source (InfoPath or MSXML documentation, or an
   InfoPath screenshot) in the design. Oracle: unit cases per function; the local check counts 0
   calls to an unimplemented function.
2. THE SYSTEM SHALL make `function-available` true for exactly the functions it implements (R4.1
   and the XPath 1.0 and XSLT 1.0 core functions), and false for any other name, such as
   `ipApp:GetMajorVersion`. Oracle: a synthetic view that tests every name in R4.1, the core
   functions and `ipApp:GetMajorVersion`; the local check prints guard results by name.
3. THE SYSTEM SHALL format with `formatString` every pattern the 53 views use (Evidence: 5) and
   the 12 of the 71-form corpus, in en-US by default (`currencyLocale:1033`), with the locale an
   input. Oracle: `2026-11-03` as `date`/`Short Date` gives `11/3/2026`; `350.3` as `currency`
   with `numDigits:2` gives `$350.30` (`docs/infopath-ux.md` §3–4); one unit case per pattern;
   an unparseable value is returned unchanged, as InfoPath shows it.
4. IF a view calls an extension function that is not implemented, outside a guard, THEN THE SYSTEM
   SHALL return the empty string for that call, keep rendering, and record one `UNKNOWN_FUNCTION`
   issue per function name with the number of calls. Oracle: a synthetic view calling
   `ipApp:GetMajorVersion()` unguarded.
5. THE SYSTEM SHALL compute `xdDate:Today` and `xdDate:Now` from the `now` input and
   `xdUser:get-UserName` from the user-name input (empty when not given). `GetNamedNodeProperty`
   (MS-IPFF2 §2.4.3.9.3, cited in the design) SHALL return its third argument, the caller's
   default, because every property it reads is state the InfoPath runtime sets (signature status,
   `filterVersion`, control ids). Oracle: unit cases; two renders with different `now` differ only
   in those values; a synthetic view calling `GetNamedNodeProperty(., 'IsValidSignature',
   'false')` gives `false`. `Changed at review:` `GetNamedNodeProperty` behaviour settled (was
   open question 4).

### R5. Safe output without a DOM
Traces: brief AC3, brief P5; Added: no DOM (core runs in a Worker), inert controls, scoped styles
(ux-principles.md "Two worlds, one screen").

As Mai, I want a hostile `.xsn` or record to be unable to run code or reach the network when I
open it, so that the free viewer is safe to use on anything.

1. THE SYSTEM SHALL remove from the render result:
   - `script`, `object`, `embed`, `applet`, `iframe`, `frame`, `frameset`, `base`, `form`,
     `link` and `meta` elements;
   - every attribute whose name starts with `on`;
   - URLs in `href`, `src`, `action`, `formaction`, `xlink:href` and CSS `url()` whose scheme is
     not `http`, `https` or `mailto` (for `href`) or a `data:image/…` URL (for `src` and CSS);
   - every URL that would load a resource automatically (`src`, CSS `url()`, `srcset`, `poster`)
     unless it is a `data:image/…` URL;
   - CSS `expression(`, `behavior:`, `-moz-binding` and `@import`.

   Oracle: unit cases per item; the 53 golden results contain none; P5.
2. THE SYSTEM SHALL keep `style`, `class`, `title`, `xd:*` attributes except `xd:inline`,
   `xd:num` and `xd:value`, and `data:image/…` sources, and the view's text, tables and layout.
   Oracle: the golden results keep form 02's `title`, `class` and `xd:binding` attributes and its
   table structure. `Changed at review:` (after task 7) "`xd:*` attributes except `xd:inline`":
   it is InfoPath runtime data (a whole attachment or picture as base64), not presentation, and
   is dropped silently (design §8.4). `Changed at task 9:` `xd:num` and `xd:value` join it: they
   carry the raw field value, written as the control's `xd:boundProp`.
3. THE SYSTEM SHALL sanitise with no DOM, in Node 22 and in a Web Worker, with byte-identical
   results. Oracle: the Worker parity harness (spec 01) on the 53 views × 2 golden results.
4. THE SYSTEM SHALL render controls inert: no element of the render result accepts input or
   focus, and no `contentEditable` is left on. Oracle: a browser test on forms 01–08: no focusable
   element inside the render root, and typing changes nothing.
5. THE SYSTEM SHALL scope the view's style rules to the render root, so that rules such as
   `BODY{…}` and `TABLE{…}` change nothing outside it. Oracle: a browser test renders form 02
   inside a page and checks the computed style of an element outside the root.

### R6. What InfoPath showed that the XSL alone does not
Traces: brief AC4–AC7; Added: control marks (spec 04 and the X-ray need them); Added at review:
the required asterisk (R6.6; the empty screenshots show it).

As Tim (form owner), I want the original form next to the converted one to look like the form I
built, so that I can trust the comparison.

1. THE SYSTEM SHALL replace each package image reference in the view with a `data:image/…` URL of
   that file. Oracle: a synthetic template with a package image (no own sample has one, Evidence).
   `Changed at task 9:` the same for an inline picture (`msoxd:;inline;` and the record's base64,
   when it is a PNG, GIF, JPEG or BMP). Oracle: form 06's first record shows its scene photo with
   no `CONTENT_REMOVED` (design §8.1 step 4).
2. WHEN a view holds an ActiveX object (FormIR `activeX.controls`), THE SYSTEM SHALL render in its
   place a grey placeholder box with the text "Custom control {GUID}: not supported" and record an
   `UNSUPPORTED_CONTROL` issue. Oracle: form 44.
3. THE SYSTEM SHALL keep an empty bound control at least one line high and as wide as the view
   sets it, not collapsed. Oracle: a browser test on form 01's empty form: every empty
   `PlainText` control is at least one line high.
4. THE SYSTEM SHALL replace each InfoPath resource with an icon of its own: a calendar button for
   `calendar.gif` and a picture placeholder for `pictureclick.gif`, drawn with CSS or an
   Atlaskit icon, never a Microsoft asset (samples-and-licensing.md). Oracle: form 02's date
   pickers and form 06's picture control show the icon; no `res:` URL is left.
   `Changed at review:` (2026-11-10, after the private renders) the three signature images
   `signaturevalid.gif`, `addsignaturebutton.gif` and `signatureerror.gif` share one signature
   icon of our own. Any other `res://infopath.exe/` image becomes a neutral box of the same size
   and is reported as `CONTENT_REMOVED {kind: resource}` with its file name. The picture control
   is in form 06, not form 08 as first written.
5. THE SYSTEM SHALL mark each rendered bound control with its FormIR control id and the data path
   of the node instance it shows (with positions, such as
   `/my:expenseClaim[1]/my:expenses[1]/my:expense[2]/my:amount[1]`). Oracle: form 02's first
   record has one mark per `my:amount` row, each with its row's position.
6. WHEN a bound control's node is empty in the document, and its field is FormIR `required` or the
   target of a blank check, THE SYSTEM SHALL draw InfoPath's required mark on it: a small red `*`
   (about 8 px, `#FF0000`) a few pixels inside the right edge, vertically centred, with no border
   change and no message (`docs/infopath-ux.md` §3). The mark is static: no event handling, and
   no other validation is evaluated (spec 04 owns live validation). Oracle: form 01's empty
   record marks Employee name, Employee ID, First day of leave and Last day of leave, and not
   Department or Working days (`01-leave-request-Request-empty.png`); its first record has no
   mark; a synthetic `xsf3:errorBlank` and a non-nillable `xsd:date` field are each marked when
   empty. `Changed at review:` added (was open question 7, defaulted to spec 04).

7. WHEN a bound FileAttachment control's node holds an InfoPath file attachment, THE SYSTEM
   SHALL show in the control our own CSS file icon, the file name and the size in bytes, read from
   the attachment header only (the file metadata of [MS-IPFFX] §2.1.3.1, cited in the design).
   The file content SHALL NOT be decoded (spec 11). IF the header is truncated, too long or
   otherwise invalid, THEN THE SYSTEM SHALL show the icon alone and record one
   `ATTACHMENT_UNREADABLE` issue, and SHALL NOT throw. The file name is record data and is
   written as escaped text. Oracle: form 02's first record shows `receipt-01-1.txt`, `109 bytes`
   and `receipt-01-2.txt`, `110 bytes` (`02-expense-report-Claim-filled.png`); unit cases for a
   truncated header and for a name-length overflow; a name holding markup is escaped (P5).
   `Changed at review:` added (2026-11-10, after the forms 01–08 comparison). Our generator wrote
   these headers, and InfoPath Filler 2013 opened them; the screenshot shows the result.

### R7. Property P4: rendering is deterministic
Traces: brief P4 (testing.md).

1. For any of the 53 views and any record built from a sample record by replacing text values with
   generated strings (quotes, `<`, `&`, non-BMP characters, whitespace runs, very long values),
   with a generated `now`, locale and user name, rendering twice SHALL give byte-identical
   results, and the result SHALL not depend on the order in which views are rendered. The golden
   results SHALL be identical in Node 22 and a Web Worker (R5.3). At least 200 runs in CI, failing
   seeds kept as regressions.

### R8. Property P5: sanitised output never holds executable content
Traces: brief P5 (testing.md).

1. For any view XSL and record from a generator of hostile inputs (literal result elements and
   `xsl:element`/`xsl:attribute` with the R5.1 names, `on*` attributes, `javascript:`,
   `vbscript:` and mixed-case schemes, entity-encoded and whitespace-split URLs, CSS
   `expression(`, rich text fields holding markup that `copy-of` copies, `xsl:text
   disable-output-escaping`), the render result SHALL contain none of the R5.1 items. The oracle
   SHALL parse each result with the browser's HTML parser (Chromium) and check the parsed tree,
   so markup that changes meaning when parsed is caught. At least 500 runs in CI.

### R9. Performance
Traces: brief AC1; tech.md budget "render one view in under 100 ms (p95, browser)".

1. THE SYSTEM SHALL render each of the 53 views, with the empty record and with the first
   record, in under 100 ms at p95 over 20 runs, in Node 22 and in a Chromium Web Worker; form 08
   (171 KB view, 200 fields) reported separately. Oracle: the perf project and a browser perf
   test.

### R10. References and visual acceptance
Traces: brief "Visual acceptance", changed (Evidence: `xsltproc` cannot run InfoPath functions);
Added: the private check.

As Tim, I want proof that the renderer draws my form as InfoPath did, so that the side-by-side
compare means something.

1. THE SYSTEM SHALL, in fallback mode and before the R5–R6 post-processing, give the same HTML as
   `xsltproc` for every one of the 53 views, with the empty record and with the first record, after
   a normalisation the design defines (whitespace, attribute order, namespace declarations; the
   Content-Type `meta` dropped; HTML boolean attribute values emptied; `generate-id()` values
   renamed in order of first appearance). The
   `xsltproc` references SHALL be made by a committed script with the libxslt version recorded,
   and committed, so CI does not need `xsltproc`. Oracle: 106 reference files; every own extension
   call is guarded (Evidence), so all 53 views qualify. `Changed at review:` (second review) the
   last three normalisation steps added; without them the spike matched 19 of 106.
2. THE SYSTEM SHALL pass a Playwright visual test of the default view of forms 01–08, with the
   empty record and with the first record (16 renders), against baseline PNGs of its own render.
   Each baseline is committed only after the maintainer approves it side by side with the InfoPath
   screenshot of the same view and state. The pixel threshold SHALL be set after the first
   measurement and recorded in this spec. Oracle: 16 baselines; the 16 InfoPath screenshots as the
   human reference. `Changed at review:` R10.1–R10.2 name the empty record, the file the
   screenshots were taken from.
3. WHERE `AFTERLIFE_PRIVATE_SAMPLES` is set, THE SYSTEM SHALL render every view that a `mainpane`
   names, in every private template, with its empty form, with no throw. It SHALL skip the
   `own/` folder, which holds our own 42 forms. It SHALL print, as names
   and counts only: issues by code, calls to unimplemented functions by name (expected 0), guard
   results by name, the slowest render, and the number of `.xsl` files no `mainpane` names
   (counted, not rendered). Oracle: run locally by the maintainer; CI skips it. `Changed at
   review:` the view set is defined (was open question 6); (second review) `own/` is skipped,
   since the private folder holds all 71 forms of the corpus.

## Traceability

| Brief item | Requirements |
|---|---|
| Summary: pure-JS engine, shims | R3, R4 |
| User story: auditor (record as it looked) | R2.1, R6, R10.2 |
| User story: Tim (original next to converted) | R6, R10 |
| AC1 render within 100 ms p95 | R1.1, R9.1 |
| AC2 functions | R4.1–R4.5 (extended: `msxsl`, `function-available`) |
| AC3 sanitise | R5.1–R5.3 |
| AC4 package images as data URLs | R6.1 |
| AC5 ActiveX placeholder | R6.2 |
| AC6 empty fields visible | R6.3 |
| AC7 calendar icon | R6.4 |
| P4 deterministic | R7.1 |
| P5 sanitiser | R8.1 |
| Visual acceptance | R10.1–R10.2 (changed: default views only; `xsltproc` as a structural oracle, not a picture reference) |
| Added | R1.2–R1.5, R2, R3.2–R3.4, R5.4–R5.5, R6.5, R6.6, R6.7, R10.3 |

**Total: 34 criteria** (R1.1–R10.3). `Changed at review:` R6.6 added; R6.7 added.

## Review answers (2026-11-10)

All seven open questions were answered by the maintainer; each change above carries a
`Changed at review:` note.

1. **Engine:** not decided on paper. The design picks it from a measured spike on the 53 views.
   `xsltjs` (MIT) is preferred; `xslt-processor` (LGPL-3.0) is a fallback that needs the
   maintainer's OK (tech.md). Paper facts from the npm registry and each README, kept for the
   design ("Size" is the npm unpacked size, not the bundle). The spike settles each `[VERIFY]`
   cell and records the result in `design.md`:

| Engine | Licence | XSLT 1.0 | Size | Node 22 and Worker, no DOM | Extension functions |
|---|---|---|---|---|---|
| `xsltjs` 1.0.0 (Xcential) | MIT | "all XSLT 1.0 instructions, declarations and functions"; 94% of the W3C XSLT 1.0 tests | 181 KB; depends on `@xmldom/xmldom` 0.9.12 (ours) and `xpath` 0.0.36 (MIT) | Node: yes, synchronous `XSLT.run()`. Worker: [VERIFY] its `Stylesheet.js` requires `fs` and `path` and calls `fetch` for includes, so the bundle must stub them | Yes: JS functions per namespace URI, called with the XPath context |
| `@tradik/xslt-processor` 1.3.4 | BSD-3-Clause | "every element and function" of XSLT 1.0, with listed deviations | 5.6 MB | Needs a DOM; the README suggests `jsdom` for Node. [VERIFY] whether `@xmldom/xmldom` is enough | [VERIFY] not documented in the README |
| `xslt-polyfill` 1.0.36 (Chrome team) | BSD-3-Clause | libxslt compiled to Wasm, Chrome's behaviour | 2.8 MB | Browser polyfill: needs `document`; Wasm compile needs `wasm-unsafe-eval` in CSP | No JS functions (libxslt C level); `msxsl:node-set` fails as in `xsltproc` |
| `libxslt-wasm` 0.0.20 | MIT | libxslt 1.1 | 0.9 MB | Node; uses JSPI to intercept `fetch`. Worker [VERIFY] | EXSLT modules only; no JS functions |
| `xslt-processor` 5.1.3 (DesignLiquido) | **LGPL-3.0** | XSLT 1.0 with its own XPath | 6.3 MB | Yes, no DOM | Non-standard functions built in; custom ones [VERIFY] |
| SaxonJS 2.7 / 3 beta | proprietary ("see LICENSE") | XSLT 3.0 (1.0 by compatibility) | 2.4 MB | Yes | Yes |
| Our own XSLT 1.0 interpreter on `@xmldom/xmldom` + `xpath` (MIT) | MIT (ours) | only what the 53 views and the private views use | small | Yes | Yes, and shared with spec 04's runtime |

2. **Steering:** edited by the maintainer. Core sanitises by itself and the viewer may add
   DOMPurify on top (tech.md); visual baselines are our own render, approved against the InfoPath
   screenshots, and `xsltproc` gives structural references only (testing.md). R3.4 follows the
   licence exception in samples-and-licensing.md.
3. **`now` and user name:** both inputs, no fallback to a clock or the environment (R1.4).
4. **`GetNamedNodeProperty`:** MS-IPFF2 §2.4.3.9.3; return the third argument (R4.5, Evidence).
5. **Records:** the screenshots show `-000-empty.xml` (empty) and `-001.xml` (filled). The empty
   record is the empty-state oracle in R1.1, R9.1 and R10.1–R10.2; R1.2 (no document → the empty
   form, `template.xml`) is unchanged.
6. **Private views:** render every view a `mainpane` names; count other `.xsl` files (R10.3).
7. **Required asterisk:** in this spec, static (R6.6). Doc edit for the maintainer:
   `docs/infopath-ux.md` §3 should list Employee ID with the other three marked fields (the
   screenshot shows four).
