# Spec brief 01: .xsn parser (CAB + manifest + schema)

## Summary
Read an InfoPath template (.xsn) entirely in TypeScript, in both Node and the browser. Return its files, a parsed manifest model and a field tree, with no native tools.

## User stories
- As Mai (IT admin), I want to drop any .xsn and see its contents, so I can judge what it contains without Windows or InfoPath.
- As a developer, I want typed errors for broken or unsupported files, so the UI can explain problems clearly.

## Acceptance criteria (EARS)
1. WHEN given a .xsn that uses MSZIP compression, THE SYSTEM SHALL return every contained file with bytes identical to `bsdtar -xf` output, for every `.xsn` in `samples/own/xsn/` and `samples/public/`.
2. IF the cabinet uses LZX or Quantum compression, THEN THE SYSTEM SHALL fail with `UNSUPPORTED_COMPRESSION` naming the method.
3. IF the input is not a cabinet, or is truncated, THEN THE SYSTEM SHALL fail with `CORRUPT_CAB` and the byte offset.
4. IF the decompressed total exceeds 50 MiB, or the entry count exceeds 2,000, THEN THE SYSTEM SHALL stop with `LIMIT_EXCEEDED` (zip-bomb guard).
5. WHEN parsing `manifest.xsf`, THE SYSTEM SHALL extract:
   - views and their XSL files;
   - rule sets, rules and actions (assignment, dialog, switchView, query, submit, openNew, close);
   - domEventHandlers;
   - calculatedFields;
   - errorConditions;
   - dataObjects and their adapter types and URLs;
   - submit configuration, listProperties and fragmentToInsert;
   - signedDataBlocks;
   - `publishUrl`, `solutionVersion`, `productVersion` and `trustLevel`;
   - code-behind file names.
6. WHEN parsing the schemas, THE SYSTEM SHALL build a field tree with:
   - name and namespace;
   - XSD type;
   - `minOccurs`, `maxOccurs` and `nillable` exactly as written (raw), plus their effective values;
   - required: effective minOccurs ≥ 1, not nillable, **and** the empty string is not a valid value of the type. (Changed 2026-11-10: "minOccurs ≥ 1 and not nillable" alone marked every `xsd:string` field required; form 01 `reason` is a non-nillable string, empty in `template.xml`, and opens in InfoPath. See spec 01 R14.4.);
   - repeating (maxOccurs > 1 or unbounded) and optional (minOccurs = 0);
   - group or field kind.

   It SHALL resolve `include`, `import`, `ref` and named complex types across the schema files in the package.
7. THE SYSTEM SHALL disable external entity resolution and DTD loading for every XML document it parses.
8. THE SYSTEM SHALL parse each `.xsn` in `samples/own/` and `samples/public/` in under 300 ms (p95) on Node 22.

## Correctness properties
- **P1:** for any random or mutated byte array of up to 2 MiB, the parser returns a result or a typed `AfterlifeError` within 1 s. It never hangs and never throws an untyped exception.

## Out of scope
- Writing or repacking .xsn files.
- LZX decompression.

## Notes
- MSZIP: each CFDATA block starts with the bytes `CK`. Deflate history continues across blocks in the same CFFOLDER.
- Reference numbers: the per-form counts in `samples/own/README.md`. The 29 third-party samples summarised in the infopath-domain steering are not in the repo; tests over them read `AFTERLIFE_PRIVATE_SAMPLES` and skip when it is unset.
