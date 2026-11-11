import fc from 'fast-check';
import { expect, test } from 'vitest';
import { buildFormIR, causesOf, parseXsn, recordEvidence, type FormIR } from '../../src/index';
import type { ParsedTemplate } from '../../src/xsn/parse';
import { selects } from '../helpers/located';
import { readSample, sampleCabinets } from '../helpers/samples';
import { HEAVY_MS } from '../helpers/time';

// Property P9 (spec 12 R2.4): every cause's evidence names a file of the template's package (or
// the record it came from), and its path selects a node in that file. Over the 48 in-repo forms,
// then 200 variants that combine their connections, code-behind, ActiveX and signatures.
const RUNS = 200;
const dec = new TextDecoder();
const forms: { slug: string; t: ParsedTemplate; ir: FormIR }[] = [];
for (const c of sampleCabinets()) {
  const t = await parseXsn(readSample(c.path));
  forms.push({ slug: c.slug, t, ir: buildFormIR(t) });
}
const RECORD = new TextEncoder().encode(
  '<?xml version="1.0"?>\n<?xml-stylesheet type="text/xsl" href="v.xsl"?>\n<r/>',
);

/** Checks `ir`'s causes against the files of `t` (a variant's parts keep their own form). */
function problems(ir: FormIR, owners: readonly ParsedTemplate[]): string[] {
  const out: string[] = [];
  const recordText = dec.decode(RECORD);
  for (const c of causesOf(ir, [recordEvidence('rec.xml', RECORD)]))
    for (const e of c.evidence) {
      const { file, path, line } = e.located;
      if (!file || !path) out.push(`${c.id}: empty evidence`);
      if (c.from === 'record') {
        if (file !== 'rec.xml' || line > recordText.split('\n').length)
          out.push(`${c.id}: ${file}`);
        continue;
      }
      const bytes = owners.flatMap((o) =>
        o.files.filter((f) => f.name === file).map((f) => f.bytes),
      );
      if (bytes.length === 0) {
        out.push(`${c.id}: no file ${file}`);
        continue;
      }
      // A code file is evidence as a whole (path "/"); XML evidence must select its node.
      if (path === '/') continue;
      if (!bytes.some((b) => selects(dec.decode(b), path))) out.push(`${c.id}: ${file} ${path}`);
    }
  return out;
}

test('the 48 in-repo forms: every evidence path selects its node', () => {
  for (const f of forms) expect(problems(f.ir, [f.t]), f.slug).toEqual([]);
});

test(
  `${RUNS} variants: parts of several forms combined, evidence still resolves`,
  { timeout: HEAVY_MS },
  () => {
    const rich = forms.filter((f) => /^(04|43|44|45|46|47)-/.test(f.slug));
    fc.assert(
      fc.property(fc.nat(forms.length - 1), fc.subarray(rich, { minLength: 1 }), (base, parts) => {
        const b = forms[base]!;
        const ir: FormIR = {
          ...b.ir,
          meta: parts.some((p) => p.ir.meta.browserCompatible)
            ? { ...b.ir.meta, browserCompatible: true }
            : b.ir.meta,
          dataConnections: [...b.ir.dataConnections, ...parts.flatMap((p) => p.ir.dataConnections)],
          activeX: { controls: parts.flatMap((p) => p.ir.activeX.controls), allowed: [] },
          signatures: { blocks: parts.flatMap((p) => p.ir.signatures.blocks), signatureLines: [] },
          codeBehind: parts.find((p) => p.ir.codeBehind.present)?.ir.codeBehind ?? b.ir.codeBehind,
        };
        // Evidence of a copied part lives in that part's form; meta evidence in the base's.
        const owners = [b.t, ...parts.map((p) => p.t)];
        const found = problems(ir, owners);
        // Files of the same name (manifest.xsf) are in several owners: the path must select in one.
        expect(found).toEqual([]);
      }),
      { numRuns: RUNS },
    );
  },
);

test('the oracle refuses paths that select nothing', () => {
  const f44 = forms.find((f) => f.slug.startsWith('44-'))!;
  const manifest = dec.decode(f44.t.files.find((f) => f.name === 'manifest.xsf')!.bytes);
  const view = dec.decode(f44.t.files.find((f) => f.name === 'view1.xsl')!.bytes);
  expect(selects(manifest, '/xsf:xDocumentClass[1]/@productVersion')).toBe(true);
  expect(selects(manifest, '/xsf:xDocumentClass[1]/@nope')).toBe(false);
  expect(selects(manifest, '/xsf:xDocumentClass[2]')).toBe(false);
  expect(selects(manifest, '/xsf:nothing[1]')).toBe(false);
  const ax = f44.ir.activeX.controls[0]!;
  expect(selects(view, ax.source.path)).toBe(true);
  expect(selects(view, ax.server!.source.path)).toBe(true);
  expect(selects(view, ax.source.path.replace('object[1]', 'object[2]'))).toBe(false);
});
