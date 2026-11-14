# InfoPath Afterlife

Afterlife opens Microsoft InfoPath forms (`.xsn`) and their filled-in records (`.xml`) in any
browser, now that InfoPath Forms Services is gone from SharePoint Online (July 14, 2026). It is
for the people left holding those files: the IT admin who has to move them, the form owner who
built them, and the auditor who has to read a record from 2014.

The web app in `apps/web` runs fully in the browser and sends no data anywhere. It is hosted at
<https://leduyphuc1702.github.io/infopath-afterlife-app/>, and its product page is at
<https://leduyphuc1702.github.io/infopath-afterlife-app/about/>.

Its first screen is a library. Forms and records added to it are kept in this browser, in
IndexedDB, so they are there on the next visit. Each form is listed with its records and its
last change. From the list a person opens a form, starts a new record, saves a filled-in form
as a record, removes a form or a record, and writes one backup `.zip` that reads back in. The
library is the one thing the browser stores. Nothing is uploaded.

Under the library are seven tasks to start from. Each task's address opens it with a bundled
sample: add the address to the app's URL.

| Task | Address |
|---|---|
| Read an old form and its records the way InfoPath showed them | `#read` |
| See the rules and calculations behind a field | `#rules` |
| Fill in a form and see why each value changed (Rule Trace), then download the XML | `#fill` |
| Find one record among many, and total them | `#find` |
| Keep old records readable without InfoPath: CSV, Excel, and an archive of web pages | `#keep` |
| Print what a form does, for whoever takes it over | `#document` |
| Decide which forms can move first: Triage, death certificates, waves | `#triage` |

Each task is a row with an icon, a few words and one line on what it gives. Explanations sit
behind a help icon and show on hover or focus. What the app is, who it is for and what does not
work are on the product page (`site/`), not in the app.

The converter to native Jira Service Management forms and the Forge app are not part of this
repository.

Built spec-first in Kiro. MIT licence.

## Quality

**Bugfix specs.** 11 of the 22 specs are bugfix specs. Together they hold 101 defect sections.
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
| 23 | 8 | the reviewer's accessibility pass, and its round 2 (B8) |
| 24 | 10 | the reviewer's script over the 47 own templates and axe-core, plus Kiro filling samples through the Playwright MCP server |
| 25 | 5 | [MS-IPFF2] and the reviewer's checks of the built app |
| 26 | 4 | the reviewer's checks, and notes left by earlier specs |
| 27 | 1 | the reviewer's checks of the built app |
| 28 | 3 | the reviewer's checks of the built app, in two rounds |

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

**Suites**: end-to-end 176, measured by Kiro on `94ef2fc` plus the spec 23 B8 change. The
others were measured by Kiro on `cffc527` plus the spec 28 round 2 changes (committed as
`94ef2fc`), and were not run again for B8: Kiro hook tests 6, core 3,854 passed (3 skipped),
browser 337, web 124. Bundle, from that run: page entry 91.4 of 100 KB, Worker 156.1 of 160 KB.

After the reviewer's interface commit (see "What Kiro did not write") the reviewer ran every
suite once more, on that commit: Kiro hook tests 6, core 3,854 passed (3 skipped), browser 337,
web 124, end-to-end 181 (Kiro's 176 and the reviewer's five in `apps/web/e2e/simple.spec.ts`).
Page entry 93.5 of 100 KB, Worker 156.1 of 160 KB. The reviewer's repair commit after it was
run through every suite as well, with the same counts.

After the reviewer's product-page commit (the sixth in "What Kiro did not write") the reviewer
ran every suite again, on that commit: Kiro hook tests 6, core 3,854 passed (3 skipped), browser
337, web 126 (two more, in `apps/web/test/preview.test.ts`), end-to-end 193 (Kiro's 176 and the
reviewer's 17 in `e2e/simple.spec.ts` and `e2e/landing.spec.ts`). No test Kiro wrote was changed.
Page entry 97.8 of 100 KB, Worker 156.1 of 160 KB. The reviewer's seventh commit was run through
every suite as well: the same counts, with one more end-to-end test (194) and a page entry of
97.9 KB.

After the reviewer's library commit (the eighth) the reviewer ran every suite again, on that
commit: Kiro hook tests 6, core 3,854 passed (3 skipped), browser 337, web 141 (15 more, in
`apps/web/test/library.test.ts`), end-to-end 199 (Kiro's 176 and the reviewer's 23 in
`e2e/simple.spec.ts` and `e2e/library.spec.ts`, which takes the place of `e2e/landing.spec.ts`).
Three of Kiro's end-to-end files were changed for it; "What Kiro did not write" says where. Page
entry 97.9 of 100 KB, Worker 157.4 of 160 KB. The ninth commit, the product page, was run
through every suite as well, with the same counts and sizes.

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
| 23 Accessibility bugfixes | bugfix | done | 12 | 6 | 10 |
| 24 Fill every sample bugfixes | bugfix | done | 14 | 10 | 25 |
| 25 Number grouping and leaving | bugfix | done | 5 | 6 | 23 |
| 26 Leftover bugfixes | bugfix | done; task 5 open: F7 (F10 fixed in spec 27) | 4 | 4 | 11 |
| 27 Reopen shows record | bugfix | done | 2 | 1 | 7 |
| 28 Find stored value | bugfix | done | 4 | 2 | 9 |

Specs 05–08, 10 and 11 (converter, Forge app, Rovo agent and others) have briefs in
`docs/spec-briefs/` and no spec yet.

## Running it

Needs Node 22 and pnpm.

```sh
pnpm install
pnpm --filter web dev        # the web viewer, on Vite's dev server
pnpm --filter web build      # a static site in apps/web/dist
pnpm --filter web preview    # serve the build
pnpm build:about             # after a build: the product page (site/) into apps/web/dist/about
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

"The reviewer" in this file is the entrant, working with a second AI coding assistant that is
not Kiro. That assistant wrote the reviewer's commits listed below, drafted the steering drafts,
the spec briefs and the prompts Kiro was given, ran Kiro CLI, and checked Kiro's work on the
built app. Where a commit message says "hand-written", it means written without Kiro.

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

After `abd9299`, Kiro's last commit, nine more commits are the reviewer's. The first puts the
copyright holder's name in `LICENSE`. The second, made without Kiro after the Kiro credits ran
out, makes the first screen and the buttons simpler. None of its changes is Kiro's:

| File | What the reviewer wrote |
|---|---|
| `apps/web/src/shell/Landing.tsx` | Rewritten: one line, a drop zone with one button, task cards. The samples list and the task links' handling are kept from Kiro's version |
| `apps/web/src/shell/Help.tsx` | New: an explanation behind a help icon, shown on hover or focus |
| `apps/web/src/shell/simple.css` | New: the icons (drawn by the reviewer), the help tip, the first screen's layout |
| `apps/web/e2e/simple.spec.ts` | New: five end-to-end tests of the above |
| `Header.tsx`, `PaperToolbar.tsx`, `App.tsx`, `ExportRecords.tsx`, `ArchiveMenu.tsx`, `ExportMenu.tsx`, `Documentation.tsx`, `main.tsx` | An icon on each button (`data-icon`), the words of an icon-only button kept for screen readers, one import |
| `README.md`, `docs/accessibility.md` | The paragraphs that describe this commit |

It departs from spec 21 on purpose in one place. Requirement 7 asks for two lead sentences; the
first screen now has one line, and the rest of what those sentences said is behind its help
icon. The spec's files are left as Kiro wrote them. What each screen does once a file is open
is still Kiro's code.

The third commit repairs a defect of the second. The help tip's class name, `afl-tip`, was
already the name of Kiro's explanation on the Wave column in Triage, so that column's header was
drawn as a dark box. The help tip is now `afl-help-tip`, and the first test of
`e2e/simple.spec.ts` checks the Wave header. No suite and no axe-core run had caught it; the
reviewer saw it on the screen.

The fourth commit changes no code. It takes the line for `.kiro/settings/mcp.json`, a file that
never existed, out of `.gitignore`, so that nothing under `.kiro/` is ignored, and brings
`docs/kiro/mcp.md`, `docs/kiro/README.md` and one line of `.kiro/steering/structure.md` in line
with that. Every suite was run on it too, with the same counts.

The fifth commit changes this file only. It adds the first paragraph of this section, which
says who the reviewer is, and replaces "made by hand" with "made without Kiro".

The sixth commit, made without Kiro, turns the first screen into a product page and gives the
working screens rounder panels and tables. None of its changes is Kiro's:

| File | What the reviewer wrote |
|---|---|
| `apps/web/src/shell/Landing.tsx` | The first view again: a headline, one sentence, two buttons, a picture of the app, task cards with one line each, the samples in a card. The samples list and the task links' handling are still Kiro's |
| `apps/web/src/shell/About.tsx` | New: the bands under it. Without and with the app, three steps, what stays on the computer, four numbers counted from the bundled samples, seven questions, a closing pair of buttons |
| `apps/web/src/shell/saas.css` | New: the look of all of the above, the mark, and rounder controls, panels and tables on the working screens |
| `Header.tsx`, `Notices.tsx`, `App.tsx`, `main.tsx` | The mark and a link home in the header, section links on the first screen, the mark and a source link in the footer, one function that goes home, one import |
| `apps/web/src/triage/TriageTable.tsx` | Eight lines: the three waves as one bar above Kiro's sentence |
| `apps/web/public/favicon.svg`, `public/og.jpg`, `src/shell/shot-light.webp`, `shot-dark.webp`, `index.html` | The mark (drawn by the reviewer), pictures taken of the built app showing the Purchase request sample, and the tags a shared link reads |
| `apps/web/e2e/landing.spec.ts`, `apps/web/test/preview.test.ts` | New: 12 end-to-end tests and two on the built page |
| `README.md`, `docs/accessibility.md` | The paragraphs that describe this commit |

The second commit left the first screen with one line; it now has that line as a headline and a
product page under it. Spec 21's task links, their addresses and where focus goes are as Kiro
built them, and its tests pass unchanged. What each screen does once a file is open is still
Kiro's code; this commit changes how its panels, tables and text boxes are drawn, not what they
do.

The seventh commit, made without Kiro, repairs a choice of the sixth. With the task cards now
below the first view, Back from a task left the page at its top, away from the cards the person
had come from. Back now returns to the cards, as it did in Kiro's version, and the product name
in the header returns to the top. It changes `App.tsx` and adds one test to
`e2e/landing.spec.ts`.

The eighth commit, made without Kiro, gives the app a library. Until then the app read InfoPath
files and forgot them when the tab closed, so it could not take InfoPath's place. None of its
changes is Kiro's:

| File | What the reviewer wrote |
|---|---|
| `apps/web/src/worker/shelf.ts` | New: the store, one IndexedDB database named `afterlife-library` |
| `worker/session.ts`, `protocol.ts`, `worker.ts`, `client.ts` | Added to Kiro's files: a session restores the library, removes a form with its records, saves a filled-in form as a record (new, or over the one it was opened from), and writes and reads one backup `.zip`. A file's id comes from its SHA-256, so a restarted Worker gives the page the ids it already holds |
| `apps/web/src/shell/Library.tsx`, `library.css` | New: the first screen. A table of forms with their records and last change, "New record", Remove, "Back up", "Add files", and a find box from nine forms on. Kiro's task links and samples list moved here from `Landing.tsx` and do what they did |
| `App.tsx`, `store.ts`, `Header.tsx`, `Notices.tsx`, `main.tsx`, `side/Unmatched.tsx`, `shell/Confirm.tsx` | Added to Kiro's files: Save in Fill (Ctrl or Cmd+S), removing a record, the library's state, two sentences that said nothing is saved |
| `shell/Landing.tsx`, `About.tsx`, `shot-light.webp`, `shot-dark.webp`, most of `saas.css`, `e2e/landing.spec.ts` | Removed: the product page of the sixth commit left the app. It is now a page of its own (the ninth commit) |
| `apps/web/test/library.test.ts`, `apps/web/e2e/library.spec.ts` | New: 15 tests of the Worker's library and 18 end-to-end tests |
| `e2e/fill.spec.ts`, `e2e/fill-bugfixes.spec.ts`, `e2e/records.spec.ts` | Kiro's tests, changed in four places. Two sentences the app now words differently. The storage check: it asked for no IndexedDB database, and now asks for exactly one, `afterlife-library`, and no cookie. One step that empties the library before a second timing |

It departs from Kiro's specs on purpose. Spec 04 R8.3 and spec 09 design section 5 say the viewer
stores nothing. The library is now the one thing it stores, in this browser only; the policy
that forbids every network request is unchanged. The spec files are left as Kiro wrote them.

The ninth commit, made without Kiro, adds the product page in `site/`, published beside the app
at `/about/`. Kiro wrote none of it:

| File | What it is |
|---|---|
| `site/index.html` | The page: its words, its layout choices and the pieces of the app's interface it draws are the reviewer's. Every figure on it was counted from the bundled samples |
| `site/assets/` | The taste-skill design kit, version 2.5.1 (MIT, © 2026 Leonxlnx, `site/assets/LICENSE`): its CSS and scripts, unmodified. Only the 28 files the page loads are in this repository |
| `site/fonts/` | Manrope and JetBrains Mono, latin subsets, with their SIL Open Font License texts |
| `site/.taste-skill/plan.md`, `waivers.json` | The page's plan, and the two findings of the kit's checker that were waived instead of fixed, both on the Questions section, with the reason for each |
| `tools/about.mjs`, `.github/workflows/web-pages.yml`, `package.json` | Copies the tracked files of `site/` into `apps/web/dist/about/`; the Pages workflow runs it after the build |
| `apps/web/src/shell/Header.tsx`, `index.html`, `public/og.jpg` | The About link in the app's footer leads to the page; a shared link shows a picture of the page's top and a sentence that names the library |
| `.gitignore`, `.prettierignore`, `eslint.config.js` | `site/` is left out of lint and format checks, and the rest of the kit out of the repository |

The kit's checker passed the page at five screen widths with those two waivers. The page asks
no other site for anything: its fonts, styles and scripts come from its own folder. It was not
checked on a real phone or with a screen reader.

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

The product page (`site/`, served at `/about/`) is a separate static page and shares no code
with the app:

| What | Version | Licence | Use |
|---|---|---|---|
| taste-skill design kit (`site/assets/`) | 2.5.1 | MIT, `site/assets/LICENSE` | the page's layout, type, motion and interface pieces |
| Manrope | latin subset | SIL Open Font License 1.1, `site/fonts/OFL-Manrope.txt` | the page's text |
| JetBrains Mono | latin subset | SIL Open Font License 1.1, `site/fonts/OFL-JetBrainsMono.txt` | file names and figures on the page |

## Licence

MIT, see `LICENSE`. The form templates in `samples/own/` are MIT too. Jira, Jira Service
Management, Confluence and InfoPath are trademarks of their owners; this project is not
affiliated with Atlassian or Microsoft.
