# Spec 15 verification (2026-11-11)

| Criterion | Proof | Result |
|---|---|---|
| R1.1 order | `packages/core/test/dossier/dossier.test.ts` › section order (Markdown headings); `apps/web/e2e/dossier.spec.ts` (screen headings) | pass |
| R1.2 fields | form 04 screen: the fields table; 606 main-source fields over the 48 forms | pass |
| R1.3 logic | `dossier.test.ts` › form 04: the approval rule's sentence, its condition under it, the line-total calculation "in each row" | pass |
| R1.4 connections | same test: Vendors "Cannot work: it needs a database on the old network", BudgetService "calls internal host forms-legacy" | pass |
| R1.5 depends | counted: 78 "feeds" sentences over the 48 forms | pass |
| R1.6 unread | none of the 48 forms has an unknown, an issue or an unresolved reference, so each says "Everything in the template was read." The listing path itself is untested on real data | pass, with that note |
| R2.1 one wording | `apps/web/test/trace-words.test.ts` passes unchanged against the moved module; same FormIR twice gives the same Markdown | pass |
| R2.2 P19 | `dossier.test.ts` › all 48 forms: ids of rules, calculations, validations and connections, sorted, equal FormIR's; no id twice | pass |
| R3.1 screens | `dossier.spec.ts`: from the form (header "Documentation", heading focused, title "Documentation: Purchase Request", Back to the form); from a certificate, Back to it | pass |
| R3.2 print | same file: header, footer and the screen's toolbar hidden in print media; `break-before: page` on sections 2–6 | pass |
| R3.3 downloads | same file: `04-purchase-request-documentation.md`; Triage zip with `index.md` and 48 files; `apps/web/test/session.test.ts` › spec 15 reads the zip back with `readZip` | pass |
| R3.4 escaping | `dossier.test.ts`: a hostile name, label, default, caption and message give no bare markup, no link and one heading; property over 500 ASCII strings, read with CommonMark's escape and code-span rules | pass |

Sentences over the 48 forms: 9 rules, 20 calculations, 44 validations, 5 buttons, 60 "when the
form opens", 8 connections, 78 "feeds", 0 unread. Every action kind in them (assignment 7,
query 1, message 1, view switch 3) has its own wording; no item fell back to "does not describe".

Bundle (gzip): entry 81.1 → 82.4 KB of 100 (the screen and the words module, which the page
already had), Worker 142.7 → 147.0 KB of 160; no new chunk.
