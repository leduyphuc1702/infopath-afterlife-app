# Spec brief 07: Classic form on the JSM portal + Repeating table field

## Summary
Customers fill the original-looking form on the JSM portal, with repeating tables, live totals and InfoPath-style validation. On submit, the data is stored with the request and synced to native Forms answers and a Repeating table custom field.

## Acceptance criteria (EARS)
1. WHEN a portal request type has Classic mode enabled, THE SYSTEM SHALL render the Classic runtime in `portalRequestCreatePropertyPanel` using the template version that is current at that moment.
2. WHEN the customer presses the portal's Send button, THE SYSTEM SHALL validate. If there are errors, it SHALL call `view.submit({isValid:false})` and show the error dialog. Otherwise it SHALL submit a compact summary as the issue property `afterlife`:
   - form URN;
   - version;
   - promoted values;
   - row count and totals;
   - seal hash.
3. WHEN the issue is created, a trigger SHALL:
   - store the full XML in Forge SQL, keyed by issue id;
   - write native Forms answers for mapped questions;
   - write repeating rows to the Repeating table field;
   - compute a SHA-256 seal over the canonical XML and store it in the property.
4. THE Repeating table field (`jira:customFieldType`, `type: object`) SHALL hold `{columns:[…], rows:[…], totals:{…}}`. Its schema is generated from the repeating group. It SHALL be viewable in issue view and portal view, and editable where Forge supports it [VERIFY which experiences].
5. THE SYSTEM SHALL index `afterlife.total`, `afterlife.rows`, `afterlife.form` and `afterlife.version` via `jira:entityProperty`, so JQL like `issue.property[afterlife].total > 1000` works.
6. WHEN the viewport is narrower than 720 px, THE SYSTEM SHALL reflow tables into stacked cards.
7. Drafts SHALL be kept in browser storage and restored if the customer returns within 7 days.

## Out of scope
- Anonymous portal users (verify whether the panel loads for them).
- Editing after submit (agents edit via native Forms or the field).
