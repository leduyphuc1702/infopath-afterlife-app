# Spec 24 design

Root causes at `c55f031`. Tests: `apps/web/e2e/bugfixes24.spec.ts` (10),
`apps/web/test/fill-upgrade.browser.test.ts` (W4), `packages/core/test/xsn/match.test.ts` (W3, 2),
`packages/core/test/property/p23.property.test.ts` (P23).

| Bug | Root cause | Fix |
|---|---|---|
| W1 | `paper/fill.ts` `restoreFocus`: `range.setStart(el.firstChild, caret)`; in a rich text box the first child is an element, so the offset is past its children. React had no error boundary, so the layout effect's throw unmounted the app | `caretPoint` walks the text nodes to the caret. `paper/DrawError.tsx`, an error boundary around `<Paper>` only: the toolbar stays; it retries on the next answer |
| W2 | spec 23 B4 hid `button.xdDTButton`, which never had a handler | `upgrade` names the button after its box and keeps it in the tab order; `listen` opens an `<input type="date">` beside it with `showPicker()`; its `change` sends the same `edit` a typed ISO date does |
| W3 | `xsn/match.ts` returned `noSolution` for any record without `name`; worker and Triage keys had no `publishUrl`; a new record's `href` is `manifest.xsf` | `TemplateKey.publishUrl`; a record without `name` matches a template without URN whose `publishUrl` is its `href` as a place. `downloadedXml()` puts the `publishUrl` in for `manifest.xsf` (worker `fillDownload`). InfoPath had only `href` to go on, too |
| W4 | `upgrade` made any text control with a mark path editable; the runtime resolves main-source paths only, so the edit was refused silently | a `GetDOM("…")` binding makes the control read-only with its reason |
| X1, X3 | `upgrade` put `aria-readonly` and `aria-label` on whatever element the view drew | role `textbox` for read-only boxes; `group` for other spans; `aria-readonly` only on roles that have it; `img` gets `alt` |
| X2 | `paper/rows.ts`: a fixed name | the words on screen first |
| X4 | `title ?? binding`: `""` is not nullish | `title || binding` |
| X5 | `App.tsx` `leaveFill` refocused the element it blurred; the commit replaced it | find it again by `data-afl-ctrl` and `data-afl-path` |
| D1 | text editing is plain text by design | description and a status line, through an `afl-note` event from the paper |

P23 drives `FillSession` with a `History<Snapshot>` the way the Worker does.

## Existing tests changed
- `e2e/fill.spec.ts` and `e2e/rules.spec.ts`: "Insert a row at the end of Expenses" becomes
  "Insert item: a row at the end of Expenses", and "Insert Relocation" becomes "Click here to
  add: Relocation" (X2: they asserted the mismatched name).
- `e2e/bugfixes23.spec.ts` B4: the calendar button may be in the tab order when it has a name
  (W2 reverses spec 23's "out of the way").
