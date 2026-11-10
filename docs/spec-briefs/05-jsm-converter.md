# Spec brief 05: converter to JSM Forms + Coverage Report

## Summary
Turn FormIR into a JSM Forms template (`FormTemplateRequest` JSON). Produce a Coverage Report that classifies every InfoPath element as Native, App (emulated), Manual or Unsupported, with a reason.

## User stories
- As Mai, I want to know before publishing exactly what will and will not carry over.
- As Tim, I want my form to become a native JSM form, so it keeps working even without this app.

## API surface (verified 2026-11-04)

Source: Atlassian's ProForma Forms REST API reference (0.0.0-alpha), 27 endpoints. It is
Atlassian's material, kept outside this repo on purpose and never committed.

- Base URLs: `https://api.atlassian.com/ex/jira/{cloudId}/forms` (the same base as Forge's product
  routes) and `https://api.atlassian.com/jira/forms/cloud/{cloudId}`.
- Read a project's templates: `GET /forms/project/{projectIdOrKey}/form` — `read:jira-work`.
- Create a template: `POST /forms/project/{projectIdOrKey}/form` — `manage:jira-project`. The body
  is `FormTemplateRequest { design, publish }`; `design` must contain all of `questions`,
  `sections`, `conditions`, `layout`, `settings`.
- Form of a request type: `GET /forms/servicedesk/{serviceDeskId}/requesttype/{requestTypeId}/form`
  — `read:servicedesk-request`.
- Attach a form to an issue or request, submit it, export it: `/forms/issue/{key}/form`,
  `/forms/request/{key}/form/{formId}/action/submit`, `.../format/answers|pdf|xlsx`.
- `settings` must contain `name` and `submit`; `submit` must contain both flags `lock` and `pdf`.
  Show/hide conditions use `sh`/`hide`.
- Publish, inside the create body (this is the S5 Publish step in spec brief 06; no extra API
  call is needed):
  - `publish.portal.portalRequestTypeIds` (`FormPublishingPortal`): array of request type ids;
    puts the form on the help center portal.
  - `publish.jira.issueCreateRequestTypeIds` (`FormPublishingJira`): JSM request types; puts the
    form in the agent's create dialog for those request types. **This is the key the converter
    uses for a JSM service project.**
  - `publish.jira.issueCreateIssueTypeIds` (`FormPublishingJira`): Jira issue types; for plain
    Jira projects only.
- The API's own documentation links to Forge's `product-fetch-api/#requestjira`, so Atlassian
  designed it to be called from Forge apps with `requestJira`.

Checked on a real site (2026-11-04): `api.asApp().requestJira('/forms/...')` returned 200 for
read, create and delete of a template; `asUser()` was not tried (day-1 check). `requestAtlassian`
returned 400 INVALID_TARGET_URL, so it is not used. Creating a template with `publish` already set
was not tried (day-1 check). Observed shapes: `questions` is a map keyed by numeric strings; each
question is `{label, type, choices[], description, questionKey, validation}`; `choices` is
`[{id, label, other}]`; `validation` is e.g. `{rq: true}`; a published template read back with
`publish.portalRequestTypeIds: [129]`.

## Acceptance criteria (EARS)
1. THE SYSTEM SHALL map field and control types to Forms question types:
   - text → `ts` or `tl`;
   - rich text → `rt`;
   - dropdown → `cd`;
   - combo box → `cd` with an "other" choice;
   - multi-select → `cl` or `cm`;
   - boolean checkbox → `cm` with a single choice;
   - option buttons → `cs`;
   - date → `da`;
   - dateTime → `dt`;
   - time → `ti`;
   - numbers → `no`;
   - email pattern → `te`;
   - URL → `tu`;
   - people → `us` or `um`;
   - attachment → `at`.
2. THE SYSTEM SHALL map:
   - required to `rq`;
   - XSD length facets to `mnc`/`mxc`;
   - numeric bounds to `mnn`/`mxn`;
   - date bounds to `mnd`/`mxd`;
   - simple pattern errorConditions to `rgx` with the original message.
3. THE SYSTEM SHALL map sections to Forms sections. Optional sections and choice groups SHALL become sections with conditions on a generated choice question. Show and hide formatting rules whose condition depends on a single choice field SHALL become section conditions.
4. THE SYSTEM SHALL map two-level filtered dropdowns to `cc` (cascading) when the filter matches the parent field.
5. THE SYSTEM SHALL classify repeating tables and sections, calculations, assignment rules, buttons and multi-field validations as App. The reason SHALL name the app feature that handles them (Repeating table field, Classic runtime).
6. THE SYSTEM SHALL classify data connections, submit adapters, code-behind, signatures and user roles as Manual. Each SHALL carry a suggested replacement (Assets, Automation, JSM approvals, project roles).
7. THE SYSTEM SHALL classify ActiveX controls, ink and offline features as Unsupported.
8. THE SYSTEM SHALL output JSON that validates against the `FormTemplateRequest` schema from the official Forms OpenAPI file, including `settings.submit` with both `lock` and `pdf`, and SHALL fill `publish.portal.portalRequestTypeIds` when the user picks the portal target.
9. THE SYSTEM SHALL link promoted fields (`listProperties`) to existing Jira fields when the names match, and SHALL warn before suggesting a duplicate field.
10. (C phase) WHEN a rule routes or blocks the form on a value threshold or a role (for example "Total > 1000 needs Finance"), THE SYSTEM SHALL suggest a JSM approval step and an Automation outline in the Coverage Report: trigger, condition, approvers. Suggestion only; nothing is created.

## Correctness properties
- **P2:** every FormIR element gets exactly one state and a non-empty reason. The four state counts sum to the element total.
- Converter output validates against the OpenAPI schema for every FormIR from the generator.

## Out of scope
- Creating Automation rules automatically (suggest only in MVP).
- Creating workflows.
