# Kiro hooks

Created 2026-11-11. The CLI reads hooks from the agent file `.kiro/agents/afterlife.json`, field
`hooks` (object format: trigger → list of `{matcher, command, timeout_ms}`). Format checked with
the CLI's own documentation (`introspect`, "Hooks System" and "Agent Configuration"), and the file
passes `kiro-cli agent validate --path .kiro/agents/afterlife.json` (exit 0). The CLI reads the
agent file when a turn starts, so the hooks run from the turn after the one that wrote them.

## What exists

The scripts are in `tools/kiro-hooks/`: plain Node, no dependencies. Each one reads the hook event
as JSON from STDIN. Their tests are in `tools/kiro-hooks/test/hooks.test.mjs`, run by
`pnpm test:hooks` (`node --test`), which is part of `pnpm check`.

A hook never breaks a turn. Every script exits 0 on any error, bad input, or after its own time
limit (4 s; 7 s for the formatter); only the two guards exit 2, and only when they block.

| Hook | Trigger, matcher | What it does |
|---|---|---|
| `no-secrets.mjs` | `preToolUse`, `write` | Blocks content holding an Atlassian API token (`ATATT…`), a GitHub token (`ghp_…`, `gho_…`), a fine-grained GitHub token (`github_pat_…`), an AWS key id (`AKIA…`, `ASIA…`), a `-----BEGIN … PRIVATE KEY-----` block, or a Forge web trigger URL with its token. The message names the pattern, never the matched text. |
| `sample-guard.mjs` | `preToolUse`, `write` and `shell` | Blocks a write to a path under `samples/`, and a shell command that writes, moves, copies or deletes there (`rm`, `mv`, `cp`, `>`, `sed -i`, `git checkout`, `tar`, a script calling `writeFile`, …). Reading `samples/` stays allowed. The agent file's `deniedPaths` already covers the write tool; this adds the shell. |
| `format-on-write.mjs` | `postToolUse`, `write` | Runs `prettier --check --ignore-unknown` from the repo root on the written file when it is `.ts`, `.tsx`, `.css` or `.json` and inside the repo; prints one line when it fails. Never rewrites, never blocks. Files `.prettierignore` excludes pass silently. |
| `journal-on-stop.mjs` | `stop` | Appends one line to `.kiro/JOURNAL.md`: UTC time, files changed since the last commit by area (counts from `git status --porcelain`), and ticked over all task boxes per spec. It ignores the event's `assistant_response`: no prose, no prompt text. |

## Differences from what we assumed

- The `write` matcher is a group: it selects the `write` **and** `code` tools. The guards handle
  `code`: only a `pattern_rewrite` with `dry_run: false` on a `samples/` path is blocked.
- The write tool's input has its own `command` field (`create`, `strReplace`, `insert`), so the
  sample guard tells the shell apart by `tool_name`, not by the field.
- The `stop` event carries the full `assistant_response`. The journal reads none of it.
- Object-format timeouts are `timeout_ms` (milliseconds); the array format uses `timeout` in
  seconds. We use the object format.
- `node --test <folder>` does not run a folder on Node 22, so the script names the file glob.

## Kiro IDE hooks: not created

The CLI documentation available to the agent does not describe the IDE's `.kiro/hooks/*.json`
format. The earlier note here (checked 2026-11-02 on kiro.dev) said `"version": "v1"` with
`PostFileSave`, `PreToolUse`, `PostToolUse` and `Stop`, but not the fields of a hook file, so no
IDE file was written. The four scripts take a JSON event on STDIN and can be called from an IDE
hook once its format is confirmed.

## Rows of the old table that were dropped

| Old row | Why |
|---|---|
| test-core-on-save | No `PostFileSave` in the CLI. As a `postToolUse` on every write it would run vitest dozens of times per turn; the workflow already runs each task's tests. |
| golden-on-sample | The agent cannot write under `samples/`, and the action was an agent prompt, which the CLI does not have. |
| forge-lint-on-manifest | `apps/forge` does not exist yet. Add it as a `postToolUse` on `write` when the manifest lands. |
| license-guard | Replaced by `sample-guard`: no write under `samples/` is allowed at all, so checking `SAMPLE-LICENSES.md` per write is not needed. Copying from `$AFTERLIFE_PRIVATE_SAMPLES` into the repo is still covered by the steering rules, not by a hook. |
| journal-on-stop (agent prose) | Kept, as counts only: a command cannot write prose, and a prompt-free journal cannot leak text. |
| spec-sync-check | An agent prompt on file save; neither exists in the CLI. |

## Proof runs (2026-11-11, by hand, Node 22)

Run from the repo root, `R=$(pwd)`:

| Command | Exit | Output |
|---|---|---|
| `echo '{"tool_name":"write","tool_input":{"content":"const k = \"AKIA…EXAMPLE\""}}' \| node tools/kiro-hooks/no-secrets.mjs` (a 20-character AKIA key) | 2 | `Blocked by the no-secrets hook: the content holds an AWS access key id (AKIA…). Put secrets in Forge environment variables …` |
| same, content `const k = 1` | 0 | (none) |
| `{"cwd":"$R","tool_name":"shell","tool_input":{"command":"mv x.xml samples/own/records/"}}` → `sample-guard.mjs` | 2 | `Blocked by the sample-guard hook: the agent never changes files under samples/ …` |
| `cp samples/own/xsn/02-expense-report.xsn /tmp/x.xsn` as a shell event → `sample-guard.mjs` (run from a script file, 2026-11-11) | 0 | none: a copy out of `samples/` reads it |
| `tar -czf /tmp/s.tgz samples/own/xsn` → `sample-guard.mjs` | 0 | none: an archive written elsewhere |
| `tar -xzf /tmp/s.tgz -C samples/own` → `sample-guard.mjs` | 2 | the block message. The live hook also blocked the first attempt at this proof, a shell command whose text held this line |
| same, command `grep -r amount samples/own/records` | 0 | (none) |
| `{"cwd":"$R","tool_name":"write","tool_input":{"command":"create","path":"samples/own/x.xml"}}` → `sample-guard.mjs` | 2 | same block message |
| `{"cwd":"$R","tool_name":"write","tool_input":{"path":"package.json"}}` → `format-on-write.mjs` | 0 | (none: formatted) |
| same, path to a badly formatted `tools/kiro-hooks/bad.json` (made and deleted for the run) | 0 | `format-on-write: tools/kiro-hooks/bad.json is not formatted; run \`pnpm exec prettier --write …\`` |
| `{"hook_event_name":"stop","cwd":"$R","assistant_response":"SECRET PROSE"}` → `journal-on-stop.mjs` | 0 | `.kiro/JOURNAL.md` gained `- 2026-11-11 04:33 UTC. Changed since last commit: (root) 2, .kiro/agents 1, tools/kiro-hooks 6. Tasks ticked: … 04-classic-runtime 4/13 …`; "SECRET" appears 0 times |
| `pnpm test:hooks` | 0 | 5 tests, 5 pass (each pattern, shell write and read cases, bad JSON exits 0) |
