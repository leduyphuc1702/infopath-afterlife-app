// Spec 03 R10.3 (task 13): every view a `mainpane` names, in every template under
// AFTERLIFE_PRIVATE_SAMPLES except the `own/` folder (our forms, covered by the goldens), renders
// with its empty form and no throw. Local only: those files are unlicensed and never enter the
// repo. The summary prints names and counts only (codes, kinds, function names, file names),
// never XSL, record text or rendered HTML. Nothing is written.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import { buildFormIR, parseXsn, prepareView, renderView } from '../src/index';
import { functionTable } from '../src/render/functions';
import { compileText, runCompiled } from './helpers/engine';
import { GOLDEN_INPUT } from './helpers/render-golden';

const root = process.env.AFTERLIFE_PRIVATE_SAMPLES;

function xsnFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...xsnFiles(path));
    else if (/\.xsn$/i.test(name)) out.push(path);
  }
  return out;
}

const files = root
  ? xsnFiles(root)
      .filter((f) => !relative(root, f).split(sep).includes('own'))
      .sort((a, b) => relative(root, a).localeCompare(relative(root, b)))
  : [];

const counts = {
  issues: {} as Record<string, number>,
  removed: {} as Record<string, number>,
  removedNames: {} as Record<string, number>,
  unknownFunctions: {} as Record<string, number>,
  /** `{uri}local` → the views whose XSL guards on it. */
  guards: {} as Record<string, number>,
};
const totals = {
  templates: 0,
  views: 0,
  rendered: 0,
  controls: 0,
  controlsMarked: 0,
  marks: 0,
  asterisks: 0,
  notMarkedIssues: 0,
  unnamedXsl: 0,
  unnamedUpgrade: 0,
};
let slowest = { name: '', ms: 0 };
const bump = (m: Record<string, number>, k: string, n = 1) => (m[k] = (m[k] ?? 0) + n);
const line = (m: Record<string, number>) =>
  Object.keys(m)
    .sort()
    .map((k) => `${k} ${m[k]}`)
    .join(', ') || 'none';

const dec = new TextDecoder();
/** `function-available('p:name')` names in an XSL, with their namespace URIs. */
function guardNames(xsl: string): string[] {
  const ns = new Map<string, string>();
  for (const m of xsl.matchAll(/xmlns:([\w.-]+)\s*=\s*["']([^"']*)["']/g)) ns.set(m[1]!, m[2]!);
  const out = new Set<string>();
  for (const m of xsl.matchAll(/function-available\(\s*(?:'([^']*)'|"([^"]*)")\s*\)/g)) {
    const name = (m[1] ?? m[2]!).trim();
    const colon = name.indexOf(':');
    out.add(colon < 0 ? name : `{${ns.get(name.slice(0, colon)) ?? '?'}}${name.slice(colon + 1)}`);
  }
  return [...out];
}

/** What our function-available answers for a `{uri}local` name, from a probe view. */
const answers = new Map<string, boolean>();
async function available(name: string): Promise<boolean> {
  if (!answers.has(name)) {
    const m = /^\{([^}]*)\}(.*)$/.exec(name);
    const decl = m ? ` xmlns:p="${m[1]!.replace(/"/g, '&quot;')}"` : '';
    const q = m ? `p:${m[2]}` : name;
    const view = await compileText(
      `<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"${decl}>` +
        `<xsl:template match="/"><r><xsl:value-of select="function-available('${q}')"/></r></xsl:template></xsl:stylesheet>`,
    );
    const out = runCompiled(view, '<r/>', {
      functions: functionTable({ now: GOLDEN_INPUT.now, locale: 'en-US', userName: '' }),
    });
    answers.set(name, out.html.includes('true'));
  }
  return answers.get(name)!;
}

describe.skipIf(!root)('private renders (AFTERLIFE_PRIVATE_SAMPLES, own/ skipped)', () => {
  test.each(files.map((f) => [relative(root!, f), f]))('%s', async (name, path) => {
    const t = await parseXsn(new Uint8Array(readFileSync(path)));
    const ir = buildFormIR(t);
    totals.templates++;
    const panes = new Set(
      t.manifest.views.flatMap((v) => v.mainpanes.map((p) => p.attrs.transform?.toLowerCase())),
    );
    for (const f of t.files) {
      if (!/\.xsl$/i.test(f.name) || panes.has(f.name.toLowerCase())) continue;
      if (f.name.toLowerCase() === 'upgrade.xsl') totals.unnamedUpgrade++;
      else totals.unnamedXsl++;
    }
    for (const v of t.manifest.views) {
      const xslFile = v.mainpanes[0]?.attrs.transform;
      if (xslFile === undefined) continue;
      totals.views++;
      const viewName = v.attrs.name ?? xslFile;
      const xsl = t.files.find((f) => f.name.toLowerCase() === xslFile.toLowerCase());
      if (xsl) for (const g of guardNames(dec.decode(xsl.bytes))) bump(counts.guards, g);

      const prepared = await prepareView(t, ir, { view: viewName });
      const t0 = performance.now();
      const r = renderView(prepared, { ...GOLDEN_INPUT });
      const ms = performance.now() - t0;
      totals.rendered++;
      if (ms > slowest.ms) slowest = { name: `${name} ${xslFile}`, ms };

      for (const i of [...prepared.issues, ...r.issues]) {
        bump(counts.issues, i.code);
        const d = (i.details ?? {}) as Record<string, unknown>;
        if (i.code === 'CONTENT_REMOVED') {
          bump(counts.removed, String(d.kind), Number(d.count));
          // The message ends with the removed names (attribute, element or CSS names).
          bump(counts.removedNames, `${String(d.kind)}: ${i.message.split('removed: ')[1] ?? '?'}`);
        }
        if (i.code === 'UNKNOWN_FUNCTION')
          bump(counts.unknownFunctions, String(d.name), Number(d.calls));
        if (i.code === 'CONTROL_NOT_MARKED') totals.notMarkedIssues += Number(d.count);
      }
      const controls = ir.views.find((x) => x.name === viewName)?.controls ?? [];
      const marked = new Set(r.marks.map((m) => m.controlId));
      totals.controls += controls.length;
      totals.controlsMarked += controls.filter((c) => marked.has(c.id)).length;
      totals.marks += r.marks.length;
      totals.asterisks += r.marks.filter((m) => m.required).length;
    }
  });

  test('every named view rendered; no element removed; no unknown function called', () => {
    expect(totals.rendered).toBe(totals.views);
    expect(counts.removed.element ?? 0).toBe(0);
    expect(counts.unknownFunctions).toEqual({});
  });

  afterAll(async () => {
    const guards: string[] = [];
    for (const g of Object.keys(counts.guards).sort())
      guards.push(`${g} ${(await available(g)) ? 'true' : 'false'} (${counts.guards[g]} views)`);
    console.log(
      [
        `private renders: ${totals.templates} templates, ${totals.views} named views, ${totals.rendered} rendered with the empty form`,
        `issues by code: ${line(counts.issues)}`,
        `CONTENT_REMOVED by kind: ${line(counts.removed)}; by name: ${line(counts.removedNames)}`,
        `unknown functions by name (calls): ${line(counts.unknownFunctions)}`,
        `guards by name (function-available answer): ${guards.join('; ') || 'none'}`,
        `FormIR controls: ${totals.controls}, with a mark ${totals.controlsMarked}, without ${totals.controls - totals.controlsMarked}; CONTROL_NOT_MARKED elements ${totals.notMarkedIssues}`,
        `marks ${totals.marks}, asterisks drawn ${totals.asterisks}`,
        `slowest render: ${slowest.name} ${slowest.ms.toFixed(2)} ms`,
        `.xsl files no mainpane names: ${totals.unnamedXsl + totals.unnamedUpgrade} (upgrade.xsl ${totals.unnamedUpgrade}, other ${totals.unnamedXsl})`,
      ].join('\n'),
    );
  });
});
