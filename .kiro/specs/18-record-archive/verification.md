# Spec 18 verification (2026-11-11)

| Criteria | Test | Result |
|---|---|---|
| R2–R5, R7 | `packages/core/test/legacy/archive.test.ts`: form 02 (30 pages, 81 files named as the export, foot, links, index columns), form 05 (3 views, links between them, order kept) | pass |
| R8, R9 | same file: cancel after record 3 gives nothing; an unreadable record keeps its page with the reason | pass |
| R6, P21 | same file: P21, 100 runs of hostile form 02 records; four own forms; the checker's own test (9 leaks found) | pass |
| R1, R3, R8 | `e2e/archive.spec.ts`: from the form screen, the archived page's text equals the paper's; the status line; from the Records screen, the index keeps the found order | pass |
| R8, R10 | `e2e/archive.spec.ts`: 1,000 generated records, progress, Cancel saves nothing, then the archive | pass |

## Measured (built app, Chromium, from the click to the download)

| | Time | Zip size | Entries |
|---|---|---|---|
| Form 02, 30 records | 243 ms alone, 300 ms in the full suite | 169 KB | 30 pages, index, README, 81 files |
| 1,000 generated records | 2,034 ms alone, 5,779 ms in the full suite | 5.19 MB | 3,002 |

Core alone, form 02's 30 records: 212 ms, 166 KB.

## Looked at (MCP, served over http on port 4331)

Opened form 02 record 001, form 05 record 001's IT view and form 02's index. Each loaded only its
own file and logged nothing. Two changes: "Insert item" no longer shows in a page (nothing can
be inserted in an archive), and file names in the index no longer wrap mid-word.
