# Sample licences

One rule: a sample goes into `samples/public/` only when its licence clearly allows
redistribution. Anything else stays out of the repository entirely — not in a gitignored folder
that a `git add -f` could leak later, just out.

Checked 2026-11-04, before the repository was created.

| Source | Files | Licence as found | In repo? |
|---|---|---|---|
| This project (`samples/own/`) | 47 | MIT, written from scratch (forms 01–42 in a Windows VM, opened in InfoPath; 43–47 generated 2026-11-10, not opened) | **yes** |
| [`theill/iquomi`](https://github.com/theill/iquomi) | 1 | MIT | **yes**, with its upstream `LICENSE` (copyright notice) and attribution in `samples/public/theill-weight-keeper/` |
| [spjeff.com sample pack](https://www.spjeff.com/2013/06/18/infopath-sample-form-templates/) — Microsoft's bundled InfoPath templates | 15 | none stated | no — used locally to test the parser, never committed |
| [`kawalgrover/MARTA-Projects`](https://github.com/kawalgrover/MARTA-Projects) | 2 | none | no |
| [`Apress/msft-office-programming`](https://github.com/Apress/msft-office-programming), `Apress/pro-sp-solution-dev` | 5 | "freeware", no grant to redistribute | no |
| [`alexander-kastil/sharepoint-2007-dev`](https://github.com/alexander-kastil/sharepoint-2007-dev) | 2 | none | no |
| [`adnanmajeed82/uk_dissertation_all`](https://github.com/adnanmajeed82/uk_dissertation_all) | 3 | none | no |
| [`openmrs/openmrs-module-formentry`](https://github.com/openmrs/openmrs-module-formentry) | 1 | MPL / OpenMRS, no assertion | no — MPL would require a separate notice and source offer |

"None stated" is not permission. GitHub hosting a file is not permission to copy it into another
repository either — a repository without a licence keeps all rights reserved by default.

Notes for later:

- The spjeff pack is Microsoft's own set of tutorial templates. Being Microsoft's does not make
  them MIT; if a demo needs one, run it from a private folder, do not commit it.
- `samples/own/` deliberately contains no real health, HR or customer data. Names, addresses,
  hostnames and employee IDs are invented. Hosts are either under `contoso-fictional.example`
  (`.example` is a reserved TLD) or bare single-label names such as `sql-legacy01` and
  `forms-legacy`, which have no public DNS entry. Neither kind can resolve to a real host on the
  public internet.
