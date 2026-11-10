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
- **Reference images:** `samples/own` includes screenshots of every view taken in real InfoPath 2013 (empty and filled, 100% zoom). Use them to judge render fidelity alongside the `xsltproc` references.
- **Integration tests** against the Forge dev site are manual but scripted. Record a screen capture for the write-up.
- **Visual tests** (Playwright):
  - compare the web viewer render with reference PNGs made by `xsltproc` from the public samples;
  - fail when the pixel difference is above the agreed threshold.
- Private samples: tests auto-skip when `samples/private` is missing. Run them locally before each release.
- **Coverage fixtures.** `docs/feature-coverage.md` is the checklist, `docs/corpus-facts.md` holds
  the counts. Every capability marked with a number must have a fixture under `samples/own/` and
  the app's own counts must match, or the row is downgraded to "untested" until it does.
