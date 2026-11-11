# Spec 13: design

Line numbers are at `057927c`, the code before the fixes. All paths are under `apps/web/`.
No new dependency; no change to `packages/core` (B3 hashes with Web Crypto in the Worker).

## B1. Print

- **Root cause.** `src/triage/triage.css:200`, `.afl-main > :not(.afl-print) { display: none }`
  in `@media print`, applies on every screen; only Triage renders `.afl-print`.
- **Fix.** `<main data-screen>` names the screen; the Triage rule is scoped to
  `[data-screen='triage']`. `src/shell/app.css` adds print rules: the form screen hides toolbar,
  side panel and notes, shows `.afl-print-caption` (the paper's own label), and lets the frame
  overflow. `Paper.tsx` on `beforeprint` measures the paper's drawn width (min-width off) and sets
  `--afl-print-zoom = min(1, 180 mm / width)`, the narrower of A4 and Letter inside the 15 mm
  `@page` margins. The certificate hides `.afl-no-print` (Back, Open form).
- **Test.** e2e `e2e/bugfixes.spec.ts` "B1 …" (form 08, certificate of form 01): text visible in
  print media, caption, hidden chrome, width ≤ 180 mm. Triage print stays in `e2e/export.spec.ts`.

## B2. History

- **Root cause.** No code touches `history`: `src/App.tsx:274` and `:279–282` change screen
  through `dispatch` only, so the page has one entry.
- **Fix.** `src/shell/history.ts`: `placeOf(state)` (screen, open form, certificate), `keyOf`
  (Triage is one place whatever form is behind it), `visit(history, place)` pushes when the place
  changes, replaces the page's own entry the first time, and does nothing when Back/Forward just
  restored that place. `App.tsx` calls `visit` when the key changes and turns `popstate` into a
  new `restore` action (`src/store.ts`). `history.scrollRestoration = 'manual'` (B6 restores).
- **Tests.** P17 in `test/history.test.ts` (fast-check over the reducer and a fake `History`);
  e2e "B2 …" with `page.goBack()` / `goForward()` over Triage → certificate → form.

## B3. Same bytes twice

- **Root cause.** `src/worker/session.ts:72–84`, `open()` adds every `.xsn`/`.xml` it is given;
  nothing compares a file with those already open.
- **Fix.** The session keeps a map from SHA-256 (`crypto.subtle`, Node 22 and Workers) to the
  template id it became (or nothing, for records and failures). A known hash is skipped and
  reported in the new `SessionRes.duplicates`. `App.tsx` shows that template when nothing new
  was added, and the status line says "<file> is already open, so it was not added again."
  (`src/shell/announce.ts`).
- **Tests.** Node `test/session.test.ts`: two examples and P16.

## B4. First arrived record

- **Root cause.** `src/store.ts:101`, `openState()` sets `recordIndex: 0`, and the `session` case
  (`:118–131`) never looks at which records are new.
- **Fix.** `showArrived(before, after)` in the `session` case: the first record of the open
  template that it did not have before becomes `recordIndex`; none new keeps the index.
- **Tests.** Node `test/store.test.ts` (three cases); e2e "B4 …" (template with 3 records, then
  record 005 alone).

## B5. Escape on menus

- **Root cause.** `src/shell/Header.tsx:43` and `src/triage/ExportMenu.tsx:27` are bare
  `<details>`, which have no Escape handling (nor outside-click closing).
- **Fix.** `src/shell/menu.ts`, `useMenu()`: Escape closes and focuses the `<summary>`; a
  `pointerdown` outside closes. Both menus use it.
- **Test.** e2e "B5 …".

## B6. Focus and scroll

- **Root cause.** `src/App.tsx` swaps screens (`:268–282`) without moving focus or keeping
  scroll; the clicked button is unmounted, so focus falls to `<body>`.
- **Fix.** A layout effect on the place key: certificate → `#afl-cert-h`, form → the toolbar's
  form name (now an `<h2 tabIndex={-1}>`), both after scrolling to the top; Triage → the saved
  `scrollY` (saved when a certificate is opened, or on `popstate`) and the row button
  `[data-afl-cert=<id>]` of the last certificate, else the Triage heading.
- **Test.** e2e "B6 …" (all 48 samples, row 40).

## B7. Title

- **Root cause.** Only `index.html:6` sets a title.
- **Fix.** `screenTitle()` in `src/shell/announce.ts`, set by an effect in `App.tsx`.
- **Test.** e2e "B7 …".

## B8. Scroll box

- **Root cause.** `src/triage/TriageTable.tsx:34`, `<div className="afl-triage-scroll">` has no
  `tabIndex`, role or name.
- **Fix.** `tabIndex={0} role="region" aria-label="Table of forms"`; the global `:focus-visible`
  ring, drawn inside the box (`outline-offset: -2px`). The name avoids "Triage", which the tests'
  `getByRole('region', { name: 'Triage' })` would also match.
- **Test.** e2e "B8 …" (390×844: attributes, ring, ArrowRight scrolls).

## B9. Wrapping labels

- **Root cause.** `src/shell/app.css:27` `.afl-header` and `:42` `.afl-header-actions` are
  `flex` without `flex-wrap`, so at 390 px the buttons shrink and `.afl-button` (`:48`) wraps
  its text.
- **Fix.** `white-space: nowrap` on `.afl-button`; `flex-wrap: wrap` on both header rows.
- **Test.** e2e "B9 …": each header button's text sits on one line; `scrollWidth ≤ 390`.

## B10. Announcement

- **Root cause.** `src/side/Unmatched.tsx:31` renders the lists in plain sections; the only live
  region (`src/App.tsx:256`) carries the busy line.
- **Fix.** A visually hidden `aria-live="polite"` region (`[data-afl-announce]`); `openFiles`
  says that drop's "Files not opened: …." and "Records not matched: …." It is emptied first, so
  the same words on the next drop are said again.
- **Test.** e2e "B10 …".

## Tests that asserted a defect

B4 changes where a form opens, so e2e tests that clicked Next to reach record 1, or expected the
empty form first, are updated (`open`, `paper`, `xray`, `offline`, `keyboard`, `hostile`,
`worker-csp`). B3 makes `triage.spec.ts` "40 templates" (five copies of forms 01–08 under other
names) eight forms, so it takes forms 01–40 instead.

## B11. Menu inside the viewport

- **Root cause.** `src/shell/app.css:95`, `.afl-menu ul` is `right: 0; min-width: 240px`. When
  B9 wrapped the header, "Try a sample" sits 229 px from the left, so its list starts at −11 px.
- **Fix.** `useMenu()` (`src/shell/menu.ts`) on `toggle` measures the list and shifts it with
  `translateX` to 8 px from whichever edge it crosses; the list is capped at `100vw − 16px`.
- **Test.** e2e `bugfixes.spec.ts` "B11 …" at 390 and 1280 px, both menus.
