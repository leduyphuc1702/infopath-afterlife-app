# Spec 15: the form dossier

The knowledge is inside the form, and the person who built it has left (pain N2). X-ray answers
one field at a time, on screen. The dossier is the whole answer as a document: the manual nobody
wrote, to print, attach to a ticket or paste into a wiki. No brief; the scope is the turn 63
prompt. Everything comes from FormIR (spec 02) and spec 12's causes; no AI, no network.

## Requirements

### R1. Content

Traces: Added: turn 63 prompt.

- **R1.1** THE dossier SHALL hold, in this order: what the form is (name, version, views,
  counts, records loaded); the fields; the logic; the data connections; what depends on what;
  what could not be read.
- **R1.2** THE fields section SHALL be a table of the main data source's fields: label, path,
  type, required, default, and the views that show each one.
- **R1.3** THE logic section SHALL describe, in sentences, every rule (its triggers, condition
  and actions), calculation, validation (with its message), button (the rules it runs), and what
  runs when the form opens; each sentence SHALL have its expressions under it, small.
- **R1.4** THE connections section SHALL say for each connection what it calls, what it feeds,
  and whether it can still work, from spec 12's causes and the endpoint's liveness.
- **R1.5** WHEN a field feeds a calculation, rule, validation or choice list, THE dossier SHALL
  list it with the elements it feeds.
- **R1.6** IF FormIR holds unknown elements, issues or expression parts it could not follow, THE
  dossier SHALL list them; otherwise it SHALL say nothing could not be read.

### R2. One wording

Traces: Added: turn 63 prompt.

- **R2.1** THE sentences SHALL come from core, from the words module the Rule Trace uses
  (`fieldName`, the action verbs), so the same element is named the same way in both; the same
  FormIR SHALL always give the same dossier.
- **R2.2** Property **P19**: for every own form, every rule, calculation, validation and data
  connection in FormIR appears in the dossier exactly once.

### R3. Output

Traces: Added: turn 63 prompt.

- **R3.1** THE form screen and the death certificate SHALL open a "Documentation" screen for the
  form; Back SHALL return to where it was opened from.
- **R3.2** WHEN printed, THE screen SHALL show the dossier only (no app chrome), each section
  after the first starting on a new page.
- **R3.3** "Download Markdown" SHALL save one form's dossier as `<template>-documentation.md`;
  on Triage, "Download documentation" SHALL save a `.zip` with one Markdown file per triaged form
  and an `index.md`, written by core's zip writer.
- **R3.4** Markdown SHALL be escaped: no text from a form (label, caption, message, name,
  expression) SHALL produce markup, HTML or a link.
