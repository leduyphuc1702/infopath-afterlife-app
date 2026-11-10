---
inclusion: always
---

# Repository structure

```
/
├─ .kiro/                     steering, specs, hooks, settings (committed, never gitignored)
├─ packages/core/             pure TypeScript, no Forge/React imports; runs in Node and browser
│  ├─ src/cab/                CAB (MSCF) reader, MSZIP only
│  ├─ src/xsf/                manifest.xsf reader (xsf, xsf2, xsf3 namespaces)
│  ├─ src/xsd/                schema reader → field tree
│  ├─ src/ir/                 FormIR types + builder + JSON (de)serialisation
│  ├─ src/render/             XSLT render + xd* extension-function shims + sanitise
│  ├─ src/xpath-fns/          InfoPath function library (today, now, nz, eval, addDays…)
│  ├─ src/runtime/            Classic runtime: bindings, rules, calcs, validation, repeating
│  ├─ src/convert/            FormIR → JSM Forms design JSON + CoverageReport
│  ├─ src/legacy/             filled .xml → answers, upgrade.xsl, embedded attachments
│  └─ test/                   unit, property-based, golden snapshots
├─ apps/forge/                Forge app (manifest.yml, src/ resolvers & triggers, static/ Custom UI bundles)
│  ├─ static/studio/          admin page (Custom UI, React + Atlaskit)
│  ├─ static/classic/         portal create panel + Original view panel (shared renderer)
│  └─ src/                    resolvers, async consumers, rovo actions, SQL migrations
├─ apps/web/                  standalone viewer (Vite + React), deployable as static site
├─ samples/public/            only licensed samples (Microsoft templates via spjeff, MIT theill)
├─ samples/private/           gitignored + kiroignored; unlicensed real-world samples, local tests only
├─ docs/                      KIRO_USAGE.md, ARCHITECTURE.md, COVERAGE.md, SECURITY.md
└─ LICENSE                    MIT
```

## Conventions
- `core` exposes a small public API from `packages/core/src/index.ts`. Apps never deep-import.
- File names use kebab-case. React components use PascalCase. One component per file.
- Errors are typed: `class AfterlifeError { code: 'UNSUPPORTED_COMPRESSION' | 'CORRUPT_CAB' | … }`. User-facing text is mapped in the UI layer.
- Every FormIR element carries `source: { file, xpath | line }` so the UI can point back to the original.
- Test fixtures come from `samples/public` only. Tests that need private samples are skipped when the folder is missing.
