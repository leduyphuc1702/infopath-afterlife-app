# Spec 14: Fill mode bugfixes

A round of defects in Fill mode (spec 04), found on commit `70f873f`. K1 to K6 came from the
reviewer; the others were found by the agent through the Playwright MCP server on the built app
(turn 62, `docs/kiro/mcp.md`). B1 to B6 are K1 to K6.

## B1. The row menu is clipped by its table cell (K1)

- **Current behaviour:** WHEN a person opens "Actions for row 2 of Expenses" on form 02 with the
  mouse, THE SYSTEM draws the menu inside the row's last cell, whose `overflow: hidden` cuts
  "Insert below" in half and hides "Remove".
- **Expected behaviour:** WHEN a row menu opens, THE SYSTEM SHALL draw every menu item whole and
  on top, so the point at the centre of each item hits that item.
- **Unchanged behaviour:** the menu's keyboard (arrows, Home, End, Escape, Tab), its names, the
  commands it sends, and the focus rules of spec 04 task 9.

## B2. The "⋯" button covers the row's content (K2)

- **Current behaviour:** WHEN a row has text in its last cell (form 02's receipt file name), THE
  SYSTEM draws the row button on top of that text.
- **Expected behaviour:** THE SYSTEM SHALL draw each row button where it covers no visible part
  of its row, and keep it in the row's Tab order.
- **Unchanged behaviour:** the paper's layout and goldens; the button's name and keys; print
  hides it.

## B3. The toolbar wraps (K3)

- **Current behaviour:** WHEN Fill is on at 1280 px with the side panel open, THE SYSTEM wraps
  "Redo" and "Download XML" to a second toolbar row; at 390 px the toolbar takes six rows.
- **Expected behaviour:** WHILE Fill is on, Undo, Redo and Download XML SHALL be in their own
  toolbar, "Fill", at the end of the status line, on one row; the "Views and records" toolbar
  SHALL keep to one row at 1280 × 800 and to at most three at 390 × 844.
- **Unchanged behaviour:** the buttons' names, shortcuts and disabled states; the deferred
  1280 px note of spec 04 is closed by this fix.

## B4. Opening a record rewrites stored calculated values (K4)

- **Current behaviour:** WHEN Fill opens form 04 record 1, THE SYSTEM recalculates every
  calculated field (D13) and writes "1423.9399999999998" over the stored "1423.94", traces it,
  and Download XML writes it into a record nobody changed.
- **Expected behaviour:** WHEN a record opens, a stored value equal to the recalculated number
  at the precision it was stored with SHALL stay as stored, with no trace entry; later, a
  recalculated number equal to the stored one but for float noise SHALL not be written either.
- **Unchanged behaviour:** an empty stored value is still worked out, traced and counted in the
  status line (form 10); a stored value that disagrees is corrected; edits recalculate as before.

## B5. "Check budget" looks dead (K5)

- **Current behaviour:** WHEN a person presses a button whose rules are skipped (form 04 "Check
  budget"), THE SYSTEM changes nothing and says so only in the Rule Trace tab.
- **Expected behaviour:** THE SYSTEM SHALL say in the status line, in one sentence, that the
  button ran only in part and why, until the next command.
- **Unchanged behaviour:** no dialog; the trace entries; the stored budget stays.

## B6. Undo and Redo drop focus to the page (K6)

- **Current behaviour:** WHEN a person changes Qty on form 04 and clicks Undo, THE SYSTEM
  disables Undo and focus falls to the page body; Redo does the same.
- **Expected behaviour:** WHEN Undo or Redo is used, focus SHALL go to the field the step
  changed, from the toolbar and from the keys.
- **Unchanged behaviour:** undoing a row insert puts focus back on "Insert item" (spec 04).

## B7. Rule Trace entries run out of the side panel

- **Current behaviour:** WHEN an entry holds a long word without spaces (form 04 "Check budget":
  `xdXDocument:GetDOM("BudgetService")/dfs:myFields/…`), THE SYSTEM widens every entry past the
  panel, and the end of each sentence is cut off.
- **Expected behaviour:** every Rule Trace entry SHALL wrap inside the side panel.
- **Unchanged behaviour:** the entry order, filter, hover and focus outline.

## B8. Skipped entries show XPath in the sentence

- **Current behaviour:** WHEN a rule action is skipped, THE SYSTEM writes the XPath into the
  sentence ("GetDOM("BudgetService") was skipped", "… did not set a field.
  xdXDocument:GetDOM(…)/dfs:… selects no field").
- **Expected behaviour:** skipped entries SHALL read as sentences without XPath; the expression,
  when there is one, SHALL be behind "Show expression".
- **Unchanged behaviour:** the other sentence kinds and the query sentence of spec 04 task 11.

## B9. Undo back to the downloaded record still asks about changes

- **Current behaviour:** WHEN a person downloads the XML, changes a field and undoes the change,
  THE SYSTEM still asks "Discard your changes?" on leaving Fill.
- **Expected behaviour:** "changes" SHALL mean the record differs from the last download (or
  from the record as opened); leaving with none SHALL not ask.
- **Unchanged behaviour:** leaving with real changes asks (spec 04 R6.4).

## B10. The discard question names the wrong form

- **Current behaviour:** WHEN Fill has changes on one form or record and the person turns Fill
  on for another (after opening another file or sample, or from Triage), THE SYSTEM asks
  "You changed this form…", about a form on screen that has no changes.
- **Expected behaviour:** WHEN the changes are on another form or record than the one shown,
  the question SHALL name that form and record, e.g. "You changed Expense Report (the empty
  form) and haven't downloaded the XML."
- **Unchanged behaviour:** opening another file or sample keeps the fill session, and Back
  returns to it (spec 04 task 7); the question on the form itself keeps its words.

## B11. A view button drops focus to the page

- **Current behaviour:** WHEN a person clicks a view-switch button (form 05), THE SYSTEM shows
  the new view and focus falls to the page body.
- **Expected behaviour:** focus that was in the paper SHALL stay in it: on the new view's first
  control when its old place is gone.
- **Unchanged behaviour:** focus restore after a commit (R6.3) and after row changes.

## B12. Opening a sample from the landing page leaves focus nowhere

- **Current behaviour:** WHEN a person opens a sample from the landing page by keyboard, THE
  SYSTEM removes the button they pressed and focus falls to the page body.
- **Expected behaviour:** the form screen's heading SHALL take focus, as on every other screen
  change (spec 13 B6).
- **Unchanged behaviour:** focus and scroll on Triage, certificate and Back (spec 13 B6).

## Not fixed in this round

- **N1. The Rule Trace says nothing about Undo.** After Undo, its newest entries describe values
  no longer on the paper. Needs a new entry kind in core's `TraceEntry` (D25); left for the
  spec 04 docs task.
- **N2. Export records gives no confirmation while filling.** The status line keeps the Fill
  sentence, so "Exported …" is not shown; the download itself works. Low harm.
- **N3. "Insert item" prints.** It is part of the render (spec 03), in read mode too; InfoPath's
  print hid it. A print-CSS change to the render belongs to spec 03.
