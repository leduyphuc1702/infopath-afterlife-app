# Spec 22 verification (2026-11-11)

"Before": `apps/web/src` and `packages/core/src` stashed back to `0ad4641`, the app built, and
`e2e/bugfixes22.spec.ts` run: the ten tests then written all failed (F9's was added after). The
core S3 test failed against the old `summary.ts` the same way.

| Bug | Test | Before | After |
|---|---|---|---|
| S1 | e2e S1 | "30 records.", summary closed | "12 of 30 records match Type: Meals.", Count "Expense rows", Meals chosen |
| S2 | e2e S2 | status unchanged | "Saved expense-report-summary.csv: the summary, 3 groups and the line for all.", focus on the button |
| S3 | core S3; records.spec, summary.spec | "1234 records" | "1,234 records"; CSV `A,1234` |
| S4 | e2e S4: read, rules, fill, keep, triage | empty form / landing page | the task's state and its line |
| S5 | e2e S5 | `#nonsense` kept, focus on body | no hash, focus on "Start with a task" |
| S6 | e2e S6 | body after Close tip; paper host after Keep filling | the heading; the Qty field |
| F1 | e2e F1 | Next and Summarize did nothing | record 2; the summary |
| F2 | e2e F2 | lists below the fold, focus on body | "Records not matched (2)" focused, in view, with the next step |
| F4 | e2e F4 | empty table | the sentence, no table |
| F5, F6, F7 | e2e F5/F7 | `#keep` on Records; old status; focus on body after export | no hash; status empty; focus on "Export records" |
| F8 | e2e F8 | bar and line both `rgb(28, 43, 66)` | different |
| F9 | e2e F9 | "Sort by any column" | names what the table does |

Final runs: `pnpm check` exit 0 (hooks 6, core 3,841 passed and 3 skipped, browser 337, web 116);
`pnpm e2e:web` 141 passed. Bundle: entry 89.6 of 100 KB, Worker 155.7 of 160 KB.
