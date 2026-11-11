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
| 1.1.1 Non-text content | nameless controls and images per screen | Fixed in spec 23 (B4: the date picker's icon button) |
| 1.3.1 Info and relationships | headings in order, landmarks, tables with captions or names and header cells, `aria-sort` | Fixed in spec 23 (B7: the Documentation's fields table); the rest passes |
| 1.3.2 Meaningful sequence | Tab order against reading order on landing and Records | Passes |
| 1.4.1 Use of colour | chosen and pressed states have a second mark (`aria-pressed`, a border, text) | Passes |
| 1.4.3 Contrast (minimum) | every text node's colour against its composited background, light and dark | Passes; disabled Undo and Redo are 1.95:1 and exempt |
| 1.4.10 Reflow | 320 px wide (as 1280 px at 400%) on every screen: page width, elements past the edge | Passes; the paper and the records table scroll in their own box. Keyboard scrolling fixed in spec 23 (B5) |
| 1.4.11 Non-text contrast | control borders, the focus ring (3.50:1 both schemes), the summary bars | Fixed in spec 23 (B3: bars were 1.1:1 in dark) |
| 1.4.12 Text spacing | the 1.4.12 values injected; clipped or overflowing text | Fails in one place: the position line is cut with an ellipsis (B8, not fixed: spec 19's narrow layout; the full name is in the paper's region name) |
| 1.4.13 Content on hover or focus | the Wave tip | Passes (opens on its button, closes with Escape) |
| 2.1.1 Keyboard | every control reached by Tab; menus, tabs (arrow keys), row menu, dialog | Fixed in spec 23 (B5: a read paper wider than the screen could not be scrolled) |
| 2.1.2 No keyboard trap | Tab through the modal dialog and the menus | Passes |
| 2.4.1 Bypass blocks | landmarks: header, main, footer, named sections | Passes |
| 2.4.2 Page titled | `document.title` per screen | Passes ("Records: Expense Report · InfoPath Afterlife") |
| 2.4.3 Focus order | after Back, Close tip, Keep filling, exports, dialogs | Passes (spec 22); Keep filling after typing fixed in spec 23 (B2) |
| 2.4.6 Headings and labels | one `h1` shown per screen, no skipped levels | Passes (Triage's second `h1` is in the print-only plan) |
| 2.4.7 Focus visible | outline present on every focus stop | Passes; forced colours keep a 2 px outline |
| 2.5.8 Target size (minimum) | controls under 24 × 24 px and the space around them | Passes, by spacing for the 20 px link buttons |
| 3.1.1 Language of page | `lang="en"` | Passes |
| 3.2.2 On input | Find, Count, Group by | Passes; results only, focus stays |
| 3.3.1 Error identification | a required field emptied in Fill | Passes: `aria-invalid` and "This field is required." |
| 3.3.4 Error prevention | leaving Fill with changes | Fixed in spec 23 (B2: typing not yet left was lost without the question) |
| 4.1.2 Name, role, value | `aria-pressed`, `aria-selected`, `aria-expanded`, `aria-sort`, `aria-invalid`; nothing nameless | Fixed in spec 23 (B4: the date box had no name) |
| 4.1.3 Status messages | live regions observed while acting | Passes: each message once, polite, focus unmoved |
| Reduced motion | style sheets under `prefers-reduced-motion: reduce` | Passes: nothing animates |
| Forced colours | computed colours under `forced-colors: active` | Fixed in spec 23 (B6: pressed toggles, the selected tab and the chosen line looked like the rest) |
| History (not WCAG) | Forward to a task | Fixed in spec 23 (B1) |
