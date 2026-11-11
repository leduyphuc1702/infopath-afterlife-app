# Kiro in this repository: a map

Where to look, in the order a reviewer with ten minutes might take it.

| What | Where | What it holds |
|---|---|---|
| Specs | [`.kiro/specs/`](../../.kiro/specs/) | 22 folders. Requirements-first: 01–04, 09, 12, 15, 17, 18, 20, 21 (`requirements.md`, `design.md`, `tasks.md`, `verification.md`). Bugfix: 13, 14, 16, 19, 22–28 (`bugfix.md` instead of `requirements.md`). Counts per spec: the [README status table](../../README.md#status) |
| Spec skill | [`.kiro/skills/spec/SKILL.md`](../../.kiro/skills/spec/SKILL.md) | How a brief becomes a spec, phase by phase, and the "Bugfix specs" format |
| Briefs | [`docs/spec-briefs/`](../spec-briefs/) | What each spec started from, including those not written yet (05–08, 10, 11) |
| Steering | [`.kiro/steering/`](../../.kiro/steering/) | Eight files loaded into every session: [product](../../.kiro/steering/product.md), [tech](../../.kiro/steering/tech.md), [structure](../../.kiro/steering/structure.md), [testing](../../.kiro/steering/testing.md) (properties P1–P21), [UX principles](../../.kiro/steering/ux-principles.md), [InfoPath domain](../../.kiro/steering/infopath-domain.md), [Forge platform](../../.kiro/steering/forge-platform.md), [samples and licensing](../../.kiro/steering/samples-and-licensing.md) |
| Agent file | [`.kiro/agents/afterlife.json`](../../.kiro/agents/afterlife.json) | The headless agent: allowed tools, denied shell commands, the hooks and the Playwright MCP server |
| Hooks | [`hooks.md`](hooks.md), code in [`tools/kiro-hooks/`](../../tools/kiro-hooks/) | Format on write, refuse writes under `samples/`, refuse secrets, journal line on stop; tested by `pnpm test:hooks` |
| MCP | [`mcp.md`](mcp.md) | The Playwright MCP server on the built app: what each session did, how many calls, and which defects only looking found |
| Journal | [`.kiro/JOURNAL.md`](../../.kiro/JOURNAL.md) | One line per session, written by the stop hook |
| Who wrote what | [README, "What Kiro did not write"](../../README.md#what-kiro-did-not-write) | The reviewer's commits and lines |
| Results | [README, "Quality"](../../README.md#quality), [`docs/accessibility.md`](../accessibility.md) | Bugfix counts, properties P1–P23, suite totals, the WCAG 2.2 AA table |

A quick path: read one requirements-first spec (for example
[`17-records-list`](../../.kiro/specs/17-records-list/)) and one bugfix spec (for example
[`24-fill-every-sample-bugfixes`](../../.kiro/specs/24-fill-every-sample-bugfixes/)), then
[`mcp.md`](mcp.md)'s turn 76 section, which shows defects found by filling forms through MCP and
fixed in spec 24.
