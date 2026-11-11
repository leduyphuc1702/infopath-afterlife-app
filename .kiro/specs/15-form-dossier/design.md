# Spec 15 design

## D1. Core: `packages/core/src/dossier/`

- `words.ts`: the Rule Trace wording moved from `apps/web/src/side/trace-words.ts` (which now
  re-exports it), plus the static sentences: `ruleSentence`, `calcSentence`,
  `validationSentence`, `connectionSentence`, `elementName`. Both use `fieldName` and
  `ACTION_VERBS`, so "Line total in row 1" or "query a data connection" read the same in the
  trace and the dossier (R2.1). Unchanged trace tests prove the move.
- `build.ts`: `buildDossier(ir, { fileName, records })` → `Dossier`, plain data:
  `about`, `fields`, `logic { onOpen, rules, calculations, validations, buttons }`,
  `connections`, `depends`, `unread`. Every item is `{ id?, sentence, expressions[] }`; `id` is
  the FormIR element's id (P19 counts them). Input order is FormIR order; nothing is sorted by
  locale or time, so the output is deterministic.
- `markdown.ts`: `dossierMarkdown(d)` and `mdText`, `mdCode`. Text: every ASCII punctuation
  character is backslash-escaped, line breaks become spaces, and a token that could autolink
  (`scheme://`, `www.`, `@`) becomes a code span. Code spans use a backtick run longer than any
  inside; in table cells `|` is escaped in both (GFM). Expressions are code spans under the
  sentence.
- Connection status: an `adoAdapter` is "cannot work" (spec 12 `internal-sql`); an internal
  endpoint is "cannot work outside the old network" (`internal-service`, with the cause's
  replacement); only package files is "still works"; a public host "may still work; the viewer
  does not call it"; nothing parsed is "not known".
- Buttons have no caption in FormIR; a button is named by its control id and view
  ("button CTRL901 on view Request"). Cheapest to change later: one function.

## D2. Worker

`documentation(templateId)` → `{ dossier, markdown, fileName }`;
`documentationZip(templateIds)` → `.zip` bytes (`index.md` lists each form with its file). The
Worker has FormIR, the record counts and the zip writer, so the entry bundle only gains the
screen.

## D3. Page

- `Screen` gains `'documentation'`; it documents the open template. The reducer opens the
  template (as for `form`) when asked from a certificate. History places and focus (heading
  `afl-doc-h`) as for the other screens.
- `apps/web/src/docs/Documentation.tsx`: sections as `<section>`, fields as a `<table>`, items as
  lists with `<code class="afl-doc-expr">` under each sentence. Back, Print and Download Markdown
  in a toolbar hidden in print. Print CSS: `.afl-header`, footer and toolbar hidden,
  `break-before: page` on sections after the first.
- Form toolbar: "Documentation" button; certificate: "Documentation" next to "Open form";
  Triage export menu: "Download documentation".

## D4. Tests

- `packages/core/test/dossier/dossier.test.ts`: P19 over the 48 forms; order of sections;
  determinism (twice, equal); form 04 sentences; escaping cases and a fast-check property (no
  unescaped punctuation outside code spans); counts of sentence kinds, logged.
- `apps/web/e2e/dossier.spec.ts`: from the form and from the certificate, Back; print media
  hides the chrome; Download Markdown file name and heading; Triage zip holds `index.md` and one
  file per form.
