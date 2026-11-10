---
inclusion: fileMatch
fileMatchPattern: ["apps/forge/**"]
---

# Forge app rules

## Modules we use
| Module | Purpose | UI |
|---|---|---|
| `jira:adminPage` | Afterlife Studio: library, X-ray, compare, mapping, publish, legacy import | Custom UI |
| `jiraServiceManagement:portalRequestCreatePropertyPanel` | Classic form on the portal create screen; `view.submit({fields, isValid})` stores values as an issue property | Custom UI |
| `jiraServiceManagement:portalRequestDetailPanel` | Original view on the portal request page | Custom UI |
| `jira:issuePanel` | Original view for agents and approvers | Custom UI |
| `jira:customFieldType` (`type: object` + JSON `schema`) | Repeating table field | View: UI Kit only. Edit: Custom UI |
| `jira:entityProperty` | Index `afterlife` issue property for JQL (form, version, total, rows, seal) | — |
| `trigger` (`avi:jira:created:issue`) | Sync Classic submissions to Forms answers and the custom field | — |
| `consumer` + `queue` (async events) | Batch parse, legacy import (`timeoutSeconds` up to 900) | — |
| `rovo:agent` + `action` | Form Archaeologist agent | — |
| `rovo:mcp` | Expose the same actions to external MCP clients (Preview) | — |
| `sql` | Forge SQL storage (add in the first deploy) | — |

## Rules
- Run long work in async consumers, never in resolvers. Resolvers return within 25 s.
- Chunk data across the bridge: 500 KB per request. Upload a .xsn in 400 KB chunks into SQL, then enqueue the parse.
- Prefer `asUser()` for JSM and Forms calls so permissions follow the user. Use `asApp()` only where documented to work.
- Keep the `afterlife` issue property under 32 KB. Put large payloads (full XML) in SQL, keyed by issue id.
- Custom UI CSP: allow inline styles only if required for the InfoPath "paper" area (`permissions.content.styles: ['unsafe-inline']`, [VERIFY]). No remote scripts.
- Egress: none in the MVP. Any later lookup connectors must be declared under `permissions.external.fetch`.
- Every resolver validates input with a schema (zod or hand-written guards).
- Environments: `development` for daily work, `staging` for judge-like testing, `production` for the Marketplace listing.
- **Two app IDs, one codebase.** A Forge app that has been submitted to Marketplace can no longer be shared via an installation link (verified on developer.atlassian.com, distribute-your-apps). Keep:
  - (A) `afterlife`: the Marketplace listing;
  - (B) `afterlife-judges`: same code, no licensing, distribution "Sharing", used for the Codegeist installation link.

  Generate the two manifests from one template (only `app.id` and the name differ), and deploy both from CI.
- **Stay single-product (Jira/JSM).** Apps that are compatible with multiple Atlassian apps can only be listed as paid. Do not call Confluence APIs or declare extra `app.compatibility`.

## Day-1 verifications (record results in docs/ARCHITECTURE.md)
1. The Forms API is reachable from Forge (`asUser`): create a template, then publish it to a portal request type.
2. `portalRequestCreatePropertyPanel` Custom UI can run `xslt-processor` and render inline styles.
3. `customFieldType` object: maximum value size, and which experiences support edit on the portal.
4. A Rovo agent runs on the dev site, and `rovo:mcp` can be enabled.
5. Can Forms questions be placed inside ADF table cells in the form layout?
