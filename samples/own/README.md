# Own InfoPath sample set

Forty-seven form templates written from scratch for InfoPath Afterlife, with 348 records
and screenshots for the first eight. Everything here is MIT licensed and every person,
company, host and file in the data is fictional.

They were built to exercise the parts of the InfoPath file format that real legacy forms
use, so the parser, converter and viewer have realistic input instead of a single toy form.
Forms 01–42 are also the in-repo part of the 71-form corpus counted in
`docs/corpus-facts.md`; the script that counts it lives in a research workspace outside this
repo. Forms 43–47 came later and are not in those counts.

## What was verified

The `.xsn` files were opened in real Microsoft InfoPath Filler 2013 (`15.0.0`) on
Windows 11 ARM, not just parsed in a script:

- each template opens without a design-time error;
- one record per template opens and renders;
- every view of forms 1–8 was switched to and captured, empty and filled;
- the screenshots in `screenshots/` come from that run, at 100% zoom, on a 1024x768 guest.
  They are cropped to the form canvas (1007x555): the InfoPath ribbon, title bar, status bar
  and scroll bar are Microsoft's UI, so they are cut off and are not part of this MIT set.

Final run, 2026-11-04: **42 of 42 templates opened** with their first record, one process at a
time, form cache cleared before each (`verify42.ps1`). Two of them failed the run before that
(`06-safety-incident`, `40-supplier-scorecard`) and were fixed in the generator, then re-run.

Not verified: printing, submitting by e-mail, the SQL and web-service data connections
(their hosts are deliberately fake), and signature workflows.

**Changed after that run, 2026-11-11: the `grouping:1;` item was removed from 13 templates**
(01, 04, 07, 10, 13, 14, 17, 18, 24, 29, 35, 40, 41), in `xd:datafmt` and in the `formatString`
calls of their views. It was a mistake in the generator: it was meant as "use a digit
separator", but `grouping` is a group size, so InfoPath showed 43 as `4,3`. A number format
without `grouping` is what the real-world templates we looked at carry. Nothing else in those
views changed, and each `.xsn` was repacked by script so that it still equals its `forms/`
folder byte for byte (`bsdtar` and `7zz` both read them). These 13 repacked packages were not
opened in InfoPath again; the trial had ended. `08-big-form` keeps `grouping:1` on purpose: its
filled screenshot is the evidence for how InfoPath reads the item. The screenshots of 01, 04
and 07 still match, because the numbers in them have one digit before the decimal point.

**Forms 43–47 were never opened in InfoPath.** They were generated on 2026-11-10, after the
InfoPath trial in the VM had expired (2026-11-07), to cover file-format features that forms
01–42 do not have. Each one is a generated base form with one feature patched in, written to
match the markup that real third-party InfoPath templates use for that feature and the element
definitions in Microsoft's [MS-IPFF2] specification. They pass the same checks as forms 01–42
(schema validation of every record, `upgrade.xsl` round trip, `bsdtar` extraction equal to
`forms/<slug>/`), but nothing guarantees InfoPath would open them. Use them as parser and
converter input, not as proof of what InfoPath accepts.

| Form | Feature it adds |
|---|---|
| `43-browser-leave-request` | browser-compatible template: `xsf2:solutionDefinition runtimeCompatibility="client server"`, a SharePoint `publishUrl` |
| `44-contract-approval-task` | an ActiveX Contact Selector (`object class="xdActiveX"`) bound to a repeating `approvers/Person` group, and a `submitToHostAdapter` submit |
| `45-policy-acknowledgement` | digital signatures: `xsf:documentSignatures` with a countersigned `signedDataBlock`, and `xsd:any` signature containers in the XML-DSig namespace |
| `46-vendor-onboarding-code` | code-behind: `xsf2:managedCode` (C#, no assembly in the package, as in real templates saved without a build) and a `davAdapter` submit with an expression file name |
| `47-asset-checkout-script` | JScript: `xsf:scripts`, `script.js`, `domEventHandler` entries with `handlerObject`; named `simpleType`/`complexType` with `pattern`, `enumeration` and `maxLength` facets |

In form 44 the repeating `approvers` group is edited through the ActiveX control, so the view
has no `xsf:editWith` for it. For forms 01–42 and 45–47 the Repeating/optional count equals the
number of `editWith` elements with `component="xCollection"` or `"xOptional"`; for 44 it does not.

[MS-IPFF2]: https://learn.microsoft.com/en-us/openspecs/sharepoint_protocols/ms-ipff2/

In `01-leave-request-Request-empty.png` the left 247 px are painted white. InfoPath showed its
**Document Recovery** pane there because the VM was force-stopped between capture runs. The
pane is not part of the form, and the form itself sits to its right at the same position as in
the filled screenshot. The other screenshots are unaffected.

## Forms

Forty-seven templates, 348 records in total, all MIT. The first eight are the
ones with screenshots and the ones the demo walks through; the rest widen the
corpus so the parser is tested against more shapes than one team would write by
hand (timesheets, NCRs, risk assessments, budget transfers, GDPR requests and so
on).

Forms 01–42 were opened in InfoPath Filler 2013 on Windows 11 ARM as part of
building this set; forms 43–47 were not (see above). There is no wave column: the app's Triage assigns waves from
the converter's coverage counts (spec brief 12), so the expected waves are its output,
not an input fixed here.

| # | Folder | Views | Fields | Records | Rules | Calcs | Checks | Repeating/optional |
|---|---|---|---|---|---|---|---|---|
| 1 | `01-leave-request` | 1 | 11 | 30 | 1 | 0 | 6 | 0 |
| 2 | `02-expense-report` | 1 | 16 | 30 | 0 | 1 | 3 | 1 |
| 3 | `03-travel-request` | 2 | 22 | 30 | 1 | 0 | 4 | 0 |
| 4 | `04-purchase-request` | 1 | 20 | 20 | 3 | 4 | 3 | 1 |
| 5 | `05-new-hire-onboarding` | 3 | 25 | 20 | 3 | 0 | 2 | 1 |
| 6 | `06-safety-incident` | 1 | 20 | 10 | 0 | 0 | 3 | 2 |
| 7 | `07-leave-request-v2` | 1 | 12 | 10 | 1 | 0 | 6 | 0 |
| 8 | `08-big-form` | 1 | 209 | 3 | 0 | 0 | 0 | 0 |
| 9 | `09-it-access-request` | 1 | 15 | 5 | 0 | 0 | 2 | 0 |
| 10 | `10-timesheet` | 1 | 13 | 5 | 0 | 1 | 2 | 1 |
| 11 | `11-overtime-request` | 1 | 14 | 5 | 0 | 0 | 0 | 0 |
| 12 | `12-vendor-onboarding` | 1 | 13 | 5 | 0 | 0 | 0 | 0 |
| 13 | `13-contract-renewal` | 1 | 10 | 5 | 0 | 0 | 0 | 0 |
| 14 | `14-change-request` | 1 | 13 | 5 | 0 | 0 | 1 | 1 |
| 15 | `15-problem-report` | 1 | 11 | 5 | 0 | 0 | 0 | 1 |
| 16 | `16-equipment-loan` | 1 | 7 | 5 | 0 | 0 | 1 | 0 |
| 17 | `17-vehicle-log` | 1 | 8 | 5 | 0 | 1 | 1 | 0 |
| 18 | `18-mileage-claim` | 1 | 11 | 5 | 0 | 2 | 0 | 1 |
| 19 | `19-training-request` | 1 | 14 | 5 | 0 | 0 | 0 | 0 |
| 20 | `20-course-evaluation` | 1 | 6 | 5 | 0 | 0 | 0 | 0 |
| 21 | `21-customer-complaint` | 1 | 8 | 5 | 0 | 0 | 0 | 0 |
| 22 | `22-quality-inspection` | 1 | 10 | 5 | 0 | 0 | 0 | 1 |
| 23 | `23-non-conformance` | 1 | 11 | 5 | 0 | 0 | 0 | 1 |
| 24 | `24-risk-assessment` | 1 | 10 | 5 | 0 | 1 | 1 | 1 |
| 25 | `25-audit-finding` | 1 | 8 | 5 | 0 | 0 | 0 | 0 |
| 26 | `26-meeting-minutes` | 1 | 15 | 5 | 0 | 0 | 0 | 2 |
| 27 | `27-project-charter` | 1 | 12 | 5 | 0 | 0 | 0 | 0 |
| 28 | `28-budget-transfer` | 1 | 7 | 5 | 0 | 0 | 1 | 0 |
| 29 | `29-invoice-approval` | 1 | 13 | 5 | 0 | 3 | 0 | 1 |
| 30 | `30-petty-cash` | 1 | 11 | 5 | 0 | 1 | 0 | 1 |
| 31 | `31-travel-perdiem` | 1 | 10 | 5 | 0 | 2 | 0 | 1 |
| 32 | `32-visitor-registration` | 1 | 8 | 5 | 0 | 0 | 0 | 0 |
| 33 | `33-badge-request` | 1 | 12 | 5 | 0 | 0 | 0 | 0 |
| 34 | `34-facilities-work-order` | 1 | 8 | 5 | 0 | 0 | 0 | 0 |
| 35 | `35-stationery-order` | 1 | 10 | 5 | 0 | 2 | 0 | 1 |
| 36 | `36-conference-registration` | 1 | 13 | 5 | 0 | 0 | 0 | 0 |
| 37 | `37-certification-renewal` | 1 | 7 | 5 | 0 | 0 | 0 | 0 |
| 38 | `38-asset-disposal` | 1 | 8 | 5 | 0 | 0 | 0 | 0 |
| 39 | `39-data-subject-request` | 1 | 8 | 5 | 0 | 0 | 0 | 0 |
| 40 | `40-supplier-scorecard` | 1 | 10 | 5 | 0 | 1 | 1 | 1 |
| 41 | `41-timesheet-approval` | 2 | 7 | 5 | 0 | 0 | 1 | 0 |
| 42 | `42-incident-rca` | 2 | 6 | 5 | 0 | 0 | 0 | 0 |
| 43 | `43-browser-leave-request` | 1 | 8 | 5 | 0 | 0 | 3 | 0 |
| 44 | `44-contract-approval-task` | 1 | 11 | 5 | 0 | 0 | 0 | 1 |
| 45 | `45-policy-acknowledgement` | 1 | 9 | 5 | 0 | 0 | 1 | 0 |
| 46 | `46-vendor-onboarding-code` | 1 | 6 | 5 | 0 | 0 | 1 | 0 |
| 47 | `47-asset-checkout-script` | 1 | 8 | 5 | 0 | 0 | 1 | 0 |

## Layout

```
forms/<slug>/        the unpacked template: manifest.xsf, myschema.xsd, template.xml,
                     sampledata.xml, upgrade.xsl, viewN.xsl, plus secondary data files
xsn/<slug>.xsn       the same template packed as a CAB, as InfoPath saves it
records/<slug>/      one record per row above, plus <slug>-000-empty.xml
screenshots/         <slug>-<view>-{empty,filled}.png
```

`manifest.xsf` inside a `.xsn` is the entry point. To edit a template, open the `.xsn`
in InfoPath Designer; to read it offline, the files in `forms/` are the same bytes.

## Opening a record

Pass the record straight to InfoPath. Each record carries an `mso-infoPathSolution`
processing instruction that names the template and points at
`file:///C:/forms/<slug>.xsn`, so put the `.xsn` files in `C:\forms\` (or edit the `href`
in the record) before opening.

Form 7 shares form 1's solution name, so a machine that has already cached version
`1.0.0.1` will refuse the version `1.0.0.2` records with "the form is a newer version than
the current form template". Clear the template cache
(`%LOCALAPPDATA%\Microsoft\InfoPath\FormCache4`) or open form 7 on a clean profile. That
is also the state you want when testing `upgrade.xsl`: with version 2 cached, opening a
version 1 record runs the transform and the new field appears.

## Where the data came from

`records/` was generated deterministically (seed = folder name) from a small Python model
of each form, then validated against the template schema and against the `upgrade.xsl`
transform. Names come from a fixed fictional pool, addresses use
`contoso-fictional.example`, attachments are tiny text receipts and photos are 8x6 PNGs.
No real person or organisation appears anywhere.

The generator lives outside this folder, in the project's VM tooling; these files are the
output, checked in so the sample set does not depend on it.
