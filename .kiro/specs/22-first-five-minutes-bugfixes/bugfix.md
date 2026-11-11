# Spec 22: the first five minutes

Found by the reviewer on `0ad4641` (S1–S6) and by walking the built app as a newcomer through the
Playwright MCP server in turn 73 (F1–F9, `docs/kiro/mcp.md`).

## S1. Back from a record closes the summary and drops the chosen group
- **Current:** Records, Summarize, Count "Expense rows", Group by "Type", "Meals", open a record,
  Next, Records: "30 records.", the summary closed, its choices gone.
- **Expected:** coming back SHALL restore the summary, its choices and the chosen group (spec 17).

## S2. "Download CSV" confirms nothing
- **Expected:** the status line SHALL say "Saved <file>: the summary, N groups and the line for
  all." and focus SHALL stay on the button (spec 16 K7).

## S3. Counts have no thousands separator
- **Expected:** counts a person reads SHALL be written "5,000"; the CSV keeps raw numbers.

## S4. Forward after Back loses the task
- **Current:** for `#read`, `#rules`, `#fill`, `#keep` Forward shows the empty form; `#triage`
  shows the landing page.
- **Expected:** Forward SHALL show what Back left, for every task.

## S5. An unknown address typed while the app is open keeps its hash and loses focus
- **Expected:** as on a cold load: the hash removed, focus on "Start with a task".

## S6. Focus falls to the page body after "Close tip"; to an unnamed div after "Keep filling"
- **Expected:** after Close tip, the screen's heading; after Keep filling, what had focus before
  the question, inside the paper too.

## F1. The first click after a task lands does nothing (found by looking)
- **Current:** `#read` → Next: still record 1. `#find` → Summarize: no summary. `#keep` → "Web
  pages to keep (.zip)": no download. `#document` → "Download Markdown": no download.
- **Cause:** the first-step line was removed on `pointerdown`; the screen moved up under the
  pointer, and press and release landed on different elements.
- **Expected:** the first click SHALL do what it says; the line goes after it.

## F2. Files that open nothing change nothing on screen (found by looking)
- **Current:** records without their template, or a `.pdf` and a `.docx`: the landing page looks
  the same; the lists that explain are below the fold and focus is on the page body. A record
  without its template is not told what to do.
- **Expected:** the lists SHALL come first, the first one focused; a record without its template
  SHALL say "Drop the form's .xsn template too, and the record opens with it."

## F4. A summary of nothing found draws an empty table (found by looking)
- **Expected:** "Find matches no record, so there is nothing to summarize."

## F5. The address keeps a task's hash on every later screen (found by looking)
- **Current:** `#triage`, a certificate, a form, an export: the bar still reads `#triage`.
- **Expected:** a later screen's entry SHALL have no task address.

## F6. Focus falls to the page body after an Excel or CSV export (found by looking)
- **Expected:** back on the "Export records" menu, as after an archive (spec 19 F2).

## F7. A status line outlives its screen (found by looking)
- **Current:** "Archived 20 records…" still shows on the certificate and on Triage after Back.
- **Expected:** a notice SHALL go when the screen changes.

## F8. In dark colours the bar vanishes on the chosen line (found by looking)
- **Current:** both are `rgb(28, 43, 66)`.
- **Expected:** the chosen line uses the neutral background.

## F9. The Triage task's first step promises sorting the table does not have (found by looking)
- **Expected:** "One row per form, with its wave. Open a form's death certificate to see what
  stops it."

## Not fixed in this round
- **F10.** Back from Records returns to the form at the record last opened from the list, not the
  record the person was on before Records: history keys a form by template only (spec 13). Small;
  the position line says which record it is.
- **F11.** With unsaved Fill changes the Records button goes to the list without asking; the
  question comes when a record is opened (spec 19 R1). The list cannot lose the changes, so this
  is the intended order.
- **F12.** "Choose a group to list its records." stays in the caption when one group is chosen.
  Taste.
- Journey 6 (offline) was skipped: the reviewer verified it on `0ad4641`.
