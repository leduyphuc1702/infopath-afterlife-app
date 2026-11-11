# Spec 23 design

Root causes at `ded0897`. Tests: `apps/web/e2e/bugfixes23.spec.ts` (15).

## B1
- **Cause:** `App.tsx` `visit` effect: only the screen named by `landed` replaced the entry, and
  `landed` was set when the task's screen was reached. On Forward the sample is already open, so
  its form screen is drawn first and pushed as a new entry, without the hash (spec 22 F5). The
  pending effect set record 1 only for `read` and `fill`; `home` had left `recordIndex: 0`.
- **Fix:** `runTask` sets `taskRun` and `landed` (`records`, `documentation`, `triage`) before
  opening the sample; while `taskRun` is set every visit replaces the current entry and keeps its
  URL; it ends on the task's screen. `rules` and `keep` also set record 1.
- **Test:** e2e B1, one per task: Forward state, `history.length` unchanged, the hash, one Back home.

## B2
- **Cause:** `leaveFill` read `fill.res.dirty` only. Typing lives in the field's text until
  `focusout` commits it (`paper/fill.ts` `listen`); a click commits on its pointerdown, but the
  Worker's answer arrives after the click handler has read `dirty`.
- **Fix:** `uncommitted()` in `fill.ts` finds the focused field whose text differs from its value;
  `leaveFill` blurs it (the commit), counts edits in flight (`sent`), awaits the latest
  (`inFlight`) and reads `dirty` from its answer. "Keep filling" refocuses the field.
- **Test:** e2e B2: Back with focus still in Qty asks and Undo is on; Next clicked straight after
  typing asks.

## B3
- **Cause:** `records.css` `.afl-summary-bar` used `--ds-background-information` (subtle) behind
  the number.
- **Fix:** a 4 px strip under the number in `--ds-background-information-bold`; CanvasText in
  forced colours.
- **Test:** e2e B3, light and dark: composited contrast of the bar against its line, chosen and not.

## B4
- **Cause:** `fill.ts` `upgrade` named controls from `title` only; `button.xdDTButton` from the
  view stayed a plain button.
- **Fix:** fall back to the binding's local name in words; the calendar button gets `tabIndex -1`
  and `aria-hidden`.
- **Test:** e2e B4.

## B5
- **Cause:** `Paper.tsx` frame had no tab stop; `Records.tsx` box was `tabIndex -1`, unnamed.
- **Fix:** frame `tabIndex 0` while reading; box `role="region"`, `aria-label`, `tabIndex 0`.
- **Test:** e2e B5 at 320 px: focus, ArrowRight, `scrollLeft > 0`.

## B6
- **Cause:** the states were drawn with backgrounds and a transparent border, which forced colours
  replace.
- **Fix:** `@media (forced-colors: active)` in `app.css` and `records.css`.
- **Test:** e2e B6: text colour of pressed and unpressed toggles, the tabs' underline, the chosen
  line's left border.

## B7
- **Fix:** `aria-labelledby="afl-doc-fields"` on the table. **Test:** e2e B7.

## Existing tests changed
None.
