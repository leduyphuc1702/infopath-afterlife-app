# Spec 27: a form opened again shows its record

Found by the reviewer on `68e8173`, on the built app.

## R1. A form opened a second time, or reached again with Forward, shows the empty form
- **Current behaviour:** WHEN a person opens a form from the start page a second time (a
  bundled sample, or their own files dropped again), THE SYSTEM shows "Empty form". WHEN a
  person leaves a form on record 3 for the start page and comes back with Forward, THE SYSTEM
  shows "Empty form".
- **Expected behaviour:** a form opened from the start page SHALL show its first record when it
  has any, the empty form when it has none, whether it was open before or not. Back or Forward
  to a form SHALL show the record that was showing when the entry was left; the first one when
  that record is gone.
- **Unchanged behaviour:** spec 13 B4 while a form stays open; the seven tasks; the discard
  question; spec 26 M1 and M2; Previous from record 1 reaches the empty form; one history entry
  per screen (moving between records adds none).

Spec 22 F10 (Back from Records returned to the record last opened from the list) is settled by
the same change: the form's entry keeps its own record.

## Not fixed in this round
Nothing left.
