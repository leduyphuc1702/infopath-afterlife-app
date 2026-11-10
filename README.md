# InfoPath Afterlife

InfoPath forms stopped working in SharePoint Online on **July 14, 2026**, when Microsoft retired
InfoPath Forms Services. Teams that had run the same leave request, expense claim or inspection
form for fifteen years were left with `.xsn` files nobody could open, and no record of the rules
inside them.

Afterlife reads a folder of `.xsn` files and answers three questions about each one: what does it
contain, what killed it, and what carries over cleanly into a native Jira Service Management form.
Then it converts the ones that convert.

Built for Jira Cloud with [Forge](https://developer.atlassian.com/platform/forge/), spec-first in
Kiro.

## Status

Early development. Everything marked **verified** below has been run for real — in Microsoft
InfoPath Filler 2013 on Windows 11, or against a live Jira Cloud site. Everything else is in
progress; the specs in `docs/spec-briefs/` say what is meant to exist.

| Area | State |
|---|---|
| Sample set: 47 `.xsn`, 348 records, MIT | **verified** for forms 01–42 — 42 of 42 open in InfoPath Filler 2013, every view captured for the first 8. Forms 43–47 were generated later and never opened in InfoPath |
| JSM Forms API via `requestJira('/forms/...')` | **verified** — read, create and delete templates on a real site |
| `.xsn` parser, viewer, Triage, converter, Forge app | in progress |

## What is in the repository

```
.kiro/steering/     product, tech, structure, domain, licensing, testing, UX rules for Kiro
docs/spec-briefs/   the feature briefs each Kiro spec was generated from
docs/kiro/          hook and MCP descriptions used while building
docs/infopath-ux.md         how InfoPath 2013 actually looks and behaves, with evidence tags
docs/feature-coverage.md    every InfoPath capability and where it lands in Afterlife
docs/corpus-facts.md        what the sample corpus contains, counted from the files themselves
samples/own/        47 MIT form templates, 348 filled records, screenshots
samples/public/     third-party samples that carry a licence permitting redistribution
```

## Samples and licensing

`samples/own/` is ours, MIT, and every person, company, host and file in it is fictional. The
47 templates exist so the parser is tested against real shapes — multi-view forms, repeating
tables, optional sections, filtered dropdowns, calculations, validation rules, a form with 209
fields — instead of one toy example. Forms 43–47 add browser compatibility, an ActiveX control,
digital signatures, code-behind and script; they were generated and never opened in InfoPath.

Third-party samples that do **not** clearly permit redistribution are not in this repository and
never will be. `docs/SAMPLE-LICENSES.md` records what was checked and why each source is in or
out. If you add a sample, add a row there first.

## Running it

Not yet — the app code is being written. The commands will land here as each slice works:
build, test, `forge deploy`, and the local viewer.

### Bundling `@afterlife/core` for a browser or a Web Worker

The view renderer's XSLT engine, `xsltjs`, has `require('fs')` and `require('path')` at module
level. Core never lets it reach them: it always passes its own loaders, which read files from the
`.xsn` package only. A browser or Worker bundle must still resolve the two names. Map them, for
importers inside `xsltjs` only, to `packages/core/src/render/engine/stubs/fs.ts` and `path.ts`,
whose functions all throw. `packages/core/test/helpers/xsltjs-stubs.ts` is the Vite plugin the
tests use; the web viewer and the Forge Custom UI builds use the same mapping.

## Third-party licences

Production dependencies of `@afterlife/core`, all under the MIT licence:

| Package | Version | Licence | Use |
|---|---|---|---|
| `@xmldom/xmldom` | 0.9.12 | MIT | XML parsing, in Node and in Web Workers |
| `xsltjs` | 1.0.0 | MIT | XSLT 1.0 engine for the view renderer |
| `xpath` | 0.0.36 | MIT | XPath 1.0, used by `xsltjs` and by the renderer |

`packages/core/test/render/licences.test.ts` checks this list against the installed packages.

Fonts, shipped unmodified:

| Package | Version | Licence | Use |
|---|---|---|---|
| `@fontsource/carlito` | 5.3.0 | SIL Open Font License 1.1 | Carlito, metric-compatible with Calibri, declared as `@font-face` family `Calibri` by the page that shows a render (core's visual test today; the web viewer in spec 09). Core does not inline it. |

## Licence

MIT, see `LICENSE`. The form templates in `samples/own/` are MIT too. Jira, Jira Service
Management, Confluence and InfoPath are trademarks of their owners; this project is not
affiliated with Atlassian or Microsoft.
