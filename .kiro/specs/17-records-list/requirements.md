# Spec 17: the records list

A person is asked for "the expense report Kenji filed in June" and today has only Previous and
Next. Libraries of 36,000 records exist (pain N4); reporting over form data is pain N9. No brief;
the scope is the turn 66 prompt.

## Requirements

Traces: Added: turn 66 prompt.

- **R1** WHEN the open form has loaded records, THE form screen SHALL show a "Records" button
  beside the record position; it SHALL open the Records screen, whose heading takes focus, and
  browser Back SHALL leave it.
- **R2** THE Records screen SHALL show a table of every loaded record of the open form: file
  name, the template version that made it, one column per column of the export's Records sheet
  in the same order (headed by the field's label), and one count column per repeating group or
  field that is not inside another repeating one.
- **R3** WHERE a view shows a field with a number, currency or date format, THE table SHALL show
  its values in that format; number, date and count columns SHALL sort by value, and empty
  values SHALL sort last in both directions.
- **R4** THE table SHALL have a "Failed checks" column: how many fields fail validation when
  the record opens in Fill (the number the attention line shows), empty for none.
- **R5** WHEN the person types in Find, THE table SHALL show only the records with a shown value
  (file name, version, field values, counts) that contains the text, ignoring case.
- **R6** THE screen SHALL say in words how many records match ("3 of 30 records match"), in a
  polite live region.
- **R7** WHEN the person activates a column header (click, Enter or Space), THE table SHALL sort
  by it, ascending, then descending on the next activation; the header SHALL carry `aria-sort`;
  equal values SHALL keep file-name order.
- **R8** WHEN the person clicks a row, or presses Enter on its file name, THE form screen SHALL
  open that record.
- **R9** WHEN the person goes back from that record, THE Records screen SHALL show the same
  Find text, sort and scroll position, with focus on the record that was opened.
- **R10** WHILE a record opened from the list is shown, Previous and Next SHALL walk the shown
  rows in their order, and the position line SHALL say so ("Record 3 of 12 found").
- **R11** WITH 5,000 records, THE table SHALL draw only the rows near the screen; values SHALL
  be read in the Worker; Find SHALL not wait for the table to redraw. Times are measured and
  written in `verification.md`.
- **R12** THE table SHALL put every value in the page as text, never as markup.
