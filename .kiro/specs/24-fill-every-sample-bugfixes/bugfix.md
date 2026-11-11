# Spec 24: Fill on every sample

W1–W4 and X1–X5 were found by the reviewer on `c55f031` (a script over 47 own and 29 private
templates, and axe-core 4.14). D1 and D2 were found by filling samples 01, 03, 05–08 and the
Weight keeper through the Playwright MCP server (turn 76).

## W1. Undo after typing in a rich text box blanks the whole page
- **Current behaviour:** WHEN a person types in a rich text box (06 "What happened", 42 "Root
  cause"), leaves it and chooses Undo, THE SYSTEM throws `IndexSizeError` from `Range.setStart`
  and React unmounts everything: no paper, no toolbar, no Download XML. 12 of the 47 own
  templates do it.
- **Expected behaviour:** Undo SHALL restore the text and put the caret back. WHEN anything
  fails while the paper is drawn, THE SYSTEM SHALL keep the toolbar, say in plain words that the
  form could not be drawn, and offer Download XML (the record is in the Worker) and "Back to the
  start".
- **Unchanged behaviour:** caret and focus after every other commit, undo and redo (spec 04 R6.3,
  spec 14 B6).

## W2. The calendar button in a date box does nothing
- **Current behaviour:** WHEN a person clicks the calendar beside "Needed by" (04), THE SYSTEM
  does nothing; spec 23 took it out of the tab order and hid it.
- **Expected behaviour:** THE SYSTEM SHALL open the browser's date picker; the date SHALL go in
  as a typed date does (one undo step, the trace, the XML); the button SHALL be named "Choose a
  date for <box>" and be in the tab order. A read-only date box keeps its button hidden.
- **Unchanged behaviour:** typing a date (Short Date or ISO).

## W3. A record from a template without a form ID does not open with that template again
- **Current behaviour:** WHEN `xsf:xDocumentClass` has no `name`, a downloaded record's
  instruction has no `name` either, and THE SYSTEM lists it under "Records not matched".
- **Expected behaviour:** a record with no `name` SHALL match the template with no form ID whose
  `publishUrl` is the record's `href` (compared as places: `file:///C:/Forms/a%20b.xsn` is
  `c:\forms\a b.xsn`). Download XML SHALL write the template's `publishUrl` as `href` when the
  record still says `href="manifest.xsf"`.
- **Unchanged behaviour:** matching by URN and version (spec 09 R2, P14).

## W4. A box bound to a secondary data source takes typing and keeps nothing
- **Current behaviour:** WHEN a box's binding is `xdXDocument:GetDOM("…")/…`, THE SYSTEM lets a
  person type; nothing reaches the record, the trace or Undo.
- **Expected behaviour:** the box SHALL be read-only, described as "Shows a value from the data
  connection “ItemMetadata”, which is not part of the record, so it can’t be changed here."
- **Unchanged behaviour:** boxes bound to the main data source.

## X1. Read-only boxes carry `aria-readonly` and `aria-label` on a role-less `span`
- **Expected behaviour:** a read-only box SHALL have role `textbox` with `aria-readonly`; other
  read-only controls drawn as a `span` (attachment, picture) SHALL be a named `group` without
  `aria-readonly`; a radio button gets no `aria-readonly`.

## X2. "Insert item" is named "Insert a row at the end of Lines" (WCAG 2.5.3)
- **Expected behaviour:** the name SHALL hold the words on screen: "Insert item: a row at the end
  of Lines"; a placeholder that already names its group keeps its words ("Click here to add:
  Relocation").

## X3. Sample 06's picture has no text alternative
- **Expected behaviour:** the `img` SHALL have the control's name as `alt`; the `span` is a named
  group (X1).

## X4. The Weight keeper's text box has no name
- **Current behaviour:** its `title` is empty, which spec 23's fallback did not treat as missing.
- **Expected behaviour:** an empty title SHALL fall back to the binding's name.

## X5. After Back while typing, "Keep filling" leaves focus on the page body
- **Current behaviour:** spec 23 B2 commits the typing, which draws the paper again, so the field
  it meant to refocus is no longer in the page.
- **Expected behaviour:** focus SHALL return to the same field, found again by its marks.

## D1. Typing in a rich text box drops its formatting without a word
- **Current behaviour:** WHEN a rich text box holds bold text or a list and a person types in it,
  THE SYSTEM stores plain text; nothing says so.
- **Expected behaviour:** the box SHALL be described, and the status line SHALL say on focus,
  "Typing in <box> keeps the words, not the formatting (bold, lists, links)."
- **Unchanged behaviour:** a box that holds plain text says nothing.

## P23
For any own template and any sequence of edits the runtime accepts (set a value, insert a row,
remove a row), undoing all of them gives the first record back, redoing all of them gives the
last, and the downloaded XML parsed again gives the same values.

## Not fixed in this round
- **D1, editing formatting.** Keeping bold, lists and links while typing needs a rich text editor
  that writes XHTML; the viewer edits text only (spec 04 R6.1). This round says so instead.
- **D2.** The Big form's date boxes are named "S1f01": InfoPath gave them no title, and the
  binding is all the file proves (product principle 5).
- Attachments and pictures stay read-only in Fill ("This control can't be edited in the viewer"),
  as spec 04 R6.2 says; attaching a file is out of this round's scope.
