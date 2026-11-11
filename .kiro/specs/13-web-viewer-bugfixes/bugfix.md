# Spec 13: web viewer bug fixes (bugfix spec)

Ten defects found by hand in the built web viewer (`apps/web`) on 2026-11-11, at `057927c`,
viewport 1280×800 unless a line says otherwise. Each section has the defect, the behaviour the fix
must give, and the behaviour that must keep working. Root causes and tests are in `design.md`.

## B1. Printing a form or a certificate gives a blank page

- **Current behaviour.** WHEN the user prints the form screen or the death certificate screen,
  THE SYSTEM prints a blank page (0 characters visible).
- **Expected behaviour.**
  - WHEN the user prints the form screen, THE SYSTEM SHALL print the paper as drawn (current view
    and record), scaled to fit the page width and never clipped, under one caption line (form
    name, view, record file name or "empty form"), without the header, toolbar, side panel or
    footer.
  - WHEN the user prints the certificate screen, THE SYSTEM SHALL print the certificate without
    the header, footer, "Back to Triage" or "Open form".
- **Unchanged behaviour.** Printing Triage gives the one-page plan, as before (spec 12 R5.2). On
  screen, nothing changes: the caption line is not shown.

## B2. The browser's Back button leaves the app

- **Current behaviour.** WHEN the user changes screen and then presses Back, THE SYSTEM leaves the
  page and every opened file is gone.
- **Expected behaviour.** WHEN the screen changes (form, Triage, certificate), THE SYSTEM SHALL add
  one history entry; WHEN the user presses Back or Forward, THE SYSTEM SHALL show the screen of
  that entry with the session intact. The URL does not change.
- **Unchanged behaviour.** The in-app buttons ("Triage", "Back to Triage", "Open form") work as
  before. Back from the first screen leaves the page, as on any site.

## B3. The same file opened twice is added twice

- **Current behaviour.** WHEN the user opens a file whose bytes are already open, THE SYSTEM adds
  it again (a second template shows Triage with "2 forms"; a second record doubles the pager).
- **Expected behaviour.** WHEN a file whose bytes are already open is opened again, under any
  name, THE SYSTEM SHALL NOT add it; IF it is a template, THE SYSTEM SHALL show that template; and
  THE SYSTEM SHALL show a note that names the file as already open.
- **Unchanged behaviour.** Different files open as before, including two versions of one form
  (forms 01 and 07) and a template opened after its records.

## B4. Records that arrive are not shown

- **Current behaviour.** WHEN a template opens with its records, or a record arrives for the open
  template, THE SYSTEM stays on "Empty form".
- **Expected behaviour.** WHEN records arrive for the template that is open after the answer, THE
  SYSTEM SHALL show the first of them in pager order; "Empty form" SHALL stay reachable with
  Previous.
- **Unchanged behaviour.** A template with no records opens on the empty form. An answer with no
  new record for the open template keeps the record shown. A form opened from Triage starts on the
  empty form unless its records arrived with it.

## B5. Escape does not close a menu

- **Current behaviour.** WHEN a menu ("Try a sample", "Export plan") is open and the user presses
  Escape, THE SYSTEM keeps it open.
- **Expected behaviour.** WHEN a menu is open and the user presses Escape, THE SYSTEM SHALL close
  it and move focus to its summary button. WHEN the user clicks outside an open menu, THE SYSTEM
  SHALL close it.
- **Unchanged behaviour.** Choosing an item still closes the menu and runs the item.

## B6. Focus and scroll are lost on screen changes

- **Current behaviour.** WHEN the user opens a certificate from Triage and goes back, THE SYSTEM
  drops focus to `<body>` and shows Triage from the top.
- **Expected behaviour.** WHEN a certificate or a form screen opens, THE SYSTEM SHALL move focus to
  its heading. WHEN the user returns to Triage, THE SYSTEM SHALL restore its scroll position and
  focus the button of the certificate it was left from.
- **Unchanged behaviour.** Opening files, paging and switching views do not move focus.

## B7. The page title never changes

- **Current behaviour.** WHEN the screen changes, THE SYSTEM keeps the landing page's title.
- **Expected behaviour.** THE SYSTEM SHALL title each screen with its name first, followed by
  " · InfoPath Afterlife": the form name, "Triage: 48 forms", "Death certificate: <form>".
- **Unchanged behaviour.** The landing page keeps "InfoPath Afterlife: open old InfoPath forms in
  your browser".

## B8. The Triage table cannot be scrolled from the keyboard

- **Current behaviour.** WHEN Triage is shown at 390×844, THE SYSTEM offers a sideways scroll box
  with no tab stop, role or label.
- **Expected behaviour.** THE SYSTEM SHALL make the scroll box a focusable region named "Table of
  forms", with a visible focus ring.
- **Unchanged behaviour.** The table, its "Triage" region and its buttons are as before.

## B9. Header button labels wrap at 390 px

- **Current behaviour.** WHEN the form screen is shown at 390×844, THE SYSTEM wraps button labels
  inside the buttons ("X-" / "ray", "Open" / "files").
- **Expected behaviour.** THE SYSTEM SHALL keep every button label on one line and wrap the header
  as a row instead, with no sideways page scroll.
- **Unchanged behaviour.** At 1280×800 the header is one row, as before.

## B10. "Files not opened" is not announced

- **Current behaviour.** WHEN a drop holds files that are not opened (`note.txt`) or records with
  no open template, THE SYSTEM shows the list but announces nothing.
- **Expected behaviour.** WHEN such a drop ends, THE SYSTEM SHALL announce that drop's files not
  opened and records not matched once, politely.
- **Unchanged behaviour.** The visible lists "Files not opened (n)" and "Records not matched (n)"
  are as before.

## Properties

- **P12 (B3).** For any list of files with repeats, opened in any order and in any number of
  batches, the session holds each distinct file once, and reports every other copy as a
  duplicate.
- **P13 (B2).** For any sequence of screen changes followed by the same number of Back steps, the
  app is on the screen it started from; the same number of Forward steps replays the sequence.
