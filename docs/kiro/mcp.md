# MCP servers for Kiro

There is one MCP server, defined in the agent file `.kiro/agents/afterlife.json` (added in
commit `84c1766`). There is no workspace `.kiro/settings/mcp.json`; that path stays in
`.gitignore` in case a server with a token is added later.

## `playwright`: `@playwright/mcp` 0.0.85

Started by the agent as `npx -y @playwright/mcp@0.0.85` with these flags:

| Flag | Why |
|---|---|
| `@0.0.85` (pinned) | The tool set and its output change between releases; an upgrade is a reviewed change. |
| `--headless` | No window on the developer's screen; the same in CI. |
| `--isolated` | A fresh profile in memory for each session: no cookies, storage or history from earlier runs or from the developer's own browser. |
| `--viewport-size 1280x800` | The size the e2e suite and `ux-principles.md` use; journeys resize from there (390 × 844, 640 × 400). |
| `--snapshot-mode none` | No accessibility snapshot after every action. Snapshots of form 08's paper run to thousands of lines; the agent asks for a snapshot of one part, or uses `browser_evaluate` for exact questions. |
| `--image-responses omit` | Screenshots are not sent back inline. They are saved and opened with the read tool only when needed. |
| `--output-dir /tmp/afl-mcp` | Screenshots, downloads and traces go outside the repo, so nothing under `samples/` or in git is touched. |
| `--allowed-origins http://localhost:4331` | The browser can reach only the local preview of the built app: no third-party request, and no way to reach the network from a page under test. |
| `timeout: 60000` | Building is done before the server is used; 60 s covers a cold `npx` start. |

The app is served for it with `vite build` and then
`vite preview --base /infopath-afterlife-app/ --port 4331 --strictPort` in `apps/web`, the same
base path as the e2e config. The server is stopped at the end of the turn.

## Use so far

### Turn 62: hunting Fill-mode defects (spec 14)

About 50 calls, 13 screenshots. Most calls were `browser_run_code_unsafe` scripts that walk one
journey (Fill on form 02, form 04's buttons and Rule Trace, form 05's views, form 10 record 1, a
keyboard-only pass, X-ray, print, Back and Forward, opening files, dark scheme and 640 × 400)
and return geometry, focus and text in one answer, plus `browser_take_screenshot` at each
journey's key moment.

Found by looking, and not by any suite (the suites passed on the code they were found on):

- **B7**, Rule Trace sentences cut off at the side panel's edge: seen in the dialog screenshot.
  No test measured an entry's width.
- **B8**, XPath inside skipped-action sentences: read on screen. The spec 04 tests checked the
  query sentence only.
- **B10**, the discard question says "this form" when the changes are on another form or
  record. While looking, it first seemed that opening a file dropped the changes; they were on
  record 1 while the screen showed the empty form, and the misleading question was the defect.
  No test turned Fill on away from the session's form.
- **B11**, focus to the page body after a view button: the e2e suite pressed the button by
  keyboard, where focus happened to stay; clicking it, as a person does, loses focus.
- **B12**, focus to the page body after opening a sample from the landing page: the spec 13 test
  started from Triage.
- **B9** (the reviewer asked to decide it): confirmed by doing download, undo, redo, leave.

K1, K2 and K4 to K6 were reproduced the same way before they were fixed; K1 and K2 were checked
again on screen after the fix.

## Turn 69: hunting the Records, Documentation and Archive screens (spec 19)

The built app was served on port 4331 (`vite preview`) and walked through seven journeys:
Records on forms 02 and 08 (find, sort, open, walk, Back) at 1280×800 and 390×844; Fill on,
then Records; Documentation of forms 04 and 05 on screen, in print and at 390 px, with both
downloads; "Archive as web pages" from the form screen (form 05, two of three views) and from
Records with Find, with Cancel half way through 600 generated records; keyboard only from the
landing page; dark colours and 200% zoom (640×400); Triage, a certificate, Documentation, Back
and "Download documentation".

16 MCP calls, 9 screenshots. Most calls were `browser_run_code_unsafe` walking a whole journey
and returning exact answers (focus, computed colours, widths, status text); screenshots only for
layout. Two calls were lost to a `beforeunload` question left open by the Fill journey (the
question itself is correct: there were unsaved changes); a new tab cleared it.

Defects that only showed up by looking:
- **F1**, the list shows a dropdown's stored code ("FIN", "GBP") where the paper shows its name
  ("Finance", "Pound sterling"), so Find "finance" found nothing. Every test searched codes.
- **F2**, **F3**, focus fell to the page body after an archive finished and after Cancel: the
  menu closed and the Cancel button went away. No test asked where focus was.
- **F4**, from Find to the first record is one Tab per column: 13 on form 02, about 205 on
  form 08 (203 columns).
- **F5**, at 200% zoom the records box was 176 px high, three rows, inside a page that also
  scrolls.
- **R1** was confirmed by doing it (the reviewer's steps).

One thing that looked wrong was not: form 08 shows 43 as "4,3". Spec 03 records that InfoPath
does the same for `grouping:1` (seen in form 08's screenshot).

## Turn 73: the first five minutes, as a newcomer (spec 22)

The built app on port 4331, at 1280×800 and 390×844: the landing page and each task's first
action; a person's own files (a template alone, records without their template, a template with
another form's records, a `.pdf`, a `.docx`, a broken `.xsn`, a `.zip` of two forms); the summary
on sample 02 with every Count, Group by and Total of a person would try; one long session from
Fill to the archive; dark colours on the landing page and the summary. Offline was skipped (the
reviewer verified it); journey 2 was left to S4 and S5.

17 MCP calls, 2 screenshots. Four calls were lost: one to a `beforeunload` question left by the
fill journey (a new tab cleared it), three to waits on elements a journey had not reached.

Defects that only showed up by looking:
- **F1**, the first click after a task lands does nothing. Every e2e test checked the landing
  state; none clicked anything after it. It hit Next, Summarize, "Web pages to keep" and
  "Download Markdown" alike.
- **F2**, dropping files that open nothing leaves the screen as it was: the explanation is below
  the fold. The tests read the lists by role, wherever they were.
- **F5**, **F7**, the task's address and an archive's status line outlive their screens; seen
  only in one long session.
- **F6**, focus to the page body after an Excel export.
- **F8**, the bar vanishes on the chosen line in dark colours (equal computed colours).
- **F9**, the Triage tip promises sorting; the table has none.
- **F4**, an empty summary table after a Find with no match.
