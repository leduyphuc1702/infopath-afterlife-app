import fs from 'node:fs';
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { AfterlifeError } from '../../src/errors';
import xsltjsModule from 'xsltjs';
import { compileCase, compileText, runCompiled } from '../helpers/engine';
import { viewCases, type ViewCase } from '../helpers/render-cases';

// Spec 03 R3.2, design §5.1: xsl:import, xsl:include and document() read package files only, and
// xsltjs's default loader (fs for paths, fetch for http) is never reached.

const XSL = 'http://www.w3.org/1999/XSL/Transform';
const sheet = (body: string, top = '') =>
  `<xsl:stylesheet version="1.0" xmlns:xsl="${XSL}">${top}<xsl:output method="html"/>` +
  `<xsl:template match="/">${body}</xsl:template></xsl:stylesheet>`;

/** Spies on fs and fetch that count, and refuse, every call made from inside xsltjs. */
function watchDefaultLoader() {
  const fromXsltjs = () => /[\\/]xsltjs[\\/]scripts[\\/]/.test(new Error().stack ?? '');
  const calls: string[] = [];
  const guard =
    <A extends unknown[], R>(name: string, original: (...a: A) => R) =>
    (...args: A): R => {
      if (fromXsltjs()) {
        calls.push(name);
        throw new Error(`${name} reached from xsltjs`);
      }
      return original(...args);
    };
  vi.spyOn(fs, 'readFileSync').mockImplementation(
    guard('fs.readFileSync', fs.readFileSync.bind(fs)),
  );
  vi.spyOn(fs.promises, 'readFile').mockImplementation(
    guard('fs.promises.readFile', fs.promises.readFile.bind(fs.promises)),
  );
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    guard('fetch', globalThis.fetch.bind(globalThis)),
  );
  return calls;
}

afterEach(() => {
  vi.restoreAllMocks();
});

let cases: ViewCase[];
beforeAll(async () => {
  cases = await viewCases();
});

test('the spies see the default loader when no loader is given (control)', async () => {
  const calls = watchDefaultLoader();
  const XSLT = xsltjsModule.XSLT as {
    compile(t: string, o: object): Promise<unknown>;
  };
  await expect(
    XSLT.compile(sheet('<p/>', '<xsl:include href="part.xsl"/>'), {
      transformURL: '/tmp/afterlife-no-such/view.xsl',
    }),
  ).rejects.toThrow(/Could not load part\.xsl/);
  expect(calls).toEqual(['fs.promises.readFile']);
});

test('the 53 views compile and render in fallback mode, both records, with no fs or fetch call', async () => {
  expect(cases).toHaveLength(53);
  const calls = watchDefaultLoader();
  let rendered = 0;
  for (const c of cases) {
    const view = await compileCase(c);
    expect(view.issues, c.id).toEqual([]);
    for (const record of [c.records.empty, c.records.first]) {
      const out = runCompiled(view, record, { fallback: true });
      expect(out.html.length, c.id).toBeGreaterThan(0);
      rendered++;
    }
  }
  expect(rendered).toBe(106);
  expect(calls).toEqual([]);
});

test.each([
  [
    'http: include',
    '<xsl:include href="http://forms-legacy.example/x.xsl"/>',
    'http://forms-legacy.example/x.xsl',
  ],
  [
    'https: import',
    '<xsl:import href="https://forms-legacy.example/x.xsl"/>',
    'https://forms-legacy.example/x.xsl',
  ],
  ['file: include', '<xsl:include href="file:///etc/passwd"/>', 'file:///etc/passwd'],
  ['absolute path import', '<xsl:import href="/etc/passwd"/>', 'xsn:///etc/passwd'],
  ['parent-folder include', '<xsl:include href="../../etc/x.xsl"/>', 'xsn:///etc/x.xsl'],
  ['missing package file', '<xsl:include href="nothere.xsl"/>', 'xsn:///nothere.xsl'],
])('%s is skipped with one EXTERNAL_RESOURCE_BLOCKED', async (_name, top, uri) => {
  const calls = watchDefaultLoader();
  const view = await compileText(sheet('<p>ok</p>', top));
  expect(view.issues.map((i) => [i.code, i.details?.uri])).toEqual([
    ['EXTERNAL_RESOURCE_BLOCKED', uri],
  ]);
  expect(runCompiled(view, '<r/>').html).toBe('<p>ok</p>');
  expect(calls).toEqual([]);
});

test('a package include and a package import are loaded', async () => {
  const part = (name: string, text: string) =>
    `<xsl:stylesheet version="1.0" xmlns:xsl="${XSL}"><xsl:template name="${name}">${text}</xsl:template></xsl:stylesheet>`;
  const view = await compileText(
    sheet(
      '<p><xsl:call-template name="a"/>-<xsl:call-template name="b"/></p>',
      '<xsl:import href="Lib.xsl"/><xsl:include href="part.xsl"/>',
    ),
    { 'lib.xsl': part('a', 'imported'), 'part.xsl': part('b', 'included') },
  );
  expect(view.issues).toEqual([]);
  expect(runCompiled(view, '<r/>').html).toBe('<p>imported-included</p>');
});

test('an included package file with a DOCTYPE stops the compile with UNSAFE_XML', async () => {
  const err = await compileText(sheet('<p/>', '<xsl:include href="bad.xsl"/>'), {
    'bad.xsl':
      '<!DOCTYPE x [<!ENTITY e "x">]><xsl:stylesheet version="1.0" xmlns:xsl="' + XSL + '"/>',
  }).catch((e: unknown) => e);
  expect(err).toBeInstanceOf(AfterlifeError);
  expect((err as AfterlifeError).code).toBe('UNSAFE_XML');
});

test('document(): package files load, other URIs give an empty node-set and an issue', async () => {
  const calls = watchDefaultLoader();
  const view = await compileText(
    sheet(
      '<p><xsl:value-of select="document(\'rows.xml\')/rows/row"/>|' +
        '<xsl:value-of select="count(document(\'http://forms-legacy.example/a.xml\')/*)"/>|' +
        '<xsl:value-of select="count(document(\'file:///etc/hosts\')/*)"/>|' +
        '<xsl:value-of select="count(document(\'\')/*)"/></p>',
    ),
  );
  const out = runCompiled(view, '<r/>', {
    documents: { 'rows.xml': '<rows><row>one</row></rows>' },
  });
  expect(out.html).toBe('<p>one|0|0|1</p>');
  expect(out.issues.map((i) => [i.code, i.details?.uri])).toEqual([
    ['EXTERNAL_RESOURCE_BLOCKED', 'http://forms-legacy.example/a.xml'],
    ['EXTERNAL_RESOURCE_BLOCKED', 'file:///etc/hosts'],
  ]);
  expect(calls).toEqual([]);
});
