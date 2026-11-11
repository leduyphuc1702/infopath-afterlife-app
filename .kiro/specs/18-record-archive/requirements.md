# Spec 18: archive records as web pages

Old records are stuck (pain N4): they must stay readable for years, after InfoPath and after this
app. The export (spec 09 R12) keeps the data; this keeps what each record looked like, as files
that need nothing but a browser. No brief; the scope is the turn 68 prompt.

## Requirements

Traces: Added: turn 68 prompt.

- **R1** WHEN the open form has loaded records, THE form screen SHALL offer "Archive as web
  pages" beside "Export records", with the form's views to choose (all chosen at first); THE
  Records screen (spec 17) SHALL offer it for the records found, in the list's order.
- **R2** WHEN the person archives, THE SYSTEM SHALL save one `.zip` with one `.html` page per
  record and chosen view, `index.html`, `README.txt`, and the records' attachments and pictures
  under `attachments/`, named as the CSV export names them.
- **R3** EACH page SHALL hold the view rendered as on the paper in read mode, its styles inside
  the file, and a foot naming the form, its version, the template file, the record file, the
  view and the archive date and time.
- **R4** EACH page SHALL link to `index.html`, to its record's other views, and to each of its
  record's files under `attachments/`.
- **R5** `index.html` SHALL be a table of the archived records, in the archive's order, with the
  columns of the records list (spec 17 R2–R4), each file name linking to its first page.
- **R6** EVERY `.html` file SHALL carry `<meta http-equiv="Content-Security-Policy">` allowing
  only inline styles and `data:` images, and SHALL hold no script, no event handler and no URL
  that leaves the archive.
- **R7** `README.txt` SHALL say what the archive is, what made it, and that it needs only a
  browser.
- **R8** WHILE the archive is made, THE status line SHALL say "Archiving record N of M: <file>"
  and offer Cancel; WHEN Cancel is chosen, THE SYSTEM SHALL stop and save nothing, and say so.
- **R9** IF a record cannot be read or drawn, THE archive SHALL still hold its page with the
  reason, and THE status line SHALL count those records.
- **R10** THE record limits of the export SHALL apply, and the work SHALL run in the Worker.
