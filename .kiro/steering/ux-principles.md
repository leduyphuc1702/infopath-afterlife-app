---
inclusion: fileMatch
fileMatchPattern: ["apps/forge/static/**", "apps/web/**"]
---

# UX principles

1. **Two worlds, one screen.** The InfoPath "paper" area stays faithful to the original: rendered XSL, original fonts, borders and table layout. Everything around it follows the Atlassian Design System:
   - tokens, never hard-coded colours;
   - dark mode supported;
   - 8 px spacing grid.
2. **Keep muscle memory for fillers:**
   - Tab order follows the document order of the original view;
   - an "Insert item" link under repeating tables, plus a row hover menu with Insert above, Insert below and Remove;
   - validation errors use a red dashed border with a hover tooltip, and a modal on submit if errors remain;
   - a calendar icon next to date fields;
   - Submit at the top, as in the InfoPath ribbon (the portal's own Send button triggers the same submit).
3. **Speak InfoPath, then translate.** Labels such as "Rules", "Views", "Data connections" and "Repeating table" get a small grey hint with the Atlassian term ("= Form section", "= Request type").
4. **Show coverage everywhere.** Every field shows one of four status chips: Native (green), App (blue), Manual (yellow), Unsupported (grey). Every chip has a reason on hover.
5. **Errors have three parts:** what happened, why, and what to click. Add an "Ask Rovo" button where Rovo is available.
6. **Empty states teach.** Studio's empty library offers "Try with a sample", which loads Microsoft's Expense Report and Travel Request templates.
7. **Accessibility:**
   - every Classic control gets a label (from the preceding table cell text) and ARIA attributes;
   - focus is visible;
   - contrast follows AA;
   - Lighthouse accessibility score ≥ 90 on the web viewer.
8. **Narrow screens.** Classic forms switch to "reflow" below 720 px: tables become stacked cards and repeating rows become collapsible cards.
9. **Copy.** Plain English, sentence case, no jargon like "FormIR" in the UI.
10. **Resurrection touch (subtle).** When an old form first renders, the paper fades from sepia to clean. Respect `prefers-reduced-motion`. No Halloween skin in the Forge app.

## Source of truth for the reproduction

`docs/infopath-ux.md` records how InfoPath 2013 actually looks and behaves, captured in a
Windows VM with screenshots, with a provenance tag on every claim (`[seen]`, `[format]`,
`[doc]`, `[guess]`). Read it before designing any screen, and never invent a visual detail it
already answers.

Two rules that come out of it and override taste:

- **Render the form's own styling.** The xsn decides borders, fonts and geometry. Two forms in
  the same product looked different on the same day. A viewer that restyles is wrong even when it
  looks better.
- **Required and invalid states have one correct appearance.** A red asterisk just inside the
  right edge for required; a dashed red border for invalid, on blur, not per keystroke.
