# Spec 19 verification (2026-11-11)

"Before" is the code at `6d27aab`. Core and unit tests were run before their fix and failed as
shown. The e2e tests in `bugfixes19.spec.ts` were written in the same pass as the page fixes, so
their "before" is the defect as seen through the MCP server (F1–F5, R1) or in the reviewer's
report, not a run of the test on the old build.

| Bug | Test | Before | After |
|---|---|---|---|
| T1 | the seven named core files under 12 busy processes (load average 13) | 7 timeouts at 5 s (reviewer's run, load 11) | 98 pass in 13.3 s |
| A1 | core A1 (2); P21 on form 06 rich text, 100 runs | `<input>`, `<button>` in rich text; `href="http://evil.example/out"` in the page | pass |
| A2 | e2e A2/F2; B3 at one row | toolbar of two rows at 1280 px | pass |
| A3 | core A3 | no width on long cells | pass |
| A4, R3 | core R3; e2e R2/R3 | Failed checks last, blank for a clean record | pass |
| R1 | e2e R1 | no question; $77.00 in read mode (seen through MCP) | pass |
| R2 | core R2; unit R2; e2e | "lodging": 0 of 30 | pass |
| R4 | e2e R4 | an empty box (screenshot) | pass |
| R5 | e2e R5 | file name 194 px of 390 | pass |
| P1 | e2e P1 | words broken in print (reviewer, form 04 on A4) | pass |
| P2 | unit P2 | hour `08` against local `15` | pass |
| P3 | core P3 | bare host; indented code block; `1\.0.0.1` | pass |
| P4 | core P4 | raw message with ids in the sentence; reference said twice | pass |
| P5 | unit P5 | `1472.1299999999999` | `1472.13` |
| F1 | core F1; e2e | "SAL"; Find "finance" 0 of 20 on form 05 | pass |
| F2, F3 | e2e A2/F2; archive.spec Cancel | focus on BODY after both | pass |
| F4 | e2e F4 | 13 Tabs from Find to the first record on form 02 | Enter |
| F5 | e2e F5 | box 176 px at 640×400 | pass |

Final runs: `pnpm check` exit 0 (hooks 6, core 3,831 passed and 3 skipped, browser 337, web 116);
`pnpm e2e:web` 107 passed. Bundle: entry 85.8 of 100 KB, Worker 153.8 of 160 KB.
