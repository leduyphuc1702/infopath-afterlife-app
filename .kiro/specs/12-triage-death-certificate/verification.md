# Verification: spec 12 Triage and death certificate, phase A

Started at task 9; task 10 completes it. Each row names the passing tests that prove a criterion.

## R8.1: private corpus (the human's run, 2026-11-11)

Run by the human on the private corpus with `AFTERLIFE_PRIVATE_SAMPLES` set; counts only, as
the test prints them (`packages/core/test/triage-private.local.test.ts`). The files never enter
the repo and were not read by the agent.

```
Spec 12 private triage: 29 templates, 63 records
rows 29, error rows 0 (none)
waves: 1 1, 2 10, 3 18
causes: forms-services-spo 12, infopath-client 29, browser-xslt 0, internal-sql 3, internal-service 2, code-behind 3, activex 2, signatures 3
items: native 391, emulated 104, manual 20, unsupported 7
unlisted: connection:useQueryAdapter 3, control:DropDown 2
records matched: 26
```

Settled after this run (design §3): `control:DropDown` is the drop-down list box, Native, matched
without case; `connection:useQueryAdapter` is classed as the adapter it reuses, else Manual by its
own row in `docs/feature-coverage.md` G. Both have synthetic in-repo tests. These counts are from
before that change; the next private run should show `unlisted: none`.
