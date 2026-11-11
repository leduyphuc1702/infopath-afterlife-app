# InfoPath Afterlife

Afterlife opens Microsoft InfoPath forms (`.xsn`) and their filled-in records (`.xml`) in any
browser, now that InfoPath Forms Services is gone from SharePoint Online (July 14, 2026). It is
for the people left holding those files: the IT admin who has to move them, the form owner who
built them, and the auditor who has to read a record from 2014.

The web viewer in `apps/web` runs fully in the browser and sends no data anywhere. Today a
person can do the seven tasks on its landing page. Each task's address opens it with a bundled
sample; once the app is hosted, add the address to its URL.

| Task | Address |
|---|---|
| Read an old form and its records the way InfoPath showed them | `#read` |
| See the rules and calculations behind a field | `#rules` |
| Fill in a form and see why each value changed (Rule Trace), then download the XML | `#fill` |
| Find one record among many, and total them | `#find` |
| Keep old records readable without InfoPath: CSV, Excel, and an archive of web pages | `#keep` |
| Print what a form does, for whoever takes it over | `#document` |
| Decide which forms can move first: Triage, death certificates, waves | `#triage` |

The converter to native Jira Service Management forms and the Forge app are not written yet.

Built spec-first in Kiro. MIT licence.

## Quality

**Bugfix specs.** 11 of the 22 specs are bugfix specs. Together they hold 98 defect sections.
Each spec's `verification.md` gives every defect's test result before and after the fix. Every
defect was run on the unfixed code first, with the gaps the files name: spec 27's F10 had no run
before the fix in its round, and one spec 27 reducer test is a guard that passes on both.

| Spec | Defect sections | Found by |
|---|---|---|
| 13 | 11 | the reviewer, on the built web viewer |
| 14 | 12 | the reviewer, filling in forms |
| 16 | 17 | the reviewer, on the dossier and Fill |
| 19 | 16 | the reviewer, on records and the archive |
| 22 | 14 | the reviewer's "first five minutes" run |
| 23 | 7 | the reviewer's accessibility pass |
| 24 | 10 | the reviewer's script over the 47 own templates and axe-core, plus Kiro filling samples through the Playwright MCP server |
| 25 | 5 | [MS-IPFF2] and the reviewer's checks of the built app |
| 26 | 4 | the reviewer's checks, and notes left by earlier specs |
| 27 | 1 | the reviewer's checks of the built app |
| 28 | 1 | the reviewer's checks of the built app |

**Properties** (fast-check, defined in `.kiro/steering/testing.md` and the specs):

- P1: the CAB reader never hangs or throws an untyped error on random or mutated bytes.
- P2: every FormIR field gets exactly one coverage state and a reason.
- P3: inserting N repeating rows and removing them gives back the original XML.
- P4: rendering is deterministic.
- P5: sanitised output has no `<script`, `on*=` attribute or `javascript:` URL.
- P6: a FormIR JSON round trip is the identity.
- P7: the rule engine stops within 16 passes, cycles included.
- P8: the Triage wave depends only on the four coverage counts, and adding a Manual or Unsupported element never moves a form earlier.
- P9: every death-certificate cause has an evidence path that exists in the template.
- P10: Triage gives the same rows in the same order for the same files in any order.
- P11: a CSV export parsed again gives back every value and every repeating row count.
- P12: every manifest node is accounted for exactly once.
- P13: the dependency index lists every field an expression reads, and none it only quotes.
- P14: record matching depends only on the processing instruction and the templates, and never throws.
- P15: the zip reader reads back what the writer wrote, and never yields an absolute or `..` name.
- P16: a session holds each distinct file once, however often and in whatever batches it is opened.
- P17: n screen changes, then n Back steps, return to the start; n Forward steps replay them.
- P18: recalculating twice with no input change changes nothing.
- P19: every rule, calculation, validation and data connection appears in the form's dossier exactly once.
- P20: the records list shows exactly the records whose shown values, or the stored values of their number and date columns, contain the Find text, in the sorted column's order (spec 28).
- P21: no page of a record archive can run script or load anything from outside the archive.
- P22: the record summary's groups and totals add up to the records it counts (spec 20 R12).
- P23: undo all and redo all give the first and last record, and the downloaded XML reads back the same (spec 24).

**Accessibility:** `docs/accessibility.md`, WCAG 2.2 AA criterion by criterion, with the
reviewer's axe-core 4.14 audit.

**Suites**, measured by Kiro in this turn (spec 28, on `acd2394` plus the uncommitted spec 28
changes): Kiro hook tests 6, core 3,853 passed (3 skipped), browser 337, web 123, end-to-end
174. Bundle, same run: page entry 91.4 of 100 KB, Worker 156.0 of 160 KB.

## Status

One row per folder in `.kiro/specs/`. Criteria are the `SHALL` sentences in `requirements.md`
or `bugfix.md`. Tasks are the checked boxes in `tasks.md`. Tests are the `test(` calls in test
files that cite the spec by number, so a file that serves two specs counts for both.

| Spec | Kind | State | Criteria | Tasks | Tests |
|---|---|---|---|---|---|
| 01 XSN parser | requirements | done | 129 | 34 | 77 |
| 02 FormIR | requirements | done | 63 | 14 | 202 |
| 03 View renderer | requirements | done | 55 | 14 | 228 |
| 04 Classic runtime | requirements | done | 47 | 13 | 95 |
| 09 Web viewer | requirements | done | 56 | 16 | 99 |
| 12 Triage and death certificate | requirements | done | 29 | 10 | 66 |
| 13 Web viewer bugfixes | bugfix | done | 16 | 8 | 58 |
| 14 Fill mode bugfixes | bugfix | done | 16 | 10 | 36 |
| 15 Form dossier | requirements | done | 16 | 5 | 19 |
| 16 Dossier and Fill bugfixes | bugfix | done | 17 | 7 | 34 |
| 17 Records list | requirements | done | 20 | 5 | 8 |
| 18 Record archive | requirements | done | 14 | 4 | 10 |
| 19 Records and archive bugfixes | bugfix | done | 30 | 6 | 72 |
| 20 Record summary | requirements | done | 17 | 5 | 11 |
| 21 Start from a task | requirements | done | 10 | 4 | 5 |
| 22 First five minutes bugfixes | bugfix | done | 10 | 5 | 28 |
| 23 Accessibility bugfixes | bugfix | done | 11 | 6 | 8 |
| 24 Fill every sample bugfixes | bugfix | done | 14 | 10 | 25 |
| 25 Number grouping and leaving | bugfix | done | 5 | 6 | 23 |
| 26 Leftover bugfixes | bugfix | done; task 5 open: F7 (F10 fixed in spec 27) | 4 | 4 | 11 |
| 27 Reopen shows record | bugfix | done | 2 | 1 | 7 |
| 28 Find stored value | bugfix | done | 1 | 1 | 4 |

Specs 05–08, 10 and 11 (converter, Forge app, Rovo agent and others) have briefs in
`docs/spec-briefs/` and no spec yet.

## Running it

Needs Node 22 and pnpm.

```sh
pnpm install
pnpm --filter web dev        # the web viewer, on Vite's dev server
pnpm --filter web build      # a static site in apps/web/dist
pnpm --filter web preview    # serve the build
```

Tests:

```sh
pnpm check     # typecheck, lint, format check, hook tests, core, core in a browser, web
pnpm e2e:web   # Playwright end-to-end tests; the Playwright config builds and serves the site
pnpm test:perf # core's performance budgets
```

### Bundling `@afterlife/core` for a browser or a Web Worker

The view renderer's XSLT engine, `xsltjs`, has `require('fs')` and `require('path')` at module
level. Core never lets it reach them: it always passes its own loaders, which read files from the
`.xsn` package only. A browser or Worker bundle must still resolve the two names. Map them, for
importers inside `xsltjs` only, to `packages/core/src/render/engine/stubs/fs.ts` and `path.ts`,
whose functions all throw. `packages/core/host/vite.ts` is the Vite plugin that does this; core's
tests and the web viewer both use it.

## How this was built with Kiro

**Specs** (`.kiro/specs/`). Eleven specs went requirements first: `requirements.md`, then
`design.md`, then `tasks.md`, each phase approved by the reviewer before the next (01, 02, 03, 04,
09, 12, 15, 17, 18, 20, 21). Eleven are bugfix specs (13, 14, 16, 19, 22–28): `bugfix.md` with
current, expected and unchanged behaviour in EARS, a design with each root cause, and a
`verification.md` with the failing test before the fix and the result after. Specs 01 to 12 started from the briefs in
`docs/spec-briefs/`; the later ones started from the reviewer's prompt of that session, which is
not in this repository. The spec skill that sets the format is
`.kiro/skills/spec/SKILL.md`.

**Steering** (`.kiro/steering/`). Eight files loaded into every session: product, tech,
structure, testing, UX principles, InfoPath domain facts, Forge platform limits, and samples and
licensing.

**Agent file** (`.kiro/agents/afterlife.json`). The agent used for headless runs. Its guard
rails: an allowed-tools list, denied shell commands, and write access kept away from `samples/`.

**Hooks** (`tools/kiro-hooks/`, described in `docs/kiro/hooks.md`). Wired in the agent file:
format each file on write, refuse writes under `samples/`, refuse secrets, and add a journal
line when a session stops. `pnpm test:hooks` tests them.

**MCP** (`docs/kiro/mcp.md`). The Playwright MCP server, used to fill in the samples on the
built app by hand. It caught defects no suite had, and the document says which, call by call.

**Journal** (`.kiro/JOURNAL.md`). Written by the stop hook.

## What Kiro did not write

Commit authors do not separate the two; the commit messages do. At `acd2394` there are 76
commits (`git rev-list --count acd2394`): 67 say "Written by Kiro", one (`cefad29`, steering and
docs aligned with the repo and the Forms API) is Kiro's and says "Made by Kiro CLI", and these
eight are the reviewer's, whole:

| Commit | What |
|---|---|
| `759994c` | The seed: steering drafts, spec briefs, docs, and the MIT sample set |
| `288c7de` | The agent file for headless runs |
| `13b8776` | Samples: the Wave column dropped, the corpus reference fixed |
| `1917d34` | Samples: forms 43–47 added |
| `9f29bdc` | Steering edit: the XSLT engine chosen by spec 03, sanitising without a DOM |
| `08842fd` | Steering edit: `xsltjs` 1.0.0, no licence exception |
| `84c1766` | The Playwright MCP server added to the agent file |
| `64d0d3b` | `grouping:1` removed from 13 own samples |

Inside Kiro's commits, these lines are the reviewer's: the upstream LICENSE file of the Weight
keeper sample (in `4c13ec8`), one `.gitignore` line, and the P12 and P13 lines of
`.kiro/steering/testing.md`.

Everything under `samples/` is the reviewer's, made by a generator outside this repository.
Kiro cannot write there.

## Samples and licensing

`samples/own/` is ours, MIT, and every person, company, host and file in it is fictional: 47
templates and 348 filled records. Forms 01–42 opened in InfoPath Filler 2013. Forms 43–47 were
generated later and never opened in InfoPath, nor were the 13 templates repacked in `64d0d3b`
opened again. `samples/own/README.md` gives the per-form counts.

Third-party samples that do **not** clearly permit redistribution are not in this repository and
never will be. `docs/SAMPLE-LICENSES.md` records what was checked and why each source is in or
out. `samples/public/` holds one: theill's Weight keeper (MIT).

## Third-party licences

Production dependencies of `@afterlife/core`, all under the MIT licence:

| Package | Version | Licence | Use |
|---|---|---|---|
| `@xmldom/xmldom` | 0.9.12 | MIT | XML parsing, in Node and in Web Workers |
| `xsltjs` | 1.0.0 | MIT | XSLT 1.0 engine for the view renderer |
| `xpath` | 0.0.36 | MIT | XPath 1.0, used by `xsltjs` and by the renderer |

`packages/core/test/render/licences.test.ts` checks this list against the installed packages.

Production dependencies of the web viewer (`apps/web`), bundled into its page and its Web
Worker. The built site lists each one with its licence text on `notices.html`, and the build
fails on a licence outside MIT, Apache-2.0, BSD, ISC or OFL-1.1 (`apps/web/plugins/notices.ts`):

| Package | Version | Licence | Use |
|---|---|---|---|
| `react`, `react-dom` | 18.3.1 | MIT | the page's UI |
| `scheduler` | 0.23.2 | MIT | used by `react-dom` |
| `@atlaskit/tokens` | 20.11.0 | Apache-2.0 | Atlassian design tokens: the light, dark and spacing theme CSS |
| `@xmldom/xmldom`, `xsltjs`, `xpath` | as above | MIT | `@afterlife/core`, in the Worker |
| `@fontsource/carlito` | 5.3.0 | SIL Open Font License 1.1 | the paper's Calibri, below |

Fonts, shipped unmodified:

| Package | Version | Licence | Use |
|---|---|---|---|
| `@fontsource/carlito` | 5.3.0 | SIL Open Font License 1.1 | Carlito, metric-compatible with Calibri, declared as `@font-face` family `Calibri` by the page that shows a render, with `ascent-override: 93%; descent-override: 26%` so line heights match InfoPath's GDI layout. Core does not inline it. |

## Licence

MIT, see `LICENSE`. The form templates in `samples/own/` are MIT too. Jira, Jira Service
Management, Confluence and InfoPath are trademarks of their owners; this project is not
affiliated with Atlassian or Microsoft.
