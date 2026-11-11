# Spec 16: dossier and Fill bugfixes

Defects found by the reviewer on `1f2ac50` (K1–K13), spec 14's open N1–N3, and one defect the
new spec 04 tests found (D1). K1–K12 are spec 15's; K13, N1–N3 and D1 are spec 04's.

## K1. The dossier scrolls sideways on a phone
- **Current:** WHEN the Documentation screen is shown at 390 px, THE SYSTEM draws it 438 px wide and squeezes Path into a five-character column.
- **Expected:** at 390 px THE page SHALL not scroll sideways, and each field SHALL read as a block of labelled lines.
- **Unchanged:** the table on wide screens; print.

## K2. Buttons named by control id
- **Current:** WHEN a rule runs on a button, THE SYSTEM names it "button CTRL900 on view “Request”", and the Rule Trace does not name it.
- **Expected:** THE dossier and the Rule Trace SHALL name a button by the caption its view shows ("the button “Check budget”"), and by its control id only when the view gives none.
- **Unchanged:** P19; the trace of field changes.

## K3. Required disagrees with the validations
- **Current:** WHEN a field has a blank check, THE SYSTEM says it is not required; a Yes/No field is "required".
- **Expected:** Required SHALL be Yes when a person filling in the form must give a value: a blank check on the field, or a required schema type that can be empty.
- **Unchanged:** the runtime's own required rule.

## K4. Conditions are never put in words
- **Current:** WHEN a rule or validation has a condition, THE SYSTEM writes "a condition on X is true".
- **Expected:** comparisons with a value or a field, "is blank", `string-compare(…) < 0`, and `and`, `or`, `not()` of those SHALL be said in words ("when it is less than 1", "if Total incl. VAT is greater than 1000"); the old wording SHALL stay for any other shape.
- **Unchanged:** the expression under the sentence.

## K5. Print wastes paper
- **Current:** WHEN the dossier prints, THE SYSTEM starts every section on a new page (form 04: 7 pages).
- **Expected:** sections SHALL flow; headings SHALL stay with what follows; an item with its expressions, and a table row, SHALL not be split.
- **Unchanged:** no app chrome in print.

## K6. Raw Markdown is hard to read
- **Current:** WHEN the Markdown is written, THE SYSTEM escapes every punctuation mark (`1\.0\.0\.1`, `Yes\/No`).
- **Expected:** THE SYSTEM SHALL escape only what could become markup where it stands; R3.4 SHALL still hold.
- **Unchanged:** code spans for expressions and link-like text.

## K7. Downloads say nothing
- **Current:** WHEN "Download Markdown" saves a file, THE status line says nothing; after "Download documentation", focus falls to the page body.
- **Expected:** both SHALL say in the status line what was saved, and focus SHALL stay on the button pressed.

## K8. "Download documentation" is hidden in "Export plan"
- **Expected:** THE Triage screen SHALL show "Download documentation" as its own button.

## K9. "Not known" for most connections
- **Current:** WHEN a connection has no address (e-mail, hosting page, a relative SharePoint location), THE SYSTEM says "Not known".
- **Expected:** THE SYSTEM SHALL say what is known for each kind; "Not known" only when nothing can be said.

## K10. "Manual:" pasted in
- **Current:** THE SYSTEM ends connection sentences with spec 12's "Manual: needs a REST source or an Assets lookup".
- **Expected:** THE replacement SHALL be a sentence a form owner understands.

## K11. Paths inside sentences
- **Current:** WHEN a node has no FormIR entry, THE SYSTEM puts its id (`f:main:/my:…`) in the sentence.
- **Expected:** THE node SHALL be named by its own name, with its path under the sentence.

## K12. Tab from the heading leaves the screen
- **Current:** WHEN the heading has focus, Back, Download and Print come before it, and Tab goes to the footer.
- **Expected:** Tab from the heading SHALL go to the screen's buttons.

## K13. Opening corrects stored values silently
- **Current:** WHEN form 04 record 004 opens in Fill, THE SYSTEM changes VAT and the total, says nothing in the status line, and traces "because Subtotal changed".
- **Expected:** THE status line SHALL say how many stored values differ from the form's own formulas and that the form's values are shown; THE trace SHALL say the stored value differs from the formula.
- **Unchanged:** Fill off shows the stored values; empty values are still "worked out".

## N1. Undo is not in the Rule Trace
- **Expected:** WHEN Undo or Redo is used, THE Rule Trace SHALL add an entry naming each field that changed and its value now.

## N2. Export records while filling confirms nothing
- **Expected:** WHILE Fill is on, THE status line SHALL show the export's sentence until the next command.

## N3. "Insert item" prints
- **Expected:** WHEN the paper prints, read mode or Fill, THE "Insert item" placeholders SHALL not print.

## D1. The same message twice (found by the R4.3 test)
- **Current:** WHEN two rules of one press submit or close, THE SYSTEM shows "Not available in the viewer…" twice.
- **Expected:** a message SHALL be shown once per command.

## Not fixed in this round
- **N4.** Form 04's "Needed by" (a date field) has no type in the fields table: its schema type is not read as `date`. Seen in the K2 e2e output; not hunted further.
- **N5.** Fields table shows "No" for Required on the screen but leaves it blank in Markdown. Kept: a blank cell reads well in a Markdown table.
