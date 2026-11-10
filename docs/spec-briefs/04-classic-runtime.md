# Spec brief 04: Classic runtime (fill forms like InfoPath, plus Rule Trace)

## Summary
Make a rendered view interactive, the way InfoPath Filler worked:
- bind controls to an XML DOM;
- run rules, calculations and validation on every change;
- support repeating tables and sections, and switching views.

Add **Rule Trace**, a live log of which rules fired. InfoPath never had this.

## User stories
- As Lan (filler), I want to add expense rows and see the total update instantly, as before.
- As Tim, I want to see why a field changed, so I can debug a rule without guessing.

## Acceptance criteria (EARS)
1. THE SYSTEM SHALL bind every element with `xd:xctname` + `xd:binding` to a real input (Atlaskit where possible), preserving position and inline style. Context-relative bindings SHALL work inside repeating rows.
2. WHEN a bound value changes, THE SYSTEM SHALL, in this order:
   1. write it to the XML DOM;
   2. run the field's rule set (a rule with an `xsf:exitRuleSet` child stops the remaining rules);
   3. recompute dependent calculatedFields;
   4. re-evaluate errorConditions, customValidation and schema constraints;
   5. re-render the view.
3. THE SYSTEM SHALL stop recalculation loops after 16 passes and record a "possible rule loop" entry in Rule Trace.
4. WHEN the user clicks "Insert item" under a repeating table or section, THE SYSTEM SHALL insert the manifest's `fragmentToInsert` (or a schema-derived empty row) after the last row. A row menu SHALL offer Insert above, Insert below and Remove.
5. WHEN a field is invalid, THE SYSTEM SHALL show a red dashed border and a hover tooltip with the error's short message. Submit SHALL be blocked with a dialog that lists the errors and links to each field.
6. WHEN a button is clicked, THE SYSTEM SHALL run its rules. Supported actions are:
   - assignment;
   - dialog message;
   - switch view;
   - submit (delegates to the host);
   - close (no-op in hosts).
7. THE SYSTEM SHALL provide undo/redo (Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z) over data changes.
8. THE SYSTEM SHALL save a draft to the host every 10 s and on blur.
9. **Rule Trace:** WHEN trace mode is on, THE SYSTEM SHALL append one entry per evaluated rule. Each entry holds:
   - timestamp;
   - trigger field;
   - rule caption;
   - condition result;
   - each action with before and after values.

   The trace panel SHALL filter by field and highlight the field on hover.
10. THE SYSTEM SHALL complete one change cycle in under 30 ms for forms with fewer than 200 fields.

## Correctness properties
- **P3:** inserting N rows and then removing them restores canonical XML.
- **P7:** the rule engine terminates for any generated rule graph.
- Calculation idempotence: running recalculation twice with no input change produces no further changes.

## Out of scope
- Master/Detail editing.
- Horizontal repeating table editing.
- Query data connections (MVP shows "not available").
- Ink.
