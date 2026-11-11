# Spec 04: Classic runtime (fill-in mode and Rule Trace)

Brief: `docs/spec-briefs/04-classic-runtime.md`. Pains N7 (silent breakage after a rebuild),
N11 (no machine can open the forms). Personas Lan (filler) and Tim (form owner).

A person opens a dead form in the web viewer, types, sees totals recalculate and validation fire
as InfoPath did, and downloads the filled XML. The view's own XSL draws every state (spec 03), so
the paper keeps InfoPath's look.

Decisions from the human, 2026-11-11 (turn prompt), items 1–12, are taken as given except where
the corpus says otherwise; those places are marked **Changed by evidence** and listed in
"Corpus facts".

Out of scope: drafts and autosave (brief AC 8, privacy first), submit to a host, Master/Detail,
horizontal repeating tables, ink, query connections, code-behind, "Replace with" on choice
sections (`xReplace`), the Forge portal host (it reuses this core later).

## Corpus facts (measured 2026-11-11 over our 48 templates: 47 own + weight-keeper)

Counted from FormIR and, for what FormIR does not hold, from `samples/own/forms/*/manifest.xsf`
and the views. The measuring script was temporary.

| What | Count |
|---|---|
| Main-source fields | 606 (form 08: 200; every other form ≤ 18) |
| Field types | string 354, date 80, double 68, boolean 48, integer 31, rich text 15, dateTime 5, base64Binary 3, restricted string 2 |
| Schema facets | enumeration 3, maxLength 1, pattern 1 |
| Rules | 9 in 5 forms; 4 with a condition; 0 disabled; 0 with `exitRuleSet` |
| Rule triggers | button 6 (forms 04, 05), onLoad 2 (forms 01, 07), field change 1 (form 03) |
| Actions | assignment 7, switch view 3, query 1, dialog (`dialogBoxExpressionAction`) 1 |
| Calculated fields | 20 in 12 forms, all `refresh="onChange"`; 6 targets inside a repeating row; longest chain 4 (form 04: `lineTotal` → `subtotal` → `vatAmount` → `grandTotal`) |
| Validations | 44 `xsf:errorCondition` in 20 forms, all `modeless`; 50 required fields; blank checks are errorConditions `. = ""` |
| Functions in rules, calculations, validations | `xdMath:Nz` 29, `sum` 9, `msxsl:string-compare` 4, `xdDate:Today` 3, `xdXDocument:GetDOM` 2, `round` 1, plus `not`, `string` |
| `xmlToEdit` components | `xField` 635, `xCollection` 18, `xReplace` 2, `xOptional` 1 (form 05); `fragmentToInsert` 21 in 17 forms |
| Controls by `xd:xctname` (FormIR bound controls) | PlainText 363, OptionButton 104, DTPicker_DTText 91, dropdown 74, CheckBox 56, RichText 15, FileAttachment 2, InlineImage 1, ActiveX 1; ListBox, people picker, ink: 0 |
| Buttons in views | 5 (forms 04, 05) |
| Secondary sources | 3: `Locations` (XML file in the template, form 03), `Vendors` (ADO), `BudgetService` (web service), both form 04 |
| Records of forms with calculations | 95 |

**Changed by evidence:**

- **E1 (decision 12).** Our records were written by the sample generator; InfoPath opened the
  first record of each template but did not save them (`samples/own/README.md`). 25 of the 139
  stored calculated values end in a zero after the point (`350.30`), which XPath number-to-string
  never writes; a text comparison fails 13 of form 02's 30 records. The calculation oracle
  therefore compares numbers at the stored value's decimal places, and checks the runtime
  against the generator's arithmetic, not against InfoPath.
- **E2 (decision 3).** Form 08 has 200 fields (the budget is for fewer than 200) and no rule,
  calculation or validation, so on form 08 a cycle is write plus render; spec 03 measured its
  render at 17.70 ms p95 in a Worker. The budget is measured on form 08 and on form 04 (the
  longest chain, button rules).
- **E3 (decisions 3, 5).** Forms 01 and 07 have onLoad rules (default the request date to
  today). The runtime runs onLoad rule sets when a session opens.
- **E4 (decision 4).** The function is `xdXDocument:GetDOM`; `msxsl:string-compare` (4 date
  checks, forms 01, 03, 07, 16) is needed as well.
- **E5 (decision 6).** `xsf:customValidation` is the manifest element that holds the
  `xsf:errorCondition`s; there is one kind of form validation, plus schema checks.

## Requirements

### R1. Fill session (Worker)

- **R1.1** WHEN the user turns on Fill for the open template, THE SYSTEM SHALL create a
  `FillSession` in the Worker from the shown record's bytes, or from the template's
  `initialXmlDocument` for an empty form, and SHALL keep the working DOM only in the Worker.
- **R1.2** WHEN a session opens, THE SYSTEM SHALL run the onLoad rule sets once, then the change
  cycle's recalculation and validation steps, before the first render; this state is the base of
  undo.
- **R1.3** THE session SHALL accept only these commands: `edit {path, value}`,
  `insertRow {path, where}`, `removeRow {path}`, `insertOptional {path}`, `removeOptional {path}`,
  `press {controlId, path?}`, `switchView {viewId}`, `undo`, `redo`, `download`; and SHALL answer
  each with a render, the invalid fields, and the new trace entries.
- **R1.4** IF a command names a path that selects no node, or a node the control does not bind,
  THEN THE SYSTEM SHALL change nothing and answer with a typed error.
- **R1.5** WHERE a record's version differs from the template's, THE SYSTEM SHALL not offer
  Fill for it and SHALL say why.

### R2. Change cycle

- **R2.1** WHEN a value changes, THE SYSTEM SHALL, in order: write it to the DOM; run the rule
  sets triggered by that field; recalculate the calculated fields that depend on any changed
  node, in dependency order; repeat rules and recalculation for nodes those steps changed;
  re-validate; re-render.
- **R2.2** IF the repeat in R2.1 has not settled after 16 passes, THEN THE SYSTEM SHALL stop,
  keep the values reached, and add a "possible rule loop" trace entry naming the fields still
  changing.
- **R2.3** WHEN a calculated field's target is inside a repeating row, THE SYSTEM SHALL evaluate
  it once per row with that row as context.
- **R2.4** THE SYSTEM SHALL complete one cycle (command in, render out, in the Worker) in under
  30 ms p95 on form 04, and SHALL report the time on form 08 (200 fields, render-bound; E2).
  Measured (task 13): Node, 50 cycles: form 04 p95 5.03 ms, form 08 p95 21.18 ms. Worker, spec
  alone, 20 commits: form 04 p95 8.30 ms, form 08 p95 20.90 ms. Worker inside the full parallel
  `pnpm e2e:web` (spec 14 run): form 04 p95 7.70 ms, form 08 p95 72.50 ms; form 08 is over 30 ms
  only when the machine runs 80 tests at once, and is reported, not held to the budget (E2).

### R3. Expressions

- **R3.1** THE SYSTEM SHALL evaluate InfoPath XPath with the `xpath` package and the namespaces
  of the manifest, and the functions `xdMath:Nz`, `xdDate:Today`, `xdDate:Now`,
  `xdXDocument:GetDOM`, `msxsl:string-compare` and the rest of `packages/core/src/xpath-fns`.
- **R3.2** IF an expression calls a function the runtime does not implement, or fails to
  evaluate, THEN THE SYSTEM SHALL leave its target unchanged, mark it "not evaluated" with a
  trace entry naming the function, and never throw out of the cycle.
- **R3.3** `xdUser:get-UserName()` SHALL return `""`; `Today` and `Now` SHALL use the time the
  page sent with the command.
- **R3.4** `GetDOM` SHALL return the template's own instance of a secondary source (an XML file
  in the `.xsn`); for a query connection it SHALL return an empty instance, with a trace entry
  "query connections are not available in the viewer".

### R4. Rules and buttons

- **R4.1** WHEN a rule set runs, THE SYSTEM SHALL evaluate each enabled rule's condition in
  manifest order and run its actions in order when it is true; a rule with `stopProcessing`
  SHALL end the rule set after its actions.
- **R4.2** Assignment SHALL write the expression's string value to the target node (main or
  secondary source); switch view SHALL change the view after the cycle; the dialog action SHALL
  open a modal `<dialog>` with the expression's text, focus on its button, Escape to close.
- **R4.3** A query action SHALL be skipped with a trace entry; submit and close SHALL show "Not
  available in the viewer. Download the XML instead."; code-behind SHALL never run.
- **R4.4** WHEN the user clicks a button in the view, THE SYSTEM SHALL run the rule sets bound
  to its `CtrlId` with the button's row as context.

### R5. Validation

- **R5.1** THE SYSTEM SHALL mark a field invalid when: it is required (the rule of the
  Required chip, spec 09 R4) and empty; its text does not fit its schema type (number, integer,
  date, time, dateTime, boolean) or facet (enumeration, length, pattern); or an
  `xsf:errorCondition` matching it is true (E5).
- **R5.2** WHEN a field is invalid, THE SYSTEM SHALL draw InfoPath's dashed red border on its
  control, show the short message on hover, and set `aria-invalid` and `aria-description` to the
  message.
- **R5.3** WHILE any field is invalid, THE SYSTEM SHALL show a line above the paper, "N fields
  need attention", whose next and previous buttons focus each invalid control in view order.
- **R5.4** Download SHALL stay available while fields are invalid, and SHALL say how many are.

### R6. Editing on the paper

- **R6.1** WHILE Fill is on, THE paper root SHALL not be `inert`, and THE SYSTEM SHALL make
  editable in place: PlainText (`contenteditable="plaintext-only"`, commit on blur or Enter, or
  Ctrl+Enter in a multi-line box), dropdown, CheckBox, OptionButton, DTPicker (typed ISO or the
  view's date format), RichText (as plain text).
- **R6.2** THE SYSTEM SHALL leave FileAttachment, InlineImage, ActiveX, ink, people picker,
  Master/Detail and horizontal repeating tables read-only, with a hover text saying "This control
  can't be edited in the viewer", and ExpressionBoxes and calculated fields read-only.
- **R6.3** AFTER each render, THE SYSTEM SHALL restore focus and caret to the control with the
  same path, or to the nearest row when it was removed.
- **R6.4** WHILE Fill is on, X-ray and the side panel SHALL keep working; turning Fill off SHALL
  ask before discarding changes that were not downloaded.

### R7. Repeating rows and optional sections

- **R7.1** WHEN the user clicks "Insert item" under a repeating table or section, THE SYSTEM
  SHALL insert the manifest's `fragmentToInsert` for that `xCollection`, or a schema-derived
  empty item, after the last row.
- **R7.2** Each row SHALL have a menu with "Insert above", "Insert below" and "Remove"; the last
  row of a group whose schema needs one SHALL not be removable.
- **R7.3** An `xOptional` section SHALL show "Click here to insert" when absent and "Remove" in
  its menu when present.
- **R7.4** Property **P3**: for any form with a repeating group and any N ≤ 20, inserting N rows
  at generated positions and removing them gives XML canonically equal to the start.

### R8. Download

- **R8.1** WHEN the user chooses "Download XML", THE SYSTEM SHALL save the DOM with the original
  XML declaration and processing instructions (`mso-infoPathSolution`, `mso-application`), as a
  `blob:` download, named after the record or `<template>-new.xml`.
- **R8.2** THE downloaded file SHALL open again in the viewer matched to its template, and render
  the same values.
- **R8.3** THE SYSTEM SHALL store nothing: no autosave, no local storage, no request.

### R9. Rule Trace

- **R9.1** WHILE Fill is on, THE side panel SHALL have a "Rule Trace" tab with one entry per
  rule evaluated, calculation recomputed, validation that changed state, skipped action and loop
  stop: time, trigger field, caption or expression, condition result, before and after values.
- **R9.2** Hovering or focusing an entry SHALL outline its field on the paper; a filter SHALL
  keep the entries of one field; the list SHALL keep the last 500 entries.

### R10. Undo and redo

- **R10.1** Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z, and toolbar buttons, SHALL undo and redo whole
  commands, as DOM snapshots, at most 100; a new command SHALL clear redo.

### R11. Properties and oracles

- **R11.1** Property **P7**: for any generated rule and calculation graph over up to 30 fields,
  cycles included, a cycle ends within 16 passes, and with a loop entry exactly when it did not
  settle.
- **R11.2** Property **P18** (new; added to `testing.md`): for any form and record, recalculating
  twice with no input change changes no node.
- **R11.3** Calculation oracle (E1): for every calculated field in our records (95 records, 12
  forms), recalculating from the record's inputs SHALL equal the stored value as a decimal
  rounded to the stored value's places; the test reports the count of matches and lists every
  mismatch with its expression.
- **R11.4** Validation oracle: every record of ours SHALL be valid after opening, except those
  listed as invalid in `samples/own/README.md`; the test lists each invalid record and message.
- **R11.5** e2e on form 02: turn on Fill, type amounts, see Total update, insert and remove a
  row, see a validation fire, download, reopen the download and see the same values.
