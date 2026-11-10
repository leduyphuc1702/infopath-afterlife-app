# MCP servers for Kiro

Config file: `.kiro/settings/mcp.json`, at workspace level, committed to the repo. Do not commit secrets; use `${ENV}` expansion instead.

| Server | Type | Why |
|---|---|---|
| Atlassian Remote MCP (official) | remote, OAuth | Read Jira/JSM projects, request types and issues on the dev site while building and testing. [VERIFY the current endpoint URL in Atlassian docs on day 1, and do not guess it.] |
| Playwright MCP (`@playwright/mcp`) | local `npx` | Drive the web viewer and Forge pages, take screenshots, and compare renders with the reference PNGs |
| Our own app via `rovo:mcp` | remote, `https://mcp.atlassian.com/forge/<appId>` | Dogfooding: Kiro calls `get_form_xray` and `list_dead_connections` to verify conversions |
| GitHub MCP (optional) | remote | Issues and PRs for the bug log; shows Kiro managing the repo |

Example shape (to be completed by Kiro):
```json
{
  "mcpServers": {
    "playwright": { "command": "npx", "args": ["@playwright/mcp@latest"] },
    "afterlife": { "url": "https://mcp.atlassian.com/forge/${AFTERLIFE_APP_ID}" }
  }
}
```

Record in JOURNAL.md every time an MCP tool caught a real problem. That is the strongest evidence for the "variety of Kiro features" criterion.
