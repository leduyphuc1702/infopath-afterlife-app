import { describe, expect, test } from 'vitest';
import { parseManifest } from '../../src/xsf/parse-manifest';
import { manifestBytes, XSF } from '../helpers/synthetic-manifest';

// R13.9: a later occurrence of an element held once is not fatal. The first is modelled; each later
// one is one `repeated` unknown entry for its subtree (documented: true) plus a REPEATED_ELEMENT
// issue naming the element, the parent path and how many are allowed.

const R = '/xsf:xDocumentClass[1]';

/** Every `path` found in an object graph (the modelled set, design §8.4). */
function paths(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => paths(v, out));
  else if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (typeof o.path === 'string') out.add(o.path);
    Object.values(o).forEach((v) => paths(v, out));
  }
  return out;
}

describe('a held-once child (MS-IPFF2 xsd:all of xDocumentClass)', () => {
  const { manifest, unknowns, issues } = parseManifest(
    manifestBytes(`<xsf:fileNew><xsf:initialXmlDocument caption="first" href="template.xml"/></xsf:fileNew>
  <xsf:fileNew><xsf:initialXmlDocument caption="second" href="other.xml" bogus="1"/><xsf:other/></xsf:fileNew>`),
  );

  test('the first occurrence is modelled', () => {
    expect(manifest.fileNew!.attrs).toEqual({ caption: 'first', href: 'template.xml' });
  });

  test('the second is one repeated entry for its whole subtree, documented: true', () => {
    expect(unknowns).toEqual([
      {
        kind: 'element',
        reason: 'repeated',
        file: 'manifest.xsf',
        path: `${R}/xsf:fileNew[2]`,
        line: 4,
        column: 3,
        namespace: XSF,
        name: 'fileNew',
        raw: `<xsf:fileNew xmlns:xsf="${XSF}"><xsf:initialXmlDocument caption="second" href="other.xml" bogus="1"/><xsf:other/></xsf:fileNew>`,
        documented: true,
      },
    ]);
  });

  test('a REPEATED_ELEMENT issue names the element, the parent and the allowed count', () => {
    expect(issues).toEqual([
      {
        code: 'REPEATED_ELEMENT',
        message: `manifest.xsf: xsf:fileNew at ${R}/xsf:fileNew[2] repeats; MS-IPFF2 allows xsf:fileNew once in ${R}`,
        file: 'manifest.xsf',
        path: `${R}/xsf:fileNew[2]`,
        line: 4,
        column: 3,
        details: { element: 'xsf:fileNew', parent: R, allowed: 1, rule: 'MS-IPFF2' },
      },
    ]);
  });

  test('nothing in the result carries a path inside the repeated subtree', () => {
    const modelled = [...paths(manifest)];
    expect(modelled.filter((p) => p.startsWith(`${R}/xsf:fileNew[2]`))).toEqual([]);
    expect(modelled).toContain(`${R}/xsf:fileNew[1]`);
  });
});

test('three occurrences: two repeated entries and two issues, in document order', () => {
  const { unknowns, issues } = parseManifest(
    manifestBytes(`<xsf:submit caption="a"/><x:z xmlns:x="urn:x"/>
<xsf:submit caption="b"/>
<xsf:submit caption="c"/>`),
  );
  expect(unknowns.map((u) => [u.reason, u.path])).toEqual([
    ['notModelled', `${R}/{urn:x}z[1]`],
    ['repeated', `${R}/xsf:submit[2]`],
    ['repeated', `${R}/xsf:submit[3]`],
  ]);
  expect(issues.map((i) => i.path)).toEqual([`${R}/xsf:submit[2]`, `${R}/xsf:submit[3]`]);
});

test('an xsd:choice: members after the first are repeated, whatever their kind', () => {
  const { manifest, unknowns, issues } = parseManifest(
    manifestBytes(`<xsf:dataObjects><xsf:dataObject name="d"><xsf:query>
  <xsf:xmlFileAdapter fileUrl="a.xml"/>
  <xsf:adoAdapter connectionString="Password=x"/>
  <xsf:xmlFileAdapter fileUrl="b.xml"/>
</xsf:query></xsf:dataObject></xsf:dataObjects>`),
  );
  const q = `${R}/xsf:dataObjects[1]/xsf:dataObject[1]/xsf:query[1]`;
  expect(manifest.dataObjects[0]!.query!.attrs).toEqual({ fileUrl: 'a.xml' });
  expect(unknowns.map((u) => [u.reason, u.path, u.documented])).toEqual([
    ['repeated', `${q}/xsf:adoAdapter[1]`, true],
    ['repeated', `${q}/xsf:xmlFileAdapter[2]`, true],
  ]);
  const choice =
    'xsf:adoAdapter, xsf:sharepointListAdapter, xsf:sharepointListAdapterRW, xsf:webServiceAdapter, xsf:xmlFileAdapter';
  expect(issues.map((i) => i.details)).toEqual([
    { element: 'xsf:adoAdapter', parent: q, allowed: 1, rule: 'MS-IPFF2', choice },
    { element: 'xsf:xmlFileAdapter', parent: q, allowed: 1, rule: 'MS-IPFF2', choice },
  ]);
  expect(issues[0]!.message).toContain(`allows one of ${choice} once in ${q}`);
});

test('solution definitions across xsf:extension elements: the parser rule', () => {
  const { manifest, unknowns, issues } = parseManifest(
    manifestBytes(`<xsf:extensions>
  <xsf:extension name="a"><xsf2:solutionDefinition runtimeCompatibility="client"/></xsf:extension>
  <xsf:extension name="b"><xsf2:solutionDefinition runtimeCompatibility="server"><xsf2:server/></xsf2:solutionDefinition></xsf:extension>
</xsf:extensions>`),
  );
  expect(manifest.solution.runtimeCompatibility).toEqual(['client']);
  expect(manifest.solution).not.toHaveProperty('server');
  const second = `${R}/xsf:extensions[1]/xsf:extension[2]/xsf2:solutionDefinition[1]`;
  expect(unknowns.map((u) => [u.reason, u.path, u.documented])).toEqual([
    ['repeated', second, true],
  ]);
  expect(issues.map((i) => i.details)).toEqual([
    {
      element: 'xsf2:solutionDefinition',
      parent: `${R}/xsf:extensions[1]`,
      allowed: 1,
      rule: 'parser',
    },
  ]);
});

test('walker entries inside a repeated subtree are part of the one repeated entry', () => {
  const { unknowns } = parseManifest(
    manifestBytes(`<xsf:fileNew/>
<xsf:fileNew bogus="1"><xsf:initialXmlDocument caption="x" trash="t"/>text<x:y xmlns:x="urn:x"/></xsf:fileNew>`),
  );
  expect(unknowns.map((u) => [u.reason, u.path])).toEqual([['repeated', `${R}/xsf:fileNew[2]`]]);
});

test('a repeat deep inside a modelled element (xsf:editWith in xsf:xmlToEdit)', () => {
  const { manifest, unknowns } = parseManifest(
    manifestBytes(`<xsf:views><xsf:view name="v"><xsf:editing><xsf:xmlToEdit name="x" item="/my:a">
  <xsf:editWith component="xField"/><xsf:editWith component="xCollection"/>
</xsf:xmlToEdit></xsf:editing></xsf:view></xsf:views>`),
  );
  expect(manifest.views[0]!.xmlToEdit[0]!.editWith!.attrs).toEqual({ component: 'xField' });
  expect(unknowns.map((u) => [u.reason, u.name])).toEqual([['repeated', 'editWith']]);
});
