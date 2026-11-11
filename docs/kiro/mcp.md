# MCP servers for Kiro

There is one MCP server, defined in the agent file `.kiro/agents/afterlife.json` (added in
commit `84c1766`). There is no workspace `.kiro/settings/mcp.json`; that path stays in
`.gitignore` in case a server with a token is added later.

## `playwright`: `@playwright/mcp` 0.0.85

Started by the agent as `npx -y @playwright/mcp@0.0.85` with these flags:

| Flag | Why |
|---|---|
| `@0.0.85` (pinned) | The tool set and its output change between releases; an upgrade is a reviewed change. |
| `--headless` | No window on the developer's screen; the same in CI. |
| `--isolated` | A fresh profile in memory for each session: no cookies, storage or history from earlier runs or from the developer's own browser. |
| `--viewport-size 1280x800` | The size the e2e suite and `ux-principles.md` use; journeys resize from there (390 × 844, 640 × 400). |
| `--snapshot-mode none` | No accessibility snapshot after every action. Snapshots of form 08's paper run to thousands of lines; the agent asks for a snapshot of one part, or uses `browser_evaluate` for exact questions. |
| `--image-responses omit` | Screenshots are not sent back inline. They are saved and opened with the read tool only when needed. |
| `--output-dir /tmp/afl-mcp` | Screenshots, downloads and traces go outside the repo, so nothing under `samples/` or in git is touched. |
| `--allowed-origins http://localhost:4331` | The browser can reach only the local preview of the built app: no third-party request, and no way to reach the network from a page under test. |
| `timeout: 60000` | Building is done before the server is used; 60 s covers a cold `npx` start. |

The app is served for it with `vite build` and then
`vite preview --base /infopath-afterlife-app/ --port 4331 --strictPort` in `apps/web`, the same
base path as the e2e config. The server is stopped at the end of the turn.

## Use so far

### Turn 62: hunting Fill-mode defects (spec 14)

About 50 calls, 13 screenshots. Most calls were `browser_run_code_unsafe` scripts that walk one
journey (Fill on form 02, form 04's buttons and Rule Trace, form 05's views, form 10 record 1, a
keyboard-only pass, X-ray, print, Back and Forward, opening files, dark scheme and 640 × 400)
and return geometry, focus and text in one answer, plus `browser_take_screenshot` at each
journey's key moment.

Found by looking, and not by any suite (the suites passed on the code they were found on):

- **B7**, Rule Trace sentences cut off at the side panel's edge: seen in the dialog screenshot.
  No test measured an entry's width.
- **B8**, XPath inside skipped-action sentences: read on screen. The spec 04 tests checked the
  query sentence only.
- **B10**, the discard question says "this form" when the changes are on another form or
  record. While looking, it first seemed that opening a file dropped the changes; they were on
  record 1 while the screen showed the empty form, and the misleading question was the defect.
  No test turned Fill on away from the session's form.
- **B11**, focus to the page body after a view button: the e2e suite pressed the button by
  keyboard, where focus happened to stay; clicking it, as a person does, loses focus.
- **B12**, focus to the page body after opening a sample from the landing page: the spec 13 test
  started from Triage.
- **B9** (the reviewer asked to decide it): confirmed by doing download, undo, redo, leave.

K1, K2 and K4 to K6 were reproduced the same way before they were fixed; K1 and K2 were checked
again on screen after the fix.
