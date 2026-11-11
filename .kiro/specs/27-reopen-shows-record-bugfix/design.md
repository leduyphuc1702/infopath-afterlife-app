# Spec 27 design

Root cause at `68e8173`: `openState` sets `recordIndex: 0`, and `showArrived`
(`apps/web/src/store.ts`) moves to the first record only when records are new to the session.
A history entry (`Place`) held no record, so `restore` (which also calls `openState`) could not
give one back.

Fix:
- `store.ts`, `session`: a form opened anew (not the one already open) with no new records shows
  record 1 when it has records.
- `Place.recordIndex`, set by `placeOf` on the form screen only; `keyOf` ignores it.
- `shell/history.ts` `visit`: the same place replaces its entry when the record changed, and
  still adds none. `App.tsx` calls it on `place.recordIndex` too.
- `restore`: the entry's record when it is still there, else the first, else the empty form.

Tests: `apps/web/test/history.test.ts` (3 added: way 1, way 2 with a record gone, no new entry
per record), `apps/web/e2e/bugfixes27.spec.ts` (way 1, way 2, F10).

## Existing tests changed
None edited. `history.test.ts` gained the three tests above and `describe` in its import.
