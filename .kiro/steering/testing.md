---
inclusion: fileMatch
fileMatchPattern: ["**/*.test.ts", "**/test/**", "packages/core/**"]
---

# Testing strategy

- **Golden tests** over every file in `samples/public` and `samples/own`:
  - parse, then snapshot the FormIR JSON;
  - render every view, then snapshot the sanitised HTML;
  - convert, then snapshot the Forms JSON and the CoverageReport.
- **Property-based tests** (fast-check). Each property is named in the spec's correctness section:
  - P1: the CAB reader never hangs or throws an untyped error on random or mutated bytes.
  - P2: for every FormIR field, the converter assigns exactly one coverage state and a non-empty reason.
  - P3: in a repeating table, inserting N rows and then removing them returns XML equal to the original (canonicalised).
  - P4: rendering is deterministic; the same XSL and XML give identical HTML.
  - P5: the sanitiser output never contains `<script`, `on*=` attributes, or `javascript:` URLs.
  - P6: a FormIR JSON round-trip (serialise, then parse) is the identity.
  - P7: the rule engine terminates within 16 passes for any generated rule graph, including cycles.
  - P8: the Triage wave is a pure function of the four coverage counts; adding a Manual or Unsupported element never moves a form to an earlier wave.
  - P9: every death-certificate cause has a non-empty evidence path and source, and the path exists in the parsed template.
  - P10: Triage output is deterministic; the same files in any order give the same rows in the same order.
  - P11: CSV export round-trip: parsing the exported CSV gives back every non-repeating field value of every record, and the flattened repeating rows add up to the original row counts.
  - P12: every manifest node is accounted for exactly once: an inserted node that is not modelled gives exactly one unknown entry whose path selects it (spec 01 R20).
  - P13: the dependency index is complete: every field an expression reads is in that field's `readBy`, and no field that only appears inside a string literal is (spec 02 R12).
  - P14: record matching is a function of the processing instruction and the template set; `matchRecord` never throws (spec 09 R11).
  - P15: zip round-trip: reading what the writer wrote gives the same names and bytes; a mutated or truncated archive gives entries or a typed error within 1 s, never a name that is absolute or has a `..` segment (spec 09 R12.14).
  - P16: a session holds each distinct file once: for any list of files with repeats, opened in any order and in any number of batches, every other copy is reported as a duplicate (spec 13 B3).
  - P17: for any sequence of screen changes followed by the same number of Back steps, the app is on the screen it started from; the same number of Forward steps replays the sequence (spec 13 B2).
  - P18: calculation idempotence: for any form and record, recalculating twice with no input change changes no node (spec 04 R11.2).
  - P19: dossier completeness: for every own form, every rule, calculation, validation and data connection in FormIR appears in the form dossier exactly once (spec 15 R2.2).
  - The next free number is P19. A spec that adds a property takes the next free number and adds its line here in the same task.
- **Reference images:** `samples/own/screenshots/` holds 22 screenshots from InfoPath Filler 2013:
  every view of forms 01–08, empty and filled, 100% zoom, cropped to the form canvas (1007x555).
  Forms 09–47 have none. The screenshots show the first record (`<slug>-001.xml`) filled and
  `<slug>-000-empty.xml` empty (capture script `allshots.ps1`). They are the human reference for
  render fidelity.
- **Integration tests** against the Forge dev site are manual but scripted. Record a screen capture for the write-up.
- **Visual tests** (Playwright):
  - compare renders with baseline PNGs of our own render. A baseline is committed only after the
    maintainer approves it side by side with the InfoPath screenshot of the same view and state;
  - fail when the pixel difference is above the agreed threshold.
  - `xsltproc` cannot run InfoPath's extension functions, so it gives structural HTML references
    (functions reported unavailable), not picture references (spec 03, changed 2026-11-10).
- **Private samples:** unlicensed samples never enter the repo (`docs/SAMPLE-LICENSES.md`). Tests
  that use them read the absolute path in the env var `AFTERLIFE_PRIVATE_SAMPLES` and skip when it
  is unset. Run them locally before each release.
- **Coverage fixtures.** `docs/feature-coverage.md` is the checklist. `docs/corpus-facts.md` counts
  71 forms, 29 of which are not in the repo, so CI cannot reproduce its totals. CI checks the
  per-form counts in `samples/own/README.md` instead. A capability with a count above zero only in
  the third-party corpus has no in-repo fixture and is "untested" until one is added to
  `samples/own/`.
- **Waves:** expected waves are the Triage's output under spec brief 12; there is no fixed wave
  column to assert against.
