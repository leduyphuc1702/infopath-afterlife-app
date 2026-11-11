# Spec 28: Find finds a number or a date as the record stores it

Found by the reviewer on `acd2394`, on the built app (sample 04, Records).

## R1. Find does not find a number or a date as the record stores it
- **Current behaviour:** WHEN a person types a stored value such as `1423.94`, `1423` or
  `2026-05-13` in Find, THE SYSTEM finds no record, because Find matches only what the list
  shows (`$1,423.94`, `5/13/2026`).
- **Expected behaviour:** for a number, currency, percentage or date column, a record SHALL
  match when the Find text is in what the list shows or in the value the record stores.
- **Unchanged behaviour:** text columns and check boxes match on what is shown only (`true`
  finds no ticked box); every record found today is still found; sorting; the count line; the
  summary; the archive of found records holds the records the list shows. P20 is restated with
  the new rule in `.kiro/steering/testing.md` and stays a property.

## R2. A stored number that ends in a zero is not found as written (round 2, `cffc527`)
- **Current behaviour:** WHEN a person types `2978.30`, THE SYSTEM finds no record, because Find
  read the sort key, made with `Number(text)`, so it searched `2978.3`.
- **Expected behaviour:** THE SYSTEM SHALL search the text the record holds in a number or date
  column, character for character.
- **Chosen:** `2978.3` still matches, as a part of `2978.30`, the way any part of a value
  matches. Nothing found at `cffc527` stops being found.
- **Unchanged behaviour:** the sort keys stay numbers and ISO dates, so sorting is as before.

## R3. Numbers and dates in repeating rows match as shown only (round 2, `cffc527`)
- **Current behaviour:** WHEN a person types `1334.60`, a line total stored in a repeating row
  and shown as `Line total: $1,334.60`, THE SYSTEM finds no record.
- **Expected behaviour:** a number or date in a repeating row SHALL be found by what is shown or
  by what is stored, and the "found in" line SHALL still give the entry as shown.
- **Unchanged behaviour:** text and check boxes in repeating rows match on what is shown.

## Not fixed in this round
Nothing left.
