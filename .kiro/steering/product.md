---
inclusion: always
---

# Product: InfoPath Afterlife (working name; candidate "Afterlife Forms — for InfoPath® forms")

## One-liner
A toolkit for leaving Microsoft InfoPath, with Jira Service Management (JSM) as the place the forms keep living. Find out what you have, understand it, move it, and keep every old record readable.

## Promise
- No form is rebuilt by hand when a machine can convert it.
- No feature is lost without the UI saying so.
- No old record becomes unreadable.
- Uninstalling the app does not break converted forms (they are native JSM Forms).

## Why this exists
- Microsoft removed InfoPath Forms Services from SharePoint Online after 2026-07-14, with no extension. SharePoint 2013 workflows were retired on 2026-04-02. Chrome stable stops supporting XSLT from version 158 (2026-11-17), and XSLT is the technology InfoPath views are drawn with.
- Teams are rebuilding every form by hand in Power Apps, or going back to paper. Years of filled-in XML records can no longer be opened nicely.
- The Atlassian Marketplace has zero apps for InfoPath (search on 2026-11-02).
- Public complaints (Reddit scan, 2026-11-03; 40 InfoPath threads) cluster into twelve systemic pains. The ones this product answers directly:
  - N1: a hard deadline but no automatic migration for complex forms;
  - N2: knowledge leaves with the person who built the form;
  - N3: nobody knows how many forms exist or which are hard;
  - N4: old records are trapped (one thread: 36,000 records);
  - N5: replacements need experts or per-user premium licences;
  - N6: approvals get lost in the move;
  - N7: silent breakage after a rebuild;
  - N8: complex forms outgrow simple form tools;
  - N9: reporting over form data;
  - N11: no machine can open the forms any more.

## Why JSM is the destination (facts checked 2026-11-03)
- "Customers are free and don't require a Service Collection license", and their number is unlimited. Form fillers are customers.
- "Approvers don't need a Jira Service Management license to approve requests – they just have to be customers of the service space." Approval works from the help center, email, Slack or Microsoft Teams.
- Free plan for 3 agents; Standard is $21.50 per agent per month (monthly Service Collection price).
- Typical InfoPath forms (leave, expenses, travel, purchasing, onboarding, incidents) are requests with an approval, which is exactly what JSM models.
- Be honest in copy: when a form only uses SharePoint lists, Power Apps is already in the M365 licence. Our advantage there is time and skills (no rebuild, no consultant), not licence cost.
- Organisations that will never use Atlassian still get value from the free web viewer (Discover, Understand, export records).

## The four steps
1. **Discover:** drop a whole folder of .xsn files. Within minutes: a Triage table (complexity, % that converts automatically, record counts), a death certificate per form, and a migration plan in waves.
2. **Understand:** X-ray, dependency map, data lineage (where each list or lookup gets its data), Rule Trace, and the Rovo agent explaining rules in plain English.
3. **Move:** convert to native JSM Forms with a Coverage Report, reusing existing Jira fields where they match. What cannot convert runs as it is in Classic mode, including repeating tables.
4. **Keep:** old records become issues (or a CSV/XLSX export for any destination). The original rendering is always one click away, with a SHA-256 seal.

## Users (personas)
- **Mai, IT admin migrating off SharePoint.** Has 40–300 .xsn templates and must clear them before a deadline. Primary screens: Triage, death certificate, X-ray (Studio and web viewer).
- **Quang, head of IT who owns the budget.** Needs to know how many forms, which go first, and why. Primary output: the one-page migration plan exported from Triage.
- **Tim, form owner / power user.** Built forms himself and fears losing rules and layout. Primary screens: side-by-side compare, mapping, Rovo agent.
- **Lan, form filler.** Used to tables, "Insert item" links and the Tab key. Primary screen: Classic form on the JSM portal.
- **Hung, approver.** Wants to see the form "like paper" before approving. Primary screens: Original view panel with seal status, JSM approvals.
- **Auditor.** Must open a record from 2014. Primary screens: legacy import, Original view panel, JQL, CSV export.

## What we keep from InfoPath (users loved it)
- Paper-like table layout.
- Rules without code.
- Repeating tables.
- Print views.
- XML data with a schema.
- Power users can build forms without IT.

## What we fix (users hated it)
See the weakness list. In short:
- **Rule Trace:** see which rules fired, in order, and why.
- **Dependency map** and **data lineage.**
- **Dead-connection check:** hard-coded URLs and internal hosts in old forms.
- **Triage and death certificate:** InfoPath never told anyone what they had or what would break.
- Works in every browser, with no IE or ActiveX.
- Rules run client-side, with no postback limits.
- Each record remembers its template version.
- A SHA-256 seal on submitted records.

## Product principles
1. **Never lose a feature silently.** Every InfoPath element ends in exactly one state:
   - Native: a built-in JSM Forms feature.
   - Emulated: our app does it (labelled "App" in the UI and in `docs/feature-coverage.md`).
   - Manual: we report it with guidance.
   - Unsupported: we say so in the UI.
2. **No lock-in.** Prefer native JSM Forms. If the app is uninstalled, converted forms must keep working. Records can always be exported as CSV and as the original XML.
3. **Keep muscle memory, modernise the rest.** The "paper" area keeps InfoPath's look. Everything around it follows the Atlassian Design System.
4. **Speak InfoPath.** Use the words "Repeating table", "Rules", "Views", "Data connection" and "Submit", and show the Atlassian equivalent next to them.
5. **Only claim what the file proves.** Triage counts and death-certificate causes come from evidence in the files, each with a date and a source. No man-hour estimates, no guessed workflows.
6. **Honest about limits.** No offline filler, no running .NET code-behind, no cryptographic re-verification of old signatures, no SharePoint Designer workflow migration.

## Surfaces
- **Standalone web viewer** (public URL; Kiroween 2026, category Resurrection). The front door for everyone, including people who will never use Atlassian:
  - drop a .xsn, .xml files or a whole folder;
  - Triage, death certificates, X-ray, fill with Rule Trace;
  - export all records to CSV/XLSX;
  - runs fully in the browser and sends no data anywhere.
- **Forge app** for Jira + JSM (Codegeist 2026, category Apps for Business Teams):
  - admin Studio (Library + Triage, X-ray, Compare, Mapping, Publish, Legacy import);
  - portal Classic form;
  - Original view panels (issue and portal);
  - Repeating-table custom field;
  - Rovo agent "Form Archaeologist";
  - rovo:mcp server.

## Contest framing (for README, write-ups and video)
- Codegeist theme sentence: "InfoPath forms hold a decade of a business team's context: its rules, its approvals, its records. Afterlife moves that context into Jira Service Management, where people can read it, search it and act on it."
- Kiroween: "a death certificate, then a resurrection." The dead technology is InfoPath plus XSLT in the browser.
- Videos and screenshots: no third-party logos, no screenshots of Microsoft or Reddit pages, royalty-free music only.

## Out of scope (for the hackathons)
- Authoring new forms from scratch (JSM Forms already does this).
- Offline filling.
- Running code-behind.
- SharePoint Designer workflow migration.
- LZX-compressed cabinets.
- Master/Detail editing.
- Horizontal repeating table editing.
- Any Confluence integration (it would block a free Marketplace listing).
