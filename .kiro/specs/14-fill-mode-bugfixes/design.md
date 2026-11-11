# Spec 14 design

Root causes are at commit `70f873f`. Regression tests: `apps/web/e2e/fill-bugfixes.spec.ts`
(B1–B7, B9–B12, one test each), `packages/core/test/runtime/open-calculations.test.ts` (B4) and
`apps/web/test/trace-words.test.ts` › "B8" (B8).

| Bug | Root cause | Fix | Test |
|---|---|---|---|
| B1 | `apps/web/src/paper/rows.ts:185` makes the row's last cell `position: relative`, so the menu (`:134`, `button.after(menu)`) has the cell as its containing block, and the cell's `overflow: hidden` clips it. | `.afl-root` is the containing block (`position: relative`); the cell is no longer positioned, so its overflow does not clip absolute children. `placeMenu` puts the menu under its button by offsets. | e2e B1: `elementFromPoint` at each item's centre is the item. |
| B2 | `rows.ts:40` appends the button to the last cell and the CSS pins it to the cell's top right (`right: 1px`), over the cell's content. | `placeRowButtons` sets each button's `left`/`top` from its row's box: 2 px right of the row. It runs after each render and on every remeasure (resize, fonts). The button stays in the row's DOM, so Tab order is unchanged. | e2e B2: no visible (cell-clipped) part of any element in the row meets the button. |
| B3 | `apps/web/src/App.tsx:629` puts Undo, Redo and Download XML in the views and records toolbar, which then needs about 1,020 px. | A second toolbar, "Fill" (`.afl-fill-tools`), at the end of the status line (`.afl-statusbar`, flex, wraps as a whole). `.afl-position` ellipsises past 22em. | e2e B3: rows counted by line boxes, at 1280 and 390 px. |
| B4 | `packages/core/src/runtime/session.ts:383` writes every calculation's value at open (D13), whatever the stored text. | While `start()` runs, `opening` is true and a value with `sameAtStoredPrecision(stored, value)` is not written. After open, `sameNumber` (relative 1e-12) skips float-noise writes, so a stored "350.30" also survives a structural recalculation. | core `open-calculations.test.ts` (4); e2e B4 (empty state on form 04 record 1). |
| B5 | `App.tsx:314` hands the answer to `fillAnswer` with no message; skipped entries only reach the Rule Trace. | `pressMessage(c, r)`: for a press with skipped entries and no dialog, "“Check budget” ran only in part: …". Kept in `pressNote` state until the next command. | e2e B5. |
| B6 | `apps/web/src/paper/Paper.tsx:102` does not restore focus when it is outside the paper (the toolbar), and `worker/session.ts:429` stores the redo step with the toolbar's focus (none). | Paper always restores the step's focus. The worker gives both directions of a step the focus of the field it changed (`here.focus = to.focus`). | e2e B6: Undo, then Redo, focus on Qty. |
| B7 | `apps/web/src/shell/app.css:627`: `.afl-trace-entry` has no `overflow-wrap`, and the side panel's grid column grows to the longest word. | `overflow-wrap: anywhere` on entries; `.afl-side { min-width: 0 }`. | e2e B7: no entry is wider than the panel or than itself. |
| B8 | `apps/web/src/side/trace-words.ts:67` appends the core note, which holds XPath, to the sentence. | Skipped sentences for a `GetDOM` source, for "selects no field" and for actions after a skipped query; `traceExpression` gives the target XPath on demand. | unit B8. |
| B9 | `worker/session.ts:433` and `:461` set `dirty = true` on any command, undo included; only Download clears it. | `saved` is the record as opened or as last downloaded; `dirty` is `session.xml() !== saved`, computed with each answer. | e2e B9. |
| B10 | `App.tsx:306` (`leaveFill`) always asks with `DISCARD`, whose body says "this form", also when the session is on another template or record than the one shown. | When Fill is not on for the shown place, the body names the session's form and record. | e2e B10. |
| B11 | `fill.ts:126` `restoreFocus` finds no button with the old `CtrlId` in the new view and does nothing. | After restore, when focus was in the paper and nothing there has it, the first editable control (or button, or insert placeholder) takes it. | e2e B11. |
| B12 | `App.tsx:494` returns when there was no place before (`before === undefined`), which is exactly the landing page. | Only `placeKey === undefined` or an unchanged place returns. | e2e B12. |

## Decisions

- **B4 rule.** The reviewer's rule (equal at the stored precision) applies at open only, where
  InfoPath would not have recalculated (`refresh="onChange"`). After open, only float noise
  counts as equal: with the precision rule a stored "100" would survive an edit that makes it
  100.4.
- **B3.** Undo and Redo keep their words; the Fill toolbar sits where the Fill sentence is, so the
  actions and the sentence that explains them are together.

## Existing tests that asserted a defect

- `packages/core/test/runtime/calc-oracle.test.ts`: record 018's VAT and Total mismatches came
  from the runtime writing the float-noise subtotal 371.04999… over the stored 371.05. They are
  gone, so the expected list loses those two lines and the match count goes from 133 to 135.
- `apps/web/e2e/rules.spec.ts` › "form 02: undo and redo…": it asserted that focus stays on the
  Undo button after a toolbar undo, which is K6 itself. It now asserts focus on Amount.
- `packages/core/test/runtime/structure.test.ts` › "form 02: Insert item…": it compared the whole
  XML after an edit and a remove with the XML at open. That held only because open had already
  rewritten Total as "350.3". The test now compares everything except Total's text; Total is
  still checked as a number.
