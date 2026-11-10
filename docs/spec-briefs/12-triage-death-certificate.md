# Spec brief 12: Triage + death certificate + migration plan

## Summary
Mai drops a whole folder of InfoPath templates (and, optionally, their filled .xml records). Within a minute she gets:
- a Triage table: one row per form with its complexity, coverage and record count;
- a death certificate per form: exactly what stops this form from working after the retirement dates, with evidence from the file, and what replaces each part;
- a migration plan in waves, which Quang can print on one page or export as CSV.

The logic lives in `packages/core/src/triage/` with no Forge imports. The web viewer and the Forge Studio (S1 Library + Triage, S2 death-certificate card) both use it. The Rovo actions `plan_migration` and `get_death_certificate` read its output.

## Inputs
- Any number of .xsn files, a .zip of them, or a dropped folder (web viewer).
- Optional .xml records. Each record is matched to its template through the `mso-infoPathSolution` processing instruction (`name` URN, then `href`, then `solutionVersion`).

## Per-form metrics
- Name, URN, InfoPath generation (2003 / 2007 / 2010 / 2013), browser-compatible or client-only.
- Counts: fields, repeating groups, views, rules (actions + calculations + validations), data connections.
- Coverage counts from the converter (spec 05): Native, Emulated, Manual, Unsupported. "Native %" = Native / all classified elements.
- Record count and date range (oldest and newest record), when records were supplied.
- Causes of death (see below) and the suggested wave.

## Causes of death (catalogue)
Each cause is detected only from evidence in the template or its records. Each one carries an id, a date, a source, the evidence path (file + element) and what Afterlife replaces it with.

| Id | Evidence in the file | Date | Replacement shown |
|---|---|---|---|
| `forms-services-spo` | browser-compatible template (`runtimeCompatibility` includes `server`) | 2026-07-14 | JSM portal: native Forms or Classic mode |
| `infopath-client` | any template (the client is the only way to fill it) | 2026-07-14 [VERIFY lifecycle date for InfoPath 2013 client] | Classic mode in any browser |
| `browser-xslt` | records carrying an `xml-stylesheet` processing instruction | Chrome 158, 2026-11-17 | Original view panel / web viewer render |
| `internal-sql` | ADO / database adapter | — (never reachable from the cloud) | Manual: needs a REST source or an Assets lookup |
| `internal-service` | web service or SharePoint `_vti_bin` adapter to a non-public host | — | Manual: rebind or replace with a JSM field |
| `code-behind` | managed code or script files in the manifest | — | Unsupported: listed with the event names it handled |
| `activex` | custom (ActiveX) controls | — | Unsupported: listed |
| `signatures` | signed data blocks | — | Signer names and times shown as text, "not re-verified" |

The source column in the UI links to the vendor's lifecycle or release page. The exact URLs are filled in and checked on day one; none are guessed. A cause that the file cannot prove (for example, a SharePoint Designer workflow attached to the library) is never listed. Instead, the certificate ends with one line: "Workflows attached outside the form cannot be detected from the file. Ask the library owner."

## Acceptance criteria (EARS)
1. WHEN the user supplies N templates, THE SYSTEM SHALL produce one Triage row per template with every metric above. A template that fails to parse SHALL produce an error row (what happened, why, what to do), and the batch SHALL continue.
2. THE SYSTEM SHALL assign waves with these public rules, shown in a tooltip next to the Wave column:
   - Wave 1: no Emulated, no Manual and no Unsupported elements;
   - Wave 2: at least one Emulated element, but no Manual or Unsupported elements;
   - Wave 3: at least one Manual or Unsupported element.

   Within a wave, forms with more records come first; ties are broken by name. Unknown record counts sort last. THE SYSTEM SHALL NOT show any time, effort or man-hour estimate.
3. THE death certificate SHALL list only causes with evidence in the files. Every cause SHALL show its id, date (or "—"), source, evidence path and replacement.
4. WHEN the user clicks "Export plan", THE SYSTEM SHALL offer:
   - CSV: one row per form with all metrics, the wave and the cause ids;
   - a one-page print view (A4 and Letter): totals, forms per wave, the five most common causes, and the wave rules in plain words.
5. THE triage of 40 templates SHALL finish in under 60 s in the browser, in a Web Worker, with per-file progress [measure on real hardware with the "Big Form" sample, then fix the number].
6. THE `packages/core/src/triage/` module SHALL NOT import Forge or DOM-only APIs, so the same code runs in Node, in the Forge resolver and in a Web Worker.
7. IN the web viewer, THE SYSTEM SHALL keep every file in the browser. No template, record or Triage result SHALL be sent over the network.

## Correctness properties (property-based tests)
- P8: the wave is a pure function of the four coverage counts. Adding a Manual or Unsupported element never moves a form to an earlier wave.
- P9: every listed cause has a non-empty evidence path and source, and the evidence path exists in the parsed template.
- P10: Triage output is deterministic. The same files in any order give the same rows in the same order.

## Out of scope
- Effort, cost or time estimates.
- Detecting workflows or permissions that live outside the template.
- Scanning a live SharePoint tenant (the user exports the files first).
