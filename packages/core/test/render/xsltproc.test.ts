import { readdirSync, readFileSync } from 'node:fs';
import xsltjsModule from 'xsltjs';
import { describe, expect, test } from 'vitest';
import { buildFormIR } from '../../src/index';
import type { CompiledView } from '../../src/render/engine/xsltjs';
import { controlIndex } from '../../src/render/marks';
import { compileCase, runCompiled } from '../helpers/engine';
import { normaliseHtml } from '../helpers/html-normalise';
import { packageFileOf, viewCases, type ViewCase } from '../helpers/render-cases';

// Spec 03 task 10 (R10.1, design §10, §9.1): in fallback mode, before post-processing, the engine
// gives the same HTML as `xsltproc` for the 53 views with both records, after the design's
// normalisation (steps 1–8). The references are committed (scripts/gen-xsltproc-refs.ts), so
// this test reads files only and needs no `xsltproc`. With every hook on (marks, budget, step
// counting), the engine's HTML is also byte-identical to a bare `XSLT.run`.

const XSLT = (
  xsltjsModule as {
    XSLT: { compile(x: string): Promise<unknown>; run(s: unknown, x: string): string };
  }
).XSLT;
const dec = new TextDecoder();
const REFS = new URL('../golden/render/xsltproc/', import.meta.url);
const RECORDS = ['empty', 'first'] as const;
const refPath = (c: ViewCase, record: string) =>
  `${c.slug}/${c.xslFile.replace(/\.xsl$/i, '')}.${record}.html`;

const cases = await viewCases();

test('106 references and VERSION.txt, and no other file', () => {
  const files = readdirSync(REFS, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => `${d.parentPath.slice(REFS.pathname.length)}/${d.name}`.replace(/^\//, ''))
    .sort();
  const expected = cases.flatMap((c) => RECORDS.map((r) => refPath(c, r)));
  expect(expected).toHaveLength(106);
  expect(files).toEqual([...expected, 'VERSION.txt'].sort());
  expect(readFileSync(new URL('VERSION.txt', REFS), 'utf8')).toMatch(/libxml 20913, libxslt 10135/);
});

const compiled = new Map<string, Promise<CompiledView>>();
const compiledOf = (c: ViewCase) => {
  if (!compiled.has(c.id)) compiled.set(c.id, compileCase(c));
  return compiled.get(c.id)!;
};

describe.each(cases.map((c) => [c.id, c] as const))('%s', (_id, c) => {
  const view = buildFormIR(c.t).views.find((v) => v.name === c.view)!;
  const hooked = async (record: (typeof RECORDS)[number]) =>
    runCompiled(await compiledOf(c), c.records[record], {
      fallback: true,
      controlAt: controlIndex(view),
    });

  test.each(RECORDS)('%s record: equals xsltproc after normalisation', async (record) => {
    const ref = readFileSync(new URL(refPath(c, record), REFS), 'utf8');
    expect(normaliseHtml((await hooked(record)).html)).toBe(normaliseHtml(ref));
  });

  test.each(RECORDS)('%s record: hooks on equals a bare XSLT.run', async (record) => {
    const xsl = dec.decode(packageFileOf(c.t)(c.xslFile));
    const bare = XSLT.run(await XSLT.compile(xsl), dec.decode(c.records[record]));
    expect((await hooked(record)).html).toBe(bare);
  });
});

describe('the normalisation (design §10)', () => {
  test('steps 2–8 on a small page', () => {
    const a =
      '<!DOCTYPE html><html><head><meta http-equiv="Content-Type" content="text/html"></head>' +
      '<body><!-- c --><p xmlns:xd="urn:x" title="  a \n b " class="k">  x \t y </p>' +
      '<input type="radio" name="idm1" checked="CHECKED"><input name="idm2"><input name="idm1">' +
      '<td nowrap="1"></td></body></html>';
    const b =
      '<html><head><META HTTP-EQUIV="content-type" content="x"></head><body>' +
      '<p class="k" title="a b">x y</p><input name="d1n" checked type="radio">' +
      '<input name="d2n"><input name="d1n"><td nowrap></td></body></html>';
    expect(normaliseHtml(a)).toBe(normaliseHtml(b));
  });

  test('a real difference survives it', () => {
    expect(normaliseHtml('<p title="a">x</p>')).not.toBe(normaliseHtml('<p title="b">x</p>'));
    expect(normaliseHtml('<input name="a"><input name="a">')).not.toBe(
      normaliseHtml('<input name="a"><input name="b">'),
    );
  });
});
