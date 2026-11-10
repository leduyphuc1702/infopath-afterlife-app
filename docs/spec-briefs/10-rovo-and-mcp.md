# Spec brief 10: Rovo agent "Form Archaeologist" + rovo:mcp

## Summary
An agent that explains old InfoPath forms in plain language and helps finish the migration. The same actions are exposed through `rovo:mcp` to external clients: Kiro, Claude, Cursor.

## Actions (one Forge function each, compact JSON output)
1. `list_forms()`: templates with coverage counts.
2. `get_form_xray(formId)`: fields, rules, connections, coverage.
3. `explain_rule(formId, ruleId)`: the original expression, plus structured parts the agent turns into English.
4. `find_field_usage(fieldName)`: across all forms; returns the forms, rules and views that use it.
5. `list_dead_connections(formId?)`: internal or dead endpoints, with a suggested replacement.
6. `suggest_automation(formId, ruleId)`: a JSM Automation rule outline (trigger, conditions, actions). Suggestion only.
7. `search_records(jql)`: legacy and Classic records. Returns keys, form, version and seal status.
8. `convert_form(formId, projectKey, requestTypeId)`: a confirmation step is required, and the action returns the plan before executing.
9. `plan_migration()`: the waves from Triage (spec 12), the forms in each wave and the rule that put them there. Lets Quang ask "Which forms are in wave 1, and why?"
10. `get_death_certificate(formId)`: the causes of death with date, source and evidence, and what replaces each one.

## Acceptance criteria (EARS)
1. THE agent prompt SHALL instruct it to answer only from action results, cite field and rule names, and say "not found" instead of guessing.
2. EVERY action SHALL return in under 5 s and respond with less than 20 KB of JSON.
3. `convert_form` SHALL never run without an explicit user confirmation in the conversation.
4. THE `rovo:mcp` module SHALL expose the read-only actions 1–7, 9 and 10, with names of 30 characters or fewer. `convert_form` SHALL NOT be exposed through MCP. The README SHALL explain how a site admin enables external exposure.
5. A demo conversation SHALL work end to end on the dev site: "Which forms should we move first, and why?", then "Why is Purchase Request dead?", then "What does the Approve button do in Travel Request?", then "Draft an Automation for the manager-approval rule."
6. THE app SHALL ship a `skill.md` for MCP clients that describes the actions and the four-step workflow (Discover, Understand, Move, Keep), for the Codegeist MCP bonus write-up.

## Kiro dogfooding
- Add the app's MCP endpoint to Kiro's MCP settings.
- During development, ask Kiro to call `get_form_xray` after a conversion, to verify coverage. Record it in JOURNAL.md for the write-up.
