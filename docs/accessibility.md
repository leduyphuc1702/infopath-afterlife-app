# Accessibility: what was checked, and the result

Checked on 2026-11-11 against WCAG 2.2 level AA, on the built web viewer (`ded0897` plus spec 23),
in Chromium through the Playwright MCP server: computed styles and the DOM with `browser_evaluate`,
the accessibility tree with `browser_snapshot`, keys with Playwright's keyboard. Screens: landing;
the form (read, X-ray, Fill with Rule Trace); Records with the summary; Documentation; Triage and a
death certificate; Licences and notices; the discard dialog, the header and export menus, and
the row menu.

This is a record of checks, not a claim of conformance.

**Not checked:**
- No real screen reader (NVDA, JAWS, VoiceOver) was run. Names, roles and states were read from
  the browser's accessibility tree, which is what a screen reader is given, not what it says.
- The paper keeps InfoPath's own layout and colours, so its contrast was not measured. What the
  app adds on it was checked: field names in Fill, error marks, the row menus.
- Only Chromium. Forced colours and reduced motion were emulated, not run in Windows' contrast
  themes.

| Criterion | How it was checked | Result |
|---|---|---|
| 1.1.1 Non-text content | nameless controls and images per screen | Spec 23 said fixed too early: the picture in Fill had no text alternative (X3). Fixed in spec 24 |
| 1.3.1 Info and relationships | headings in order, landmarks, tables with captions or names and header cells, `aria-sort` | Fixed in spec 23 (B7: the Documentation's fields table); the rest passes |
| 1.3.2 Meaningful sequence | Tab order against reading order on landing and Records | Passes |
| 1.4.1 Use of colour | chosen and pressed states have a second mark (`aria-pressed`, a border, text) | Passes |
| 1.4.3 Contrast (minimum) | every text node's colour against its composited background, light and dark | Passes; disabled Undo and Redo are 1.95:1 and exempt |
| 1.4.10 Reflow | 320 px wide (as 1280 px at 400%) on every screen: page width, elements past the edge | Passes; the paper and the records table scroll in their own box. Keyboard scrolling fixed in spec 23 (B5) |
| 1.4.11 Non-text contrast | control borders, the focus ring (3.50:1 both schemes), the summary bars | Fixed in spec 23 (B3: bars were 1.1:1 in dark) |
| 1.4.12 Text spacing | the 1.4.12 values injected; clipped or overflowing text | Passes: the position line wraps inside its 22em instead of being cut (B8, fixed in spec 23 round 2), at 1280 and 320 px, with no horizontal scroll |
| 1.4.13 Content on hover or focus | the Wave tip | Passes (opens on its button, closes with Escape) |
| 2.1.1 Keyboard | every control reached by Tab; menus, tabs (arrow keys), row menu, dialog | Fixed in spec 23 (B5: a read paper wider than the screen could not be scrolled) |
| 2.1.2 No keyboard trap | Tab through the modal dialog and the menus | Passes |
| 2.4.1 Bypass blocks | landmarks: header, main, footer, named sections | Passes |
| 2.4.2 Page titled | `document.title` per screen | Passes ("Records: Expense Report · InfoPath Afterlife") |
| 2.4.3 Focus order | after Back, Close tip, Keep filling, exports, dialogs | Passes (spec 22); Keep filling after typing fixed in spec 23 (B2) |
| 2.4.6 Headings and labels | one `h1` shown per screen, no skipped levels | Passes (Triage's second `h1` is in the print-only plan) |
| 2.5.3 Label in name | the visible words inside each control's name | Fixed in spec 24 (X2: "Insert item" was named "Insert a row at the end of Lines") |
| 2.4.7 Focus visible | outline present on every focus stop | Passes; forced colours keep a 2 px outline |
| 2.5.8 Target size (minimum) | controls under 24 × 24 px and the space around them | Passes, by spacing for the 20 px link buttons |
| 3.1.1 Language of page | `lang="en"` | Passes |
| 3.2.2 On input | Find, Count, Group by | Passes; results only, focus stays |
| 3.3.1 Error identification | a required field emptied in Fill | Passes: `aria-invalid` and "This field is required." |
| 3.3.4 Error prevention | leaving Fill with changes | Fixed in spec 23 (B2: typing not yet left was lost without the question) |
| 4.1.2 Name, role, value | `aria-pressed`, `aria-selected`, `aria-expanded`, `aria-sort`, `aria-invalid`; nothing nameless | Spec 23 said fixed too early: in Fill, read-only boxes had `aria-readonly` and `aria-label` on a `span` with no role (X1), and the Weight keeper's box had no name (X4). Fixed in spec 24 |
| 4.1.3 Status messages | live regions observed while acting | Passes: each message once, polite, focus unmoved |
| Reduced motion | style sheets under `prefers-reduced-motion: reduce` | Passes: nothing animates |
| Forced colours | computed colours under `forced-colors: active` | Fixed in spec 23 (B6: pressed toggles, the selected tab and the chosen line looked like the rest) |
| History (not WCAG) | Forward to a task | Fixed in spec 23 (B1) |

## Automated audit by the reviewer (axe-core 4.14)

The reviewer ran axe-core 4.14 against the built app on `c55f031`, outside this repository, with
the WCAG 2.0, 2.1 and 2.2 level A and AA rules: ten screens, each in the light and the dark
scheme and at 320 px wide, then Fill on each of the nine bundled samples.

- **Before (spec 23):** no violation on 27 of the 30 screen runs. The three were Fill:
  `aria-allowed-attr` (critical: `aria-readonly` on a role-less `span`, X1) and
  `label-content-name-mismatch` ("Insert item", X2). Fill on the nine samples added the picture's
  missing text alternative and its role-less `aria-label` (X3) and `aria-input-field-name` on the
  Weight keeper (X4).
- **After (spec 24):** X1 to X4 are fixed. `e2e/bugfixes24.spec.ts` checks the same conditions on
  samples 02, 04, 06 and the Weight keeper in Fill: `aria-readonly` only on roles that have it,
  no `aria-label` without a role, each "Insert …" name holding its words on screen, every image
  with an `alt`, every control named. axe-core itself was not run again in this repository (it is
  not a dependency).

## After the reviewer's interface commit

The reviewer's commit after `0c1c792` changes the first screen and puts icons on the buttons
(README, "What Kiro did not write"). The reviewer checked it by hand and with axe-core 4.14.0,
outside this repository, on the built app. Kiro did not check it.

- **axe-core:** 66 runs with the WCAG 2.0, 2.1 and 2.2 level A and AA rules, and no violation:
  the first screen (plain, and with each of its three explanations open), Read, Rules, Fill,
  Find, Keep, Documentation and Triage, each in the light and the dark scheme at 1280, 390 and
  320 px wide. The first run found one: at 320 px the wider buttons squeezed the
  Documentation's "Back" to 8 px (`target-size`). The tools now wrap, and
  `e2e/simple.spec.ts` checks it.
- **1.4.13 Content on hover or focus:** an explanation opens on hover or focus of its help
  icon, stays open while the pointer is on it, closes with Escape without moving focus, and is
  the icon's description (`aria-describedby`). `e2e/simple.spec.ts` checks each of these.
- **2.5.8 Target size:** the help icon is 24 by 24 px.
- **4.1.2 Name, role, value:** a button that shows only an icon keeps its words inside it,
  hidden from sight, so its name is unchanged; the same words are its hover text.
- **1.4.10 Reflow:** no sideways scroll on any of the 66 runs; an open explanation stays inside
  the screen at 390 and 320 px.
- **Forced colours:** the icons are drawn in the button's text colour. Emulated, looked at on
  the first screen only.
- **Not checked:** a screen reader; the icons under Windows' contrast themes; Fill on each of the
  nine samples was not run through axe-core again.
- **Missed by all of the above:** the help tip's class name was the one Kiro's Triage table
  already used for the Wave column's explanation, and that header was drawn as a dark box, 30 px
  wide. Its contrast was fine, so axe-core passed it. The reviewer's next commit renames the
  class; `e2e/simple.spec.ts` checks the header, and Triage was run through axe-core again in
  both schemes at the three widths.

## After the reviewer's product-page commit

The reviewer's sixth commit after Kiro's last one turns the first screen into a product page and
restyles panels, tables and text boxes on the working screens (README, "What Kiro did not
write"). The reviewer checked it on the built app with axe-core 4.14.0, outside this repository.
Kiro did not check it.

- **axe-core:** 72 runs with the WCAG 2.0, 2.1 and 2.2 level A and AA rules, and no violation:
  the first screen (plain, with each of its three explanations open, and with all seven
  questions open), Read, Rules, Fill, Find, Keep, Documentation and Triage, each in the light and
  the dark scheme at 1280, 390 and 320 px wide.
- **1.4.10 Reflow:** no sideways scroll on any of the 72 runs. `e2e/landing.spec.ts` checks the
  whole first screen at 320, 390, 820, 1280 and 1920 px in both schemes.
- **2.4.1 Bypass blocks, 2.4.3 Focus order:** the header's section links are buttons that
  scroll; they add four tab stops on the first screen and none elsewhere. The header stays in
  view there and `scroll-padding-top` keeps it from covering the heading it led to;
  `e2e/landing.spec.ts` checks this for each link.
- **2.4.3 Focus order:** after Back from a task, focus goes to the tasks' heading and the page
  scrolls to it, under the header (the reviewer's seventh commit; the sixth left the page at its
  top). `e2e/landing.spec.ts` checks it.
- **1.1.1 Non-text content:** the picture of the app has a description. The mark, the window
  dots above the picture and Triage's wave bar are decoration and hidden from assistive
  technology; the sentence under the bar carries its numbers.
- **4.1.2 Name, role, value:** a question is a `details` element, opened with Enter or Space. A
  task card's name is now its words and its line together.
- **2.3.3 Animation:** a card lifts 2 px on hover, and a section link scrolls smoothly, only when
  reduced motion is not asked for.
- **Forced colours:** emulated, looked at on the first screen and on Triage only.
- **Not checked:** a screen reader; Windows' contrast themes; Fill on each of the nine samples
  was not run through axe-core again.
