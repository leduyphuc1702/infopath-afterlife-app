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
