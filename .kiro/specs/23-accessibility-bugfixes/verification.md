# Spec 23 verification (2026-11-11)

Each test run on the unfixed build (`ded0897` sources) first, then on the fixed build.

| Bug | Before | After |
|---|---|---|
| B1 rules, keep | `toContainText('-001.xml')` failed after Forward (empty form) | pass |
| B1 find, document | `toHaveURL(/#find$/)` failed after Forward | pass, `history.length` unchanged |
| B1 read, fill, triage | passed (the reviewer's "come back as they were") | pass |
| B2 Back, Next | heading "Discard your changes?": element not found | pass |
| B3 light, dark | contrast `toBeGreaterThanOrEqual(3)` failed | pass |
| B4 | `{ nameless: 1, dead: 1 }` instead of `{ 0, 0 }` | pass |
| B5 | region "Records found" / paper frame: focus timed out | pass |
| B6 | pressed toggle's text `rgb(0, 0, 0)` like the unpressed one | pass |
| B7 | table "Fields": element not found | pass |
| B8 (round 2, `bugfixes23-b8.spec.ts`) | scrollWidth 343 > clientWidth 308 (1280 px) and 278 (320 px) | pass at both widths |

Final runs: see `docs/accessibility.md` and the turn report.
