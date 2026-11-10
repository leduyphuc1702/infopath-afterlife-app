---
inclusion: always
---

# Samples and licensing

`docs/SAMPLE-LICENSES.md` decides what may enter the repo. A sample is committed only when its
licence clearly allows redistribution; "no licence stated" means no. Before adding a sample, add
its row there. The agent cannot write under `samples/`; ask the human to change files there.

- Repo licence: **MIT**. It must be visible in the GitHub About section.
- `samples/own/`: our own sample set, MIT (`samples/own/LICENSE`). Written from scratch for this
  project in a Windows VM on 2026-11-03 and 2026-11-04; declare it as test data, not app code.
  - 47 templates: `xsn/<slug>.xsn`, the same files unpacked in `forms/<slug>/`.
  - 348 filled records, plus one `<slug>-000-empty.xml` per template, in `records/<slug>/`.
  - 22 screenshots in `screenshots/`: every view of forms 01–08, empty and filled, taken in
    InfoPath Filler 2013 and cropped to the form canvas (1007x555). No Microsoft UI is left in
    them. Forms 09–47 have none.
  - Forms 01–42 opened in InfoPath Filler 2013 on 2026-11-04. Forms 43–47 were generated on
    2026-11-10, after the InfoPath trial had expired, and were never opened in InfoPath; use them
    as parser and converter input, not as proof of what InfoPath accepts. Per-form counts are in
    `samples/own/README.md`.
  - Everything is fictional: people, companies, hosts (`sql-legacy01`, `forms-legacy`,
    `contoso-fictional.example`) and files. The set may be published as an open test dataset.
- `samples/public/`: third-party samples whose licence permits redistribution. Today that is one
  file, `theill-weight-keeper/theill__weight-keeper.xsn` from `theill/iquomi` (MIT), with
  attribution in its README.
- Never in the repo: the spjeff.com pack of Microsoft's bundled templates (no licence stated),
  MARTA, Apress, kastil, adnan and openmrs. They live outside the working tree, at the absolute
  path in the env var `AFTERLIFE_PRIVATE_SAMPLES`. `samples/private/` stays in `.gitignore` and
  `.kiroignore` only as a guard; do not store files there. Never show these files in videos or
  screenshots, and never quote them in docs.
- Dependencies:
  - `xslt-processor` (LGPL-3.0) is used unmodified as an npm dependency. Note this in README "Third-party licences".
  - Do not add GPL or proprietary dependencies.
- Do not copy Microsoft InfoPath UI assets (icons, images). Recreate the look with CSS and Atlaskit icons.
- "InfoPath" is a Microsoft trademark. Use it descriptively ("for InfoPath forms") and add a non-affiliation note in the README and the Marketplace listing.
