# Spec 22 design

Root causes at `0ad4641`. Tests: `apps/web/e2e/bugfixes22.spec.ts` (11),
`packages/core/test/legacy/summary.test.ts` (S3).

| Bug | Root cause | Fix |
|---|---|---|
| S1 | `Summary` kept its choices in its own state; `Records` kept `summing` and `pick` in its own; both unmount on opening a record | `ListPlace.summary` (`open`, `state`, `pick`); `Summary` takes `initial` and reports `onState` |
| S2 | `save()` only | `onSaved` → `Records onNotice` → App notice |
| S3 | raw `String(n)` | `toLocaleString('en-US')` in core's `counted` and on the page |
| S4 | `popstate` restored the place only (screen, form); the task's state lives outside it | a known `#task` reached from the landing page runs the task again |
| S5 | `popstate` with no place went home but kept the hash; focus was asked for before the landing page drew | `replaceState` without the hash; focus in an effect once there is no template |
| S6 | Close tip removed the focused button; `<dialog>` returned focus to the paper's shadow host | focus the screen heading; `Confirm` keeps the deep active element and refocuses it on "no" |
| F1 | tip removed on `pointerdown` | removed on `click` (capture), after the click is dispatched |
| F2 | `Unmatched` below the landing page | above it, first heading focused when its lists change; next step in the reason |
| F4 | table drawn for 0 units | sentence when Find found nothing |
| F5 | `visit()` pushed new entries on the current URL | a new entry's URL has no hash |
| F6 | export menu closed with focus inside | focus its `summary` when focus is on the body |
| F7 | `s.notice` kept across places | an effect drops a notice given on an earlier place |
| F8 | `--ds-background-selected` = `--ds-background-information` in dark | `--ds-background-neutral` for the chosen line |
| F9 | copy | the Triage tip names what the table does |

## Existing tests changed
- `e2e/records.spec.ts`: `measure()` reads "5,000 records." and "of 5,000 records match."; R11
  "5,000 records." and "1 of 5,000 records match." (S3).
- `e2e/summary.spec.ts` R10: "5,000 records." and "2,500 records, grouped by…" (S3).
