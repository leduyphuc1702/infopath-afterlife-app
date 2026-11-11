# Spec 21 verification (2026-11-11)

| Req | Test (`apps/web/e2e/tasks.spec.ts`) | Result |
|---|---|---|
| 1, 2, 3, 4, 5 | for each of the 7 tasks, from the page: the screen and state, `#id` in the bar, one hint announced, Back to the landing page with focus on "Start with a task" | 7 pass |
| 2, 4, 5 | for each task, opened from its address, then Back | 7 pass |
| 3 | Close tip removes the line; typing in Find removes it | pass |
| 6 | `#nothing-here`: the landing page, no hint, no error, the hash removed | pass |
| 8 | 390 px: no sideways scroll; each task link at least 24 px high | pass |

Looking (5 MCP calls): at 390 px the first task wrapped onto a second line and its bullet sat
beside the second line (the link was `inline-block`); now `display: block`. A screenshot of the
"keep" task at 390 px showed the view checkboxes unticked; reading them gave all three ticked
(the shot was taken during a re-layout), so nothing changed.

Final runs: `pnpm check` exit 0 (hooks 6, core 3,840 passed and 3 skipped, browser 337, web 116);
`pnpm e2e:web` 130 passed. Bundle: entry 89.0 of 100 KB, Worker 155.7 of 160 KB. Lighthouse was
not measured this turn.
