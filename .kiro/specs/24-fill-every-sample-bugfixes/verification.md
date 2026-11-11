# Spec 24 verification (2026-11-11)

Every test was run on the unfixed code (`c55f031` sources, built) first.

| Bug | Before | After |
|---|---|---|
| W1 Undo | "What happened": element not found; pageerror `IndexSizeError … offset 41` | pass |
| W1 net | alert "could not be drawn": element not found (the page was empty) | pass |
| W2 | button "Choose a date for Needed by": focus timed out | pass |
| W3 | `{ kind: 'unmatched' }` instead of `exact`; `downloadedXml is not a function` | pass |
| W4 | `isContentEditable` true | pass |
| X1–X4 | 5 to 13 findings per sample (02, 04, 06, Weight keeper) | none |
| X5 | focus not on the field | `SPAN Qty` |
| D1 | no `aria-description` | pass |
| P23 | passes on the unfixed code too, as the reviewer's script found: it guards, it found nothing | pass |
