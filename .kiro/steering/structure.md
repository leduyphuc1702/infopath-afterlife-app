---
inclusion: always
---

# Repository structure

`packages/` and `apps/` are planned and do not exist yet. Everything else below exists today
unless marked "to be written".

```
/
├─ .kiro/                     steering, specs, agents (committed; only .kiro/settings/mcp.json is gitignored)
├─ packages/core/             pure TypeScript, no Forge/React imports; runs in Node and browser
│  ├─ src/cab/                CAB (MSCF) reader, MSZIP only
│  ├─ src/xsf/                manifest.xsf reader (xsf, xsf2, xsf3 namespaces)
│  ├─ src/xsd/                schema reader → field tree
│  ├─ src/ir/                 FormIR types + builder + JSON (de)serialisation
│  ├─ src/render/             XSLT render + xd* extension-function shims + sanitise
│  ├─ src/xpath-fns/          InfoPath function library (today, now, nz, eval, addDays…)
│  ├─ src/runtime/            Classic runtime: bindings, rules, calcs, validation, repeating
│  ├─ src/convert/            FormIR → JSM Forms design JSON + CoverageReport
│  ├─ src/triage/             Triage, death certificates, waves (spec brief 12)
│  ├─ src/legacy/             filled .xml → answers, upgrade.xsl, embedded attachments
│  └─ test/                   unit, property-based, golden snapshots
├─ apps/forge/                Forge app (manifest.yml, src/ resolvers & triggers, static/ Custom UI bundles)
│  ├─ static/studio/          admin page (Custom UI, React + Atlaskit)
│  ├─ static/classic/         portal create panel + Original view panel (shared renderer)
│  └─ src/                    resolvers, async consumers, rovo actions, SQL migrations
├─ apps/web/                  standalone viewer (Vite + React), deployable as static site
├─ samples/own/               our MIT set: 42 templates, 323 records, 22 screenshots (see its README)
├─ samples/public/            licensed third-party samples; today only theill's weight-keeper (MIT)
├─ docs/
│  ├─ SAMPLE-LICENSES.md      licence of each sample source, and whether it is in the repo
│  ├─ feature-coverage.md     the coverage document: InfoPath capability → Native/App/Manual/Unsupported
│  ├─ corpus-facts.md         counts over the 71-form corpus (42 own + 29 third-party, not in repo)
│  ├─ infopath-ux.md          how InfoPath 2013 looks and behaves, with provenance tags
│  ├─ spec-briefs/            the 12 briefs the Kiro specs are generated from
│  ├─ kiro/                   hook and MCP descriptions
│  └─ ARCHITECTURE.md, KIRO_USAGE.md, SECURITY.md   to be written
└─ LICENSE                    MIT
```

## Conventions
- `core` exposes a small public API from `packages/core/src/index.ts`. Apps never deep-import.
- File names use kebab-case. React components use PascalCase. One component per file.
- Errors are typed: `class AfterlifeError { code: 'UNSUPPORTED_COMPRESSION' | 'CORRUPT_CAB' | … }`. User-facing text is mapped in the UI layer.
- Every FormIR element carries `source: { file, xpath | line }` so the UI can point back to the original.
- Test fixtures come from `samples/own/` (the main set) and `samples/public/`. Tests that need
  unlicensed samples read them from the absolute path in `AFTERLIFE_PRIVATE_SAMPLES` and are
  skipped when it is unset.
