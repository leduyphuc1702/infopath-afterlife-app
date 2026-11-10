---
inclusion: always
---

# Tech stack and constraints

## Languages and tools
- TypeScript, `strict: true`, ES modules.
- **Node 22 LTS.** Forge CLI requires Node 22 or 24.
- pnpm workspaces.
- **vitest** for tests; **fast-check** for property-based tests; **Playwright** for browser and visual tests.
- Lint and format with the project defaults (eslint + prettier, or oxlint/oxfmt). Pick one on day 1 and do not mix.

## Key libraries
- **XSLT 1.0:** `xslt-processor` (pure JS, LGPL-3.0; used unmodified as an npm dependency, which is fine with an MIT repo). It rendered all 5 views of Microsoft's 2013 sample templates in 12–23 ms in Node (measured locally; those templates are not in the repo).
  - Do NOT use the browser's native XSLTProcessor (Chrome is removing it).
  - Do NOT use `saxon-js` (proprietary licence).
- **Deflate:** use built-in `zlib.inflateRawSync` in Node and `DecompressionStream('deflate-raw')` in the browser. Do not add a CAB library. MSZIP history crosses CFDATA blocks and `DecompressionStream` has no dictionary option, so core puts the previous output (≤ 32 KB) in front of each block as a stored deflate block and drops it from the result; proved on all 43 in-repo cabinets in Node, `worker_threads` and a Chrome 157 Worker (2026-11-10).
- **XML parsing:** `@xmldom/xmldom` (MIT, no dependencies) in Node and in the browser, behind one abstraction in core (`packages/core/src/xml/`). Do NOT use the browser's `DOMParser`: it does not exist in Web Workers, where the parser runs. Checked 2026-11-10 with 0.9.12: it never fetches a DTD or external entity, and never expands entities (unknown references stay as text and raise an error); it gives line and column on every node and in every error. It has no depth limit, so core checks depth before parsing. `xslt-processor` keeps its own parser for XSLT (spec 03).
- **HTML sanitising:** DOMPurify.
- **UI:**
  - React 18;
  - `@atlaskit/*` components and `@atlaskit/tokens` in Custom UI;
  - `@forge/react` (UI Kit) where a module only supports UI Kit, e.g. custom field view.
- **Forge:** `@forge/api` 8.x, `@forge/bridge` 7.x, `@forge/react` 12.x, `@forge/sql` 4.x, `@forge/kvs` 2.x, `@forge/events` for async queues.

## Hard platform limits (verified 2026-11-02)
- **Forge functions:**
  - Timeouts: 25 s sync; 55 s for web triggers and actions; up to 900 s for async events and scheduled triggers (set `timeoutSeconds`).
  - Memory: 512 MB by default, 1024 MB maximum.
  - Payload: 5 MB invocation payload.
  - Front-end bridge: 500 KB per request, 5 MB per response.
  - Rate limits: 1,200 invocations/min per user; 7,000/min or 300/s per install.
- **Forge SQL:**
  - 1 GiB per production install (256 MiB staging, 128 MiB dev); 6 MiB per row.
  - 1 MiB per request; 4 MiB per response.
  - Timeouts: SELECT 5 s; DML 10 s; DDL 20 s.
  - Throughput: 150 DML/s; DDL 25/min.
  - No foreign keys; one statement per query.
  - **Adding SQL to an existing app forces a major version, so add it in the first deploy.**
- **Issue entity property:** max 32,768 bytes. Index it for JQL with the `jira:entityProperty` module (types number, text, string, date).
- **rovo:mcp (Preview):** one module per app, ≤ 50 actions, action name ≤ 30 characters. A site admin must enable external exposure.

## JSM Forms API facts
Probed 2026-11-04 on a real Jira Cloud site; details in `docs/spec-briefs/05-jsm-converter.md`.
Reference: Atlassian's ProForma Forms REST API reference (0.0.0-alpha), 27 endpoints. It is
Atlassian's material and is not in this repo.

- **Verified with `api.asApp().requestJira('/forms/...')`:** 200 for read, create and delete of a
  form template. `asUser()` was never tried; it is a day-1 check.
- `requestAtlassian` against the same API returned 400 `INVALID_TARGET_URL`. Do not use it.
- Base URLs: `https://api.atlassian.com/ex/jira/{cloudId}/forms` and
  `https://api.atlassian.com/jira/forms/cloud/{cloudId}`.
- Endpoints and scopes:
  - list project templates: `GET /forms/project/{projectIdOrKey}/form` (`read:jira-work`);
  - create a template: `POST /forms/project/{projectIdOrKey}/form` (`manage:jira-project`);
  - request type form: `GET /forms/servicedesk/{serviceDeskId}/requesttype/{requestTypeId}/form` (`read:servicedesk-request`);
  - attach, submit, export: `/forms/issue/{key}/form`, `/forms/request/{key}/form/{formId}/action/submit`, `.../format/answers|pdf|xlsx`.
- Create body: `FormTemplateRequest { design, publish }`. `design` needs `questions`, `sections`,
  `conditions`, `layout` and `settings`. `settings` needs `name` and `submit`; `submit` needs both
  `lock` and `pdf`.
- Observed shapes: `questions` is a map keyed by numeric strings; each question is
  `{label, type, choices[], description, questionKey, validation}`; `choices` is
  `[{id, label, other}]`; `validation` is e.g. `{rq: true}`.
- Question types:
  - at = attachment
  - cc = cascading dropdown
  - cd = dropdown
  - cl = multiselect dropdown
  - cm = checkboxes
  - cs = radio
  - ob = Assets object
  - da = date
  - dt = date-time
  - no = number
  - rt = paragraph (ADF)
  - te = email
  - tl = long text
  - pg = legacy paragraph
  - ts = short text
  - tu = URL
  - ti = time
  - um = multi user
  - us = single user
- Validation fields: `rq`, `rgx {p, m}`, `mnc/mxc` (chars), `mnw/mxw` (words), `mnn/mxn` (number), `mnd/mxd` (date), `mns/mxs` (selections), `mnt/mxt` (time).
- Show/hide conditions use `sh`/`hide`. Section conditions can only depend on choice questions.
- **There is no repeating table type.** We fill that gap with a Forge custom field.
- Publish through the create body:
  - `publish.portal.portalRequestTypeIds` (`FormPublishingPortal`): request types on the portal;
  - `publish.jira.issueCreateRequestTypeIds` (`FormPublishingJira`): JSM request types in the
    create dialog. The converter uses this one for JSM service projects;
  - `publish.jira.issueCreateIssueTypeIds` (`FormPublishingJira`): Jira issue types, for plain
    Jira projects.

  Only a read-back of an existing template
  was seen (`portalRequestTypeIds: [129]`). Creating a template with `publish` set is untested; it
  is a day-1 check.

## Security rules
- Sanitise every HTML string produced from XSL before inserting it into the DOM. Never execute script from a form.
- Request the minimum Forge scopes, and document each scope in the README.
- Never store secrets in code. Use Forge environment variables.
- Treat uploaded .xsn and .xml files as hostile input:
  - limits on file size, entry count, decompressed size (zip-bomb guard), and XML depth;
  - no external entity resolution (XXE).

## Performance budgets
- Parse one .xsn in under 300 ms (p95, Node).
- Render one view in under 100 ms (p95, browser).
- Run the rule and calculation pass after one edit in under 30 ms for forms with fewer than 200 fields.
