# Hooks to create in Kiro

Format checked 2026-11-02 at kiro.dev/docs/hooks:
- files go in `.kiro/hooks/*.json`, with `"version": "v1"`;
- triggers include `PostFileSave`, `PreToolUse`, `PostToolUse` and `Stop`;
- actions are `command` (shell) or `agent` (prompt).

Ask Kiro to create these hooks from the descriptions below, so the history shows Kiro authored them. Check the full trigger list at kiro.dev/docs/hooks/types on day 1.

**kiro-cli does not load `.kiro/hooks/`.** That folder is read by the Kiro IDE. CLI hooks live in
the agent JSON (`.kiro/agents/afterlife.json`, field `hooks`), and the CLI documentation lists
only these triggers: `agentSpawn`, `userPromptSubmit`, `preToolUse`, `postToolUse` and `stop`. Its
only action type is `command`; exit code 2 from a `preToolUse` hook blocks the tool. There is no
`PostFileSave` trigger and no `agent` (prompt) action in the CLI, so the file-save and agent rows
below apply to the IDE only, or must be rewritten as `postToolUse` on `write` with a command. No
hooks exist yet in either place.

| Name | Trigger and matcher | Action | Purpose |
|---|---|---|---|
| test-core-on-save | `PostFileSave`, `^packages/core/.*\.ts$` | command: `pnpm --filter core vitest related --run "$FILE"`. Read the file path from the STDIN JSON; let Kiro write the small wrapper script. | Fast feedback on core changes |
| golden-on-sample | `PostFileSave`, `^samples/(own\|public)/.*\.(xsn\|xml)$` | agent: "A sample changed. Regenerate golden snapshots for it, show me the diff and explain any coverage change before accepting." | Keep golden tests honest |
| forge-lint-on-manifest | `PostFileSave`, `^apps/forge/manifest\.yml$` | command: `cd apps/forge && forge lint` | Catch manifest errors early |
| license-guard | `PreToolUse` on file-write tools whose path matches `^samples/` | command: a script that blocks the write unless `docs/SAMPLE-LICENSES.md` lists the file's source as "in repo", and always blocks copying a file from under `$AFTERLIFE_PRIVATE_SAMPLES` into the repo | Licence safety for the public repo |
| no-secrets | `PreToolUse` on file-write tools | command: scan the content for tokens such as `ATATT`, `ghp_`, `AKIA` and private keys; block if found | Public repo safety |
| journal-on-stop | `Stop` | agent: "Append 3–5 lines to .kiro/JOURNAL.md: what you did, what Kiro feature helped (spec, hook, steering, MCP, PBT), and anything that went wrong." | Raw material for the write-up and blog |
| spec-sync-check | `PostFileSave`, `^\.kiro/specs/.*/requirements\.md$` | agent: "Requirements changed. List tasks in tasks.md that are now stale or missing." | Keep specs and tasks aligned |
