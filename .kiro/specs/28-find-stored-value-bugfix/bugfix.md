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

## Not fixed in this round
Nothing left.
