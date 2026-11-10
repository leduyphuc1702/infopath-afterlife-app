---
inclusion: always
---

# Samples and licensing

- Repo licence: **MIT**. It must be visible in the GitHub About section.
- `samples/public/` may contain only:
  - Microsoft sample templates (Asset Tracking, Expense Report, Meeting Agenda, Status Report, Travel Request; 2007/2010/2013 versions), originally shared at spjeff.com;
  - theill/weight-keeper (MIT).

  Keep `samples/LICENSES.md` updated with the source and licence of every file.
- `samples/own/` holds the sample set we built ourselves in InfoPath 2013 (created 2026-11-03 → 11-07, before the app repo existed; declare this as test data, not app code). MIT. Eight forms: Leave Request (+ v2), Expense Report, Travel Request, Purchase Request, New Hire Onboarding, Safety Incident, Big Form. Each has the .xsn, filled .xml records and screenshots of every view. All names, hosts (`sql-legacy01`, `forms-legacy`) and people in it are fictional. This set may be published as an open test dataset.
- `samples/private/` holds unlicensed real-world samples (MARTA, Apress, openmrs, kastil, adnan). It is listed in `.gitignore` and `.kiroignore`. These files must never be committed, shown in videos or screenshots, or quoted in docs.
- Dependencies:
  - `xslt-processor` (LGPL-3.0) is used unmodified as an npm dependency. Note this in README "Third-party licences".
  - Do not add GPL or proprietary dependencies.
- Do not copy Microsoft InfoPath UI assets (icons, images). Recreate the look with CSS and Atlaskit icons.
- "InfoPath" is a Microsoft trademark. Use it descriptively ("for InfoPath forms") and add a non-affiliation note in the README and the Marketplace listing.
