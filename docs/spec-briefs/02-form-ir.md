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
   - `dataConnections[]`: id, adapter type, endpoint, isSubmit, `liveness: unknown|dead|internal`;
   - `codeBehind`: present, files, handlers;
   - `signatures`;
   - `promotedFields[]`.
2. WHEN a field label is not explicit, THE SYSTEM SHALL guess it from the text in the nearest preceding table cell of the default view. If no guess is possible, it SHALL use the field name in "Title Case".
3. THE SYSTEM SHALL build a dependency index. For every field, it lists the rules, calculations, validations, views and connections that read or write it.
4. THE SYSTEM SHALL mark a data connection endpoint as `internal` when its host is:
   - a single-label name (e.g. `chiron`);
   - a private IP address;
   - `localhost`;
   - a file path.

   It SHALL mark the endpoint as `dead` only after an explicit check in the UI. There are no network calls in core.
5. THE SYSTEM SHALL serialise FormIR to stable JSON: sorted keys and deterministic ids derived from source paths.

## Correctness properties
- **P6:** `parse(serialise(ir))` deep-equals `ir` for every template in `samples/own/` and `samples/public/`, and for any FormIR built by the generator.
- **Dependency index completeness:** every field id referenced in any rule expression appears in that field's dependency list.

## Out of scope
- Editing FormIR by hand in the UI. The mapping UI stores overrides separately.
