# Spec brief 09: standalone web viewer (public app URL)

## Summary
A static website and the product's front door. Anyone drops a .xsn, a set of .xml records, or a whole folder, and gets four jobs done without installing anything:
- Discover: Triage and death certificates for the whole folder (spec 12);
- Understand: the form rendered, its X-ray, data lineage and coverage;
- Try: a Classic fill with Rule Trace;
- Keep: every record exported to CSV/XLSX.

Everything runs in the browser and no data leaves the machine. It is useful even to organisations that will never use Atlassian. It is also the public "app URL" for Kiroween judges, and the top of the funnel for the Jira app.

## Acceptance criteria (EARS)
1. WHEN a user drops a .xsn, THE SYSTEM SHALL show:
   - the default view rendered;
   - a view selector;
   - the field tree;
   - rules in plain English;
   - data lineage: for each list, lookup and secondary data source, where its data comes from (file, SQL table, service, SharePoint list) and which fields use it;
   - dead and internal connections;
   - the coverage summary;
   - the death certificate card (spec 12).
2. WHEN a user drops a folder or several templates, THE SYSTEM SHALL show the Triage table and the "Export plan" action from spec 12 first, and open a form's detail view on click.
3. WHEN a user also drops .xml records, THE SYSTEM SHALL match each record to its template, list them, render each with its template version, and allow paging through them. Unmatched records SHALL be listed with the reason.
4. WHEN the user clicks "Export records", THE SYSTEM SHALL produce, per template:
   - a CSV and an XLSX file with one row per record (record file name, template version, every non-repeating field as a column);
   - repeating tables flattened into a second sheet (XLSX) or a second CSV, one row per repeating row, carrying the record file name as the key;
   - attachments embedded in records extracted into a folder of the .zip, named `<record>/<field>/<original file name>`, with their paths in the CSV.

   Column headers SHALL be the InfoPath field paths, so the export can be imported anywhere.
5. THE SYSTEM SHALL work with no network after load. CSP `connect-src 'self'` SHALL apply, and there SHALL be no analytics in the MVP.
6. THE SYSTEM SHALL offer "Try a sample" buttons for the bundled public samples (Microsoft templates and our own MIT sample set in `samples/own`).
7. THE SYSTEM SHALL offer a Classic "fill" mode with Rule Trace, using the same runtime as the Forge app. The filled XML SHALL be downloadable.
8. THE SYSTEM SHALL include a call to action, "Bring this form into Jira Service Management", linking to the install or Marketplace page. The call to action SHALL NOT block any free feature.
9. THE SYSTEM SHALL score at least 90 for Lighthouse accessibility and performance on desktop.
10. WHEN 1,000 records of one template are exported, THE export SHALL finish in under 30 s in a Web Worker [measure, then fix the number].

## Hosting
- Static hosting (Cloudflare Pages or GitHub Pages).
- Deployed from `apps/web` by a GitHub Action.
