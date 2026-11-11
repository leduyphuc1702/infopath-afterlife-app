# Spec 26: what the last rounds left

Found by the reviewer on `6977aaf` (M1, M2) and in earlier specs (N1: spec 19 "P5, rest"; F12:
spec 22; F7: spec 19; F10: spec 22).

## M1. Forward to Triage or a death certificate, after Back to the start page, stays on the start page
- **Current behaviour:** WHEN a person goes Back from Triage or a certificate to the start page
  and then Forward, THE SYSTEM keeps showing the start page: `home` drops `openId`, the start
  page is drawn while no form is open, and `restore` opened the entry's form only for the form,
  Documentation and Records screens.
- **Expected behaviour:** Forward SHALL show the screen the entry names, for every screen.
- **Unchanged behaviour:** Back and Forward between screens with a form open (P17); tasks.

## M2. Opening a bundled sample a second time says "21 files are already open"
- **Current behaviour:** WHEN a bundled sample or "Triage all samples" is opened again, THE
  SYSTEM shows the notice written for files dropped twice.
- **Expected behaviour:** a bundled sample already loaded SHALL just open, with no notice.
- **Unchanged behaviour:** a person's own files dropped twice keep the notice (spec 13 B3).
  Unsaved typing: the start page, where samples are chosen, is reached from a form only through
  the question spec 25 L2 kept ("Keep filling" stays, "Discard changes" leaves), so reopening a
  sample from there loses nothing that was not discarded on purpose; the sample opens as a new
  form, read mode, first record.

## N1. A calculated value is stored with floating-point noise
- **Current behaviour:** WHEN a calculation or a "Set a field's value" action gives a number
  such as `1472.1299999999999`, THE SYSTEM writes those digits into the record.
- **Expected behaviour:** THE SYSTEM SHALL write at most 15 significant digits (`1472.13`).
  15 is DBL_DIG, the digits a double always holds exactly: read, not seen in InfoPath.
- **Unchanged behaviour:** `string()` inside expressions, so rules compare as before.

## F12. The summary's caption keeps "Choose a group to list its records." after a group is chosen
- **Expected behaviour:** the sentence SHALL go once a group is chosen.

## Not fixed in this round
- **F7** (both archives named `<form>-archive.zip`): the worker names the web-page archive
  `-archive.zip` and the records export `-records.zip`; which second download carries the same
  name was not found within this round's budget.
- **F10** (Back from Records returns to the record last opened from the list): not started;
  budget.
- **A cent in 2 records of form 04** (`-004`: VAT 629.12, recalculated 629.13; `-010`: 151.09,
  151.1, and the totals after them): a rounding of halves, not float noise; which way InfoPath
  rounds there is not seen.
