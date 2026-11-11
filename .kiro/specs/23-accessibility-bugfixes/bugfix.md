# Spec 23: accessibility bugfixes

Found on `ded0897`: B1–B3 by the reviewer (left from spec 22 as H1–H3), B4–B7 by checking every
screen against WCAG 2.2 AA through the Playwright MCP server (turn 74, `docs/accessibility.md`).

## B1. Forward to a task is half fixed (H1)
- **Current behaviour:** WHEN a person opens `#rules` or `#keep`, goes Back, then Forward, THE
  SYSTEM shows the empty form instead of record 1. WHEN the task is `#find` or `#document`, THE
  SYSTEM adds a history entry on Forward and drops the hash, so the next Back shows the same
  screen again.
- **Expected behaviour:** WHEN a person goes Forward to any of the seven tasks, THE SYSTEM SHALL
  show what Back left, add no entry and keep the address; one Back SHALL return to the landing
  page.
- **Unchanged behaviour:** a task started from its link or typed address; F5 (a later screen's
  entry has no hash); `#read`, `#fill`, `#triage` on Forward.

## B2. A value typed in Fill and not yet left is lost without the question (H2)
- **Current behaviour:** WHEN a person types in a field and, without leaving it, goes Back or
  clicks Next, Previous, Records, the Fill switch or Download XML, THE SYSTEM leaves without asking
  and the value is lost.
- **Expected behaviour:** THE SYSTEM SHALL commit the typing as leaving the field does, wait for the
  Worker's answer, and ask "Discard your changes?" when it made a change. "Keep filling" SHALL put
  focus back in the field.
- **Unchanged behaviour:** no question without changes; Tab first then Back asks, as before.

## B3. The summary's bars are close to invisible in the dark scheme (H3)
- **Current behaviour:** WHILE the scheme is dark, THE SYSTEM draws the bars rgb(28, 43, 66) on
  about rgb(27, 28, 31) (1.1:1).
- **Expected behaviour:** THE SYSTEM SHALL draw each bar at 3:1 or more against its line, chosen or
  not, in both schemes, and in forced colours.
- **Unchanged behaviour:** the numbers stay text on the line's background; the CSV.

## B4. Fill: a field with no name, and a dead button in the tab order
- **Current behaviour:** WHEN Fill is on for 04, THE SYSTEM gives the "Needed by" date box no name
  (InfoPath gave it no title), and its calendar button is focusable, nameless and does nothing.
- **Expected behaviour:** a control with no title SHALL be named from its binding ("Needed by");
  the calendar button SHALL be out of the tab order and hidden from assistive technology.
- **Unchanged behaviour:** InfoPath's titles win; the paper looks as it did.

## B5. On a small screen the paper and the records list cannot be scrolled from the keyboard
- **Current behaviour:** WHEN the screen is 320 px wide and the paper is read (nothing on it takes
  focus), THE SYSTEM gives the keyboard no way to scroll the paper sideways; the records box has no
  name and no tab stop.
- **Expected behaviour:** the paper frame SHALL take focus while reading; the records box SHALL be
  a region named "Records found" that takes focus; arrow keys scroll both.
- **Unchanged behaviour:** in Fill the frame takes no focus (its fields do).

## B6. Forced colours hide what is pressed, selected and chosen
- **Current behaviour:** WHILE `forced-colors: active`, THE SYSTEM draws a pressed toggle (X-ray,
  Fill) like an unpressed one, every tab with the same underline, and the chosen summary line like
  the others.
- **Expected behaviour:** a pressed toggle SHALL be drawn in Highlight; only the selected tab SHALL
  be underlined; the chosen line SHALL have a Highlight mark on its left.
- **Unchanged behaviour:** normal colours in light and dark.

## B7. The Documentation's fields table has no name
- **Expected behaviour:** the table SHALL be named by its heading, "Fields".

## Not fixed in this round
- **B8.** With text spacing raised (1.4.12), the position line ("Record 1 of 30, 02-expense-…")
  is cut with an ellipsis. The cut is spec 19 R6's design for narrow screens; the full file name is
  in the paper region's name. Fixing it means a second line in the toolbar; left for a layout spec.
- Undo and Redo, when disabled, are 1.95:1. Disabled controls are exempt from 1.4.3.
- "Close tip", "Back" and the table's link buttons are 20 px high; each has 24 px clear around it,
  so 2.5.8 passes by its spacing exception. Nothing to fix.
