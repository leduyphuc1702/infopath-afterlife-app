# Spec 19: records list, archive and dossier bugfixes

Found by the reviewer on `6d27aab` (T1, A1–A4, R1–R5, P1–P5) and by looking through the
Playwright MCP server in turn 69 (F1–F5, `docs/kiro/mcp.md`).

## T1. `pnpm check` goes red on a busy machine
- **Current:** WHEN the machine is loaded (load average about 11), seven core tests that run
  hundreds of cases or megabytes of data pass the default 5 s limit, and three browser tests fail
  on time.
- **Expected:** such tests SHALL have a time limit with room for a machine three times slower; a
  performance budget SHALL stay the same, and a miss SHALL be measured once more before it fails,
  with a message that says the machine may be busy.
- **Unchanged:** every run count and every budget.

## A1. A link in rich text leaves the archive; controls sit inside rich text
- **Current:** WHEN a record's rich text holds `<a href="http://…">`, THE archived page keeps the
  link; an `<input>` or `<button>` in rich text is drawn, on the paper and in the archive.
- **Expected:** THE archived page SHALL keep a link's words and show its address as text beside
  them, never as a link; form controls inside rich text SHALL not be drawn (a button keeps its
  words). P21 SHALL cover a rich-text form and hostile file names.

## A2. The form toolbar takes two rows at 1280 px
- **Expected:** THE archive SHALL be the third choice of "Export records", with the views to
  choose; the toolbar SHALL keep to one row at 1280 px. THE Records screen keeps its own button.

## A3. `index.html` squeezes long text to a word per line
- **Expected:** a cell of more than 40 characters SHALL get a readable width (24em).

## A4 and R3. "Failed checks" is the last column, blank for a clean record
- **Expected:** THE column SHALL come right after the file name, in the list and in the index,
  and a clean record SHALL say "None".

## R1. Records bypasses the unsaved-changes question
- **Current:** WHEN Fill has unsaved changes and the person opens another record from Records,
  THE SYSTEM asks nothing, and Previous back to the first record shows the unsaved value in read
  mode.
- **Expected:** opening a record from Records SHALL ask "Discard your changes?" as Previous and
  Next do; read mode SHALL show the record as stored.

## R2. Find does not look inside repeating rows
- **Expected:** Find SHALL match any value of the record; WHEN the match is in no column on
  screen, the row SHALL say where ("Type: Lodging").

## R4. No match gives an empty box
- **Expected:** THE box SHALL say "No record matches “…”." with a "Clear Find" button that brings
  the records back and puts focus in Find.

## R5. Phone
- **Expected:** at 390 px the file name SHALL keep at most two fifths of the width; the next
  column SHALL be Failed checks (R3).

## P1. The printed fields table breaks words
- **Expected:** in print, words in the fields table SHALL stay whole; only a path may break.

## P2. Undo and Redo entries carry UTC time
- **Expected:** THE entry SHALL carry the person's clock, as every other entry does.

## P3. Markdown leftovers
- **Expected:** a dotted name (host, file, e-mail) SHALL be a code span; leading spaces SHALL be
  dropped; a number SHALL be escaped only where it could start a list (`1. `).

## P4. "What could not be read" shows core's raw messages
- **Expected:** each issue SHALL be a sentence in words, with its file and line, and its path or
  id under the sentence; UNRESOLVED_REFERENCE SHALL not repeat the per-element sentence.

## P5. A Redo entry shows float noise
- **Expected:** a number SHALL show at most 15 significant digits, as InfoPath writes it
  (1472.13, not 1472.1299999999999).

## F1. The list shows a dropdown's code, the paper its name (found by looking)
- **Current:** form 02's Department reads "SAL" in Records and "Sales" on the paper; Find
  "finance" finds nothing.
- **Expected:** THE list SHALL show, sort and find the name the view's dropdown shows.

## F2, F3. Focus falls to the page body after an archive and after Cancel (found by looking)
- **Expected:** focus SHALL return to the menu that started the archive.

## F4. From Find to the first record takes a Tab per column (found by looking)
- **Current:** 13 Tabs on form 02, about 205 on form 08.
- **Expected:** Enter or Down in Find SHALL go to the first record; Up and Down SHALL move
  between records.

## F5. At 200% zoom the list shows three rows (found by looking)
- **Expected:** at 640×400 the box SHALL be at least 250 px high (70% of the window).

## Not fixed in this round
- **F6.** The Records screen's archive menu and the form screen's choice keep separate view
  choices; unticking a view in one does not untick it in the other. Small; each menu says what
  it holds.
- **F7.** Both archives of one form are named `<form>-archive.zip`; a second download gets the
  browser's " (1)". Taste.
- **P5 (rest).** The stored value itself: core's calculation writes `1472.1299999999999` into
  the record, where InfoPath writes 15 significant digits. Only the trace was asked for; the
  runtime's number output is a spec 04 change with goldens to re-run.

## Leftovers after review (`732a9e7`)

### T2. A flaky property in `test/dossier/bugfixes16.test.ts`
- **Current:** "unescaping gives the text back" fails about one run in three
  (`["0)\u0000", false]`, seed 1941761470): it still forbids any `\d+[.)]` at the start.
- **Expected:** the assertion SHALL say what P3c promises: a number followed by `.` or `)` and
  then a space, a tab or the end never reaches the text unescaped. The counterexample is pinned
  as an example.

### R6. On a phone every file name in the list reads the same
- **Current:** at 390 px all thirty rows of sample 02 show "02-expense-report…".
- **Expected:** the end of the name SHALL show ("…report-001.xml"), so the rows read
  differently. Rows are a fixed 36 px (the list draws only the rows in sight), so the name keeps
  to one line and the cut moves to its start; the full name stays the button's name and title.
