# Spec brief 02: FormIR (intermediate representation)

## Summary
One versioned JSON model that describes an InfoPath form. The converter, the Classic runtime, Studio UI, the Rovo actions and the MCP tools all read FormIR, never the raw manifest.

## User stories
- As a developer, I want one source of truth, so every surface agrees on what a form contains.
- As Tim (form owner), I want to diff two template versions as text, which InfoPath never allowed.

## Acceptance criteria (EARS)
1. THE SYSTEM SHALL produce FormIR with the following parts:
   - `irVersion`;
   - `meta`: name, URN, solutionVersion, productVersion, InfoPath generation (2003/2007/2010/2013), publishUrl;
   - `fields[]`: id, path, label guess, xsdType, required, repeating, groupId, default value, source location;
   - `groups[]`;
   - `views[]`: name, xsl file, isDefault, isPrint;
   - `rules[]`: id, trigger field, condition, actions[], caption, enabled, stopProcessing;
   - `calculations[]`;
   - `validations[]`;
   - `dataConnections[]`: id, adapter type, endpoint, isSubmit, `liveness: internal|package|unknown` (no `dead`: a liveness check is a viewer action and its result lives in the viewer, spec 09), `credentialRedacted` when a password was removed from a connection string;
   - `codeBehind`: present, files, handlers;
   - `signatures`;
   - `promotedFields[]`;
   - `unknowns[]`: every manifest or schema node the parser does not model (spec 01 R13), carried over unchanged: kind, file, path, namespace, name, line, raw XML, and `documented` (whether MS-IPFF2 defines it). Each one later gets a coverage state in spec 05, so nothing the parser could not read disappears between the template and Jira.
2. WHEN a field label is not explicit, THE SYSTEM SHALL guess it from the views, in this order:
   1. the control's non-empty ScreenTip (`title`);
   2. text before the control in the same cell;
   3. the left cell;
   4. a checkbox's own text;
   5. the column header of a repeating table;
   6. the schema's SharePoint `ma:displayName`;
   7. the same rules in the other views;
   8. the field name in "Title Case".

   It SHALL record which step produced the label. (Changed 2026-11-10. The first wording, "nearest preceding table cell", gives a section heading for most fields in real Microsoft templates. Measured on the private corpus: 169 controls in 19 default views, 86 of them with a ScreenTip.)
3. THE SYSTEM SHALL build a dependency index. For every field, it lists the rules, calculations, validations, views and connections that read or write it.
4. THE SYSTEM SHALL mark a data connection endpoint as `internal` when its host is:
   - a single-label name (e.g. `chiron`);
   - a private IP address;
   - `localhost`;
   - a file path;
   - a name under `.internal`, `.local`, `.localhost` or `.home.arpa`.

   A `dead` result comes only from an explicit check in the viewer (spec 09) and is not stored in FormIR. There are no network calls in core.
5. THE SYSTEM SHALL serialise FormIR to stable JSON: sorted keys and deterministic ids derived from source paths.

## Correctness properties
- **P6:** `parse(serialise(ir))` deep-equals `ir` for every template in `samples/own/` and `samples/public/`, and for any FormIR built by the generator.
- **Dependency index completeness:** every field id referenced in any rule expression appears in that field's dependency list.

## Out of scope
- Editing FormIR by hand in the UI. The mapping UI stores overrides separately.
