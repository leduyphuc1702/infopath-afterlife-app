# Spec brief 06: Afterlife Studio (Forge admin page)

## Summary
The Jira admin page where admins upload templates, triage them, inspect them (X-ray), compare the original with the JSM version, adjust the mapping and publish to a JSM request type. It covers the Discover, Understand and Move steps inside Jira.

## Screens
- **S1 Library + Triage** (logic from spec 12): a summary line (forms, how many convert natively, need Classic, need work; total records) and wave chips, then a table of templates with these columns:
  - name;
  - InfoPath generation;
  - number of fields and rules;
  - coverage bar (Native / App / Manual / Unsupported) and Native %;
  - Manual + Unsupported count;
  - record count (when records were imported or uploaded);
  - main cause of death;
  - suggested wave, with the rule in a tooltip;
  - status (Analysed / Published);
  - target request type.

  Actions: Upload (multi-file and .zip), "Try with a sample", "Export plan" (CSV and one-page print), Delete. No effort or man-hour estimates anywhere.
- **S2 X-ray:** a **death certificate card** at the top (spec 12): each cause with date, source, evidence and replacement. Below it, three columns.
  1. Field tree, styled like InfoPath's Fields pane: folder, field and repeating icons; a required star.
  2. Tabs: Rules, Calculations, Validation, Data connections, Code, Signatures. Rules show both the original expression and a plain-English summary.
  3. Coverage donut and a to-do list, each item with an "Ask Rovo" button.

  Also includes:
  - the **dependency map**: select a field to highlight everything that uses it;
  - **data lineage**: for each dropdown, lookup and secondary data source, where its data comes from (file, SQL table, service, SharePoint list) and which fields and rules use it;
  - the **dead-connection check**: list every endpoint with an `internal` or `dead` badge (e.g. `http://chiron/_vti_bin/FormsServices.asmx`).
- **S3 Compare:** original render on the left, Forms preview on the right. Hovering a field on either side highlights its pair. A view selector, and a Rule Trace toggle (Classic preview).
- **S4 Mapping:** one row per field. Columns:
  - InfoPath type;
  - target question type (editable);
  - Jira field link, pre-filled with a suggested existing Jira field when name and type match (for example `Amount` to an existing number field), so the site does not fill up with duplicate fields;
  - required;
  - validation;
  - "index for JQL";
  - status chip.
- **S5 Publish:** choose a service project and a request type, then choose the mode:
  - Native only;
  - Native + Classic panel;
  - Classic primary.

  Enable the repeating-table field if needed. A pre-publish checklist (errors in plain language). A result screen with links to open the portal and the request type.

## Acceptance criteria (EARS)
1. WHEN an admin uploads up to 20 files at once, THE SYSTEM SHALL store them in 400 KB chunks, parse them in an async consumer, and show per-file progress.
2. WHEN the library is empty, THE SYSTEM SHALL offer "Try with a sample", which loads the bundled Microsoft Expense Report and Travel Request templates.
3. WHEN publishing, THE SYSTEM SHALL call the Forms API as the user. It SHALL show the created template id and the request type link, or a three-part error (what happened, why, what to do).
4. THE SYSTEM SHALL keep a version history per template. Re-uploading the same URN creates a new version, and the previous mapping is carried over.
5. THE SYSTEM SHALL follow the UX principles steering: Atlaskit, tokens, dark mode, empty, loading and error states for every screen.
6. WHEN a template has been analysed, S1 SHALL show its Triage row and wave, and S2 SHALL show its death certificate, using `packages/core/triage` (the same code as the web viewer).
7. WHEN suggesting an existing Jira field, THE SYSTEM SHALL only suggest fields of a compatible type, SHALL show the suggestion as editable, and SHALL never reuse a field without the admin seeing it in S4 before publish.

## Out of scope (MVP)
- Rebinding connections to new sources (C phase).
- Generating Confluence documentation (C phase).
