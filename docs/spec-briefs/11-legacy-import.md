# Spec brief 11: legacy record import

## Summary
Turn a folder or .zip of old filled InfoPath records (.xml) into searchable JSM issues. Each issue keeps the original rendering, its attachments and the people mapping.

## Acceptance criteria (EARS)
1. WHEN an admin uploads a .zip of up to 500 .xml records (MVP), THE SYSTEM SHALL match each record to a template, using the `mso-infoPathSolution` URN first and the `href` second. It SHALL list unmatched records separately.
2. THE SYSTEM SHALL apply the template's `upgrade.xsl` to records whose `solutionVersion` is older than the stored template version.
3. THE SYSTEM SHALL show a preview of 5 records, plus a mapping step:
   - summary field (template);
   - an old status or field mapped to a JSM status;
   - an old date kept as the property `afterlife.originalDate`.
4. THE SYSTEM SHALL extract embedded file attachments (base64 inside XML) and upload them as Jira attachments.
5. THE SYSTEM SHALL map people (`DOMAIN\\user`, display names, emails) to Atlassian accounts through a reviewable mapping table. Unmapped people stay as text and are flagged.
6. THE SYSTEM SHALL create issues in an async consumer at a safe rate, report progress, continue after per-record errors, and allow "retry failed".
7. EVERY imported issue SHALL show the Original view panel and be searchable via the indexed `afterlife` property.
8. WHEN an import finishes, THE SYSTEM SHALL offer an import report as CSV: record file, template version, issue key (or error with what to do), attachments count, unmapped people.
9. THE MVP import SHALL handle 200 records end to end on the dev site (the demo set from `samples/own`); 500 is the target for the full import.

## Out of scope
- Pulling directly from SharePoint. The admin exports files first. A guide for doing so goes in the docs.
- Organisations without Jira use the web viewer's CSV/XLSX export instead (spec 09).
