# InfoPath UX, written down before the last copy of it disappears

This is the reference the app is built against. InfoPath Forms Services was retired from
SharePoint Online on 2026-07-14 and the product itself is out of support, so the interaction
details below are not documented anywhere current. They were recorded from a working
installation: Microsoft InfoPath Filler 2013 (15.0.5603.1000, 32-bit) and InfoPath Designer
2013 on Windows 11 ARM, driven for two days while building the 42-form sample set.

Provenance tags, used on every claim:

- **[seen]** — observed on screen in that VM, captured in `samples/own/screenshots/` or read
  from the running application.
- **[format]** — read out of the `.xsn` files in `samples/own/` (manifest, XSD, view XSL).
- **[doc]** — Microsoft documentation that still exists in archives; not re-verified here.
- **[guess]** — plausible and useful, but not verified. Do not treat as a requirement.

A claim without a tag is a synthesis of the above and should be re-checked against the
screenshots before it is turned into a test.

---

## 0. Two applications, two audiences

InfoPath shipped as two programs sharing one document format:

| | Filler (`INFOPATH.EXE`) | Designer (`INFOPATH.EXE /design`) |
|---|---|---|
| Used by | the person filling the form | the person who built it, usually once, years ago |
| Ribbon | `File`, `Home`, `Insert` **[seen]** | `File`, `Home`, `Insert`, `Page Design`, `Data`, `Developer` **[seen]** |
| Tool panes | none by default | Design Tasks, Fields, Controls, Data Source, Rules **[seen]** |
| Typical session | 2–10 minutes, once per request | days or weeks, once in the form's life |

Almost every complaint about InfoPath is about the second column: the form exists, the person
who understood it is gone, and nothing in the Filler UI explains what the form does. That
asymmetry is the product opening for us: the people who need help are the ones who only ever
saw the first column.

---

## 1. Window anatomy (Filler, 1024x768 guest, 100% zoom) **[seen]**

Top to bottom:

1. **Quick Access Toolbar** — Save, Print, Undo, Redo. The first two are always enabled; Undo
   is greyed until the first edit.
2. **Title bar** — `<record file name> - InfoPath`, centred. Not the form's display name: the
   file name, so `01-leave-request-001 - InfoPath`. In Designer: `(Design) <template> - InfoPath`.
3. **Ribbon tab strip** — `FILE` (coloured tab, left) then `HOME` and `INSERT`. A `^` chevron at
   the far right collapses the ribbon. Right of the tabs: `?` (help), window buttons, and a
   `Sign in` label with a dropdown chevron (Office account).
4. **Ribbon, Home tab** — five groups, left to right: **Submit** (one large button labelled
   Submit, with a dropdown arrow under the label), **Clipboard** (Paste large; Cut, Copy, Format
   Painter), **Font** (font name, size, bold, italic, underline, highlight, colour), **Paragraph**
   (bullets, indent, alignment), **Font Styles** (a live gallery: Normal, Title, Heading 1,
   Heading 2, each swatch rendered in the real style), **Editing** (Spelling with a blue tick,
   Find, Replace, Select All).
5. **The page** — a white page on a grey field, filling the window width at 1024 px. No page
   shadow is visible at this width. One vertical scrollbar on the right.
6. **Status bar** — one line of small caps: `FORM TEMPLATE'S LOCATION: C:\FORMS\01-LEAVE-REQUEST.XSN`.
   Nothing else is displayed: no page count, no validation state, no zoom percentage (zoom lives
   in the View tab, which Filler does not have).

Two labels in the window are frozen in English even in a localized Office: the status bar
caption and the `Sign in` control **[seen]**.

---

## 2. The page and its type

- Body text is **Calibri 10**; the form title is set in a strong blue (~`#1F3864` or close) at
  roughly 17–18 px, bold **[seen]**.
- Content is laid out in a table whose borders are about 1 px `#BFBFBF`; label cells hold bold
  text, value cells hold the control **[seen]**.
- The page is authored with a fixed width. At 1024 px it fills the window; a narrower window
  produces a horizontal scrollbar rather than reflowing **[guess — the sample forms are
  table-based, which cannot reflow]**.
- The form's own styling, not the runtime, decides how a control looks. In
  `02-expense-report-Claim-filled.png` the text fields inside the repeating table are drawn with
  a bottom border only; in `01-leave-request-Request-filled.png` the same control type has a full
  box. Same InfoPath build, same day **[seen]**. Anyone building a viewer must render the view's
  XSL and resist restyling it.

---

## 3. Field states

| State | Appearance | Evidence |
|---|---|---|
| Normal, focused | 2 px solid border in the accent blue, caret visible; the rest of the form unchanged | **[seen]** in every screenshot, the top field |
| Normal, unfocused | 1 px solid `#7F9DB9`-ish border, white background | **[seen]** |
| Required and empty | red asterisk `*`, a few pixels inside the right edge of the control, vertically centred. No border change, no message | **[seen]** `01-leave-request-Request-empty.png`: Employee name, First day of leave, Last day of leave carry the asterisk; Department does not |
| Empty dropdown | shows the placeholder authored into the form (`Select...`), still 1 px bordered, chevron at the right edge | **[seen]** |
| Invalid | 1 px **dashed red** border instead of the solid one, plus a message on hover. The asterisk stays | **[doc]** — not captured; see §5 |
| Read-only / calculated | renders as plain text with no border and no caret, in the same font as the body | **[seen]** `Working days` (`9`) and `Total` (`$350.30`) |
| Disabled | grey text, still no border | **[doc]** |
| Empty date picker | empty box with a small calendar button pinned to the right edge, 1 px separator between them | **[seen]** |

The asterisk is the only always-visible affordance, and it is tiny: about 8 px, `#FF0000`, a few pixels
inside the right edge. Nothing else on screen tells a new user that a field is required until they
leave it.

---

## 4. Controls, as they actually behave

### Text box
Single line by default, Enter does not insert a newline; it moves focus on (InfoPath treats the
control as `<input>`) **[guess]**. Text is left-aligned, vertical padding 3–4 px, so a row is
about 28 px tall at Calibri 10 **[seen]**. All validation happens on blur, not per keystroke
**[doc]**.

### Date picker
Value is shown as `M/D/YYYY` for an en-US form (`11/3/2026`), right-padded by the calendar
button. The calendar button is a separate 18 px cell inside the control, not a floating icon
**[seen]**. Clicking it opens a month grid; choosing a day formats immediately **[doc]**. A
date-time picker adds a time field inside the same border.

### Dropdown list
Fixed set of choices, no typing. Closed state shows a chevron at the right edge, separated by a
1 px divider **[seen]**. The list opens to the width of the control, not the longest item, which
truncates long choices **[guess]**. Empty state is the authored placeholder.

### Combobox
Same box with a chevron, but accepts typing; typing filters or adds a value depending on the
form's "allow custom values" setting **[doc]**.

### Option buttons and checkboxes
Native 13 px Windows controls, laid out inline by the author. A group of option buttons is
usually horizontal (`Annual · Sick · Unpaid` in the sample), with 24 px between items **[seen]**.

### Repeating table
Column headers are bold, tinted, separated by vertical rules. Rows are separated by 1 px rules,
no zebra striping. **Rows are added by a blue underlined `Insert item` link below the table, not
by a `+` on the row** **[seen]**. Removing a row is a right-click action; there is no visible
delete affordance until you right-click **[doc]**. Tab past the last cell of the last row
inserts a row **[doc]**. Aggregates (`Total`) sit in a following row and recompute as you type.

### Attachment
Renders as a file icon plus two lines: the file name (underlined, truncated with no ellipsis
when the column is narrow) and `<type> <size>` (`Text Document 109 bytes`). Double-click opens
the file; right-click offers Save As / Remove **[seen]** for the rendering, **[doc]** for the
actions.

### Section and optional section
A section is a bordered box whose title is bold blue inside the top-left corner **[seen]** in
`02-expense-report-Claim-filled.png` (`Employee`, `Expenses`). An optional section renders its
insert affordance as an underlined link the same way a repeating table does; empty, it occupies
one line **[format]** — the sample forms declare four optional sections and the mechanism is
`xOptional` in the manifest.

### Expression box
No border, no caret, cannot be focused: it is text that happens to be computed **[seen]**.

### Button
A 1 px bordered rectangle with the caption centred, ~26 px tall, light gradient background
(Office 2013 style). No rounded corners at this DPI **[seen]** — `Insert item`, `Submit item`,
the view-switch buttons.

### ActiveX
A hosted control in a bordered box; in the corpus these are identified by GUID
(`{{61e40d31-…}}`, seven occurrences) and cannot be re-hosted **[format]**.

---

## 5. Validation, and what the user is told

InfoPath validates at three moments, in this order **[doc]**, and only the first is visible
while typing:

1. **On blur** of the control — border turns dashed red, the message is available as a tooltip.
2. **On save** — the record saves; errors are not blocking.
3. **On submit** — blocking. A modal says the form contains errors and offers to show them;
   the errors are also listed in the task pane.

The message text is whatever the form author wrote in the error condition (for our samples,
sentences like `Last day of leave must be on or after the first day`), so it can be empty or
useless — the app must not assume it is helpful.

Three different mechanisms produce the same red border: schema type mismatch (typing `abc` into
a number field), a required condition, and a custom validation expression. Users cannot tell
them apart, and the UI never says which **[doc]**.

When the author wrote no message, the user sees InfoPath's own English fallback:
`This field is required.` Twenty-five of the 51 validation conditions in the corpus rely on that
default **[format]**, so a form localized to Vietnamese still produced an English error. Our app
must keep authored messages verbatim and translate only the fallback.

Calculated fields evaluate before validation, so a calculated field can be the thing that makes
a *different* field invalid, with no visible link between them. That single behaviour is the
most common source of "the form will not submit and nothing is red" reports **[guess]**.

---

## 6. Rules, as the user experiences them

- Rules fire on field change and on load; calculations are re-evaluated first, then rules run
  in the order the author set, top to bottom **[doc]**.
- A rule can hide a section, switch the view, set a field, submit, close the form, show a
  message, or open a dialog — all with no visual trace **[format]**: the corpus alone has 37
  `ruleSetAction`, 20 `assignmentAction`, 16 `closeDocumentAction`, 12 `submitAction`, 7
  `switchViewAction`, 1 `queryAction`, 1 `dialogBoxExpressionAction`.
- The one rule kind the user does see is the message box and the dialog box, both modal and
  visually indistinguishable from an error.
- Because rules can both hide controls and change values, the same click can make two fields
  change, one disappear, and the view switch. Nothing records that this happened. This is the
  single largest UX defect in the product, and the reason the app's rule trace is the feature
  most worth building.

---

## 7. Views

There is no tab strip and no view menu in Filler. A view changes only when a rule or a button
says so; the user cannot browse views **[seen]** — the sample's three-view onboarding form
switches by button, and `05-new-hire-onboarding-*` shows three different pages with no shared
navigation.

Consequences worth copying, in reverse: our viewer should always show which view is active and
let the user switch, because the original could not.

---

## 8. Submit, save, close

- `Submit` is a large ribbon button on the left of Home, plus whatever the author put on the
  page. InfoPath distinguishes **Submit**, **Save**, **Save As** and **Close** as four different
  verbs and users routinely confuse them **[seen]** (both exist in the UI) / **[doc]**.
- Submit destinations are authored per form: a SharePoint library, a web service, a database, an
  email address, or the form's own hosting. When the destination is gone — which is the whole
  premise of this project — the button stays enabled and fails at the end with a technical
  message.
- After a successful submit, the default is to close the form or show "The form has been
  submitted"; on failure, the form stays open with an error dialog **[doc]**.
- Saving writes an `.xml` whose first processing instruction pins the template by name and
  `href`, so the record only opens on a machine that can resolve that template **[format]**.

---

## 9. Keyboard and focus

- Tab order follows document order; the controls are ordinary HTML-like inputs **[doc]**.
- `Ctrl+S` saves, `Ctrl+P` prints, `Ctrl+Z` undoes (session-scoped, shallow) **[doc]**.
- Arrow keys move between option buttons inside a group **[doc]**.
- No global shortcut for Submit; there is no `Ctrl+Enter` **[doc]**.
- The ribbon is fully keyboard reachable via keytips (`Alt`), which is the one part of the UI
  that works well without a mouse **[seen]** — `/design` + `Alt` + arrows is how the ribbon was
  enumerated for this document.

---

## 10. Dialogs and messages seen in this installation **[seen]**

Recorded because they are what users will recognize, and because our app will be asked to
explain them:

| Message | When |
|---|---|
| `The following URN identifying the form template is either missing or not valid: urn:…` | template and record disagree, or the URN contains a space |
| `InfoPath cannot open the following file: … The form template has been published to the server but it can only be opened from a server that is running InfoPath Forms Services` | server-published template, Forms Services retired |
| `This form template is not trusted. …` | template not signed and not in a trusted location |
| `Document Recovery` pane: `InfoPath has recovered the following files. Save the ones you wish to keep.` with `Version created last time t…` and `Which file do I want to save?` | after a crash; visible in `01-leave-request-Request-empty.png` |
| `This form cannot be submitted because it contains validation errors.` | submit blocked |
| `The form has been closed.` | after a close action |

The Document Recovery pane in that screenshot is an artefact of the VM being force-stopped
between capture runs, not a property of the form.

---

## 11. Printing

Print Preview shows the form as a page with the same table styling, paginated; tall repeating
tables split across pages with the header row repeated if the author enabled it **[doc]**. Our
viewer must offer the same pagination, because printed leave requests are still filed.

---

## 12. What the app must reproduce, in priority order

**P0 — without these the app is not a replacement**

1. The page renders as the form's own XSL says: borders, fonts, table geometry, control chrome.
2. Every control type in the corpus renders and behaves: text, date picker, dropdown, combobox,
   option buttons, checkbox, section, optional section, repeating table, repeating section,
   expression box, button, attachment, picture, choice group **[format: 1,266 controls, 17
   distinct types]**.
3. Required asterisk in the same place, dashed red border on the same trigger, message on
   hover in the same place.
4. Repeating rows added by an `Insert item` affordance under the table, aggregation rows
   recomputing live.
5. Submit is blocking and explains itself in the user's words, not a stack trace.
6. Records open by their pinned template, with the same field values, with no server.

**P1 — the reasons to switch**

7. Rule trace: which rule fired, in order, what it changed.
8. Validation list that names the mechanism (required / type / custom) and links to the field.
9. View switcher, always visible.
10. Search across records, which InfoPath never had.

**P2 — polish**

11. Keyboard parity (tab order, `Ctrl+S`, arrow keys in radio groups).
12. Print pagination identical to Print Preview.
13. Locale-aware date and number formats, from the form's own `formatString`.

## 13. Where we deliberately do better

Not feature creep — each one answers a defect recorded above.

| InfoPath defect | Our answer |
|---|---|
| Rules are invisible; the form changes and nothing says why | Rule trace panel, one line per action with the field it touched |
| A calculated value can invalidate a field it is not next to, silently | Validation list groups by mechanism and draws a link between cause and field |
| Required fields are marked with an 8 px asterisk and nothing else | Label gets `required` semantics, and a summary at the top of the form |
| No way to browse views | View switcher |
| Records are files on a share, unsearchable | Import and search across a folder of records |
| Errors never say which mechanism failed | Explicit mechanism in the message |
| Loading a form from a dead server fails forever | Viewer reads the template out of the `.xsn` with no server |
