import { beforeAll, expect, test } from 'vitest';
import { buildFormIR, parseXsn, prepareView, renderView } from '../../src/index';
import { CORE_FUNCTIONS } from '../../src/render/engine/host';
import { functionTable } from '../../src/render/functions';
import { compileCase, compileText, runCompiled } from '../helpers/engine';
import { viewCases, type ViewCase } from '../helpers/render-cases';
import { readSample, sampleCabinets } from '../helpers/samples';

// Spec 03 R4.2 (function-available is true exactly for what is implemented), R4.3 (formatString
// in the views) and R4.4 (an unimplemented function outside a guard gives '' and one issue).
// Task 6 adds the other R4.1 functions and their cases.

const NOW = '2026-11-03T09:00:00-08:00';
const XSL = 'http://www.w3.org/1999/XSL/Transform';
const NS = {
  xdFormatting: 'http://schemas.microsoft.com/office/infopath/2003/xslt/formatting',
  xdXDocument: 'http://schemas.microsoft.com/office/infopath/2003/xslt/xDocument',
  xdImage: 'http://schemas.microsoft.com/office/infopath/2003/xslt/xImage',
  xdDate: 'http://schemas.microsoft.com/office/infopath/2003/xslt/Date',
  xdMath: 'http://schemas.microsoft.com/office/infopath/2003/xslt/Math',
  xdUser: 'http://schemas.microsoft.com/office/infopath/2006/xslt/User',
  msxsl: 'urn:schemas-microsoft-com:xslt',
  ipApp: 'http://schemas.microsoft.com/office/infopath/2006/XPathExtension/ipApp',
};
const declarations = Object.entries(NS)
  .map(([p, u]) => `xmlns:${p}="${u}"`)
  .join(' ');
const sheet = (body: string) =>
  `<xsl:stylesheet version="1.0" xmlns:xsl="${XSL}" ${declarations} exclude-result-prefixes="${Object.keys(NS).join(' ')}">` +
  `<xsl:output method="html"/><xsl:template match="/">${body}</xsl:template></xsl:stylesheet>`;
const table = functionTable({ now: NOW, locale: 'en-US', userName: '' });

/** Every R4.1 name, a few core names, xsltjs extras that MSXML lacks, and one never implemented. */
const R41 = [
  'xdFormatting:formatString',
  'xdXDocument:GetDOM',
  'xdXDocument:GetNamedNodeProperty',
  'xdImage:getImageUrl',
  'xdDate:Today',
  'xdDate:Now',
  'xdMath:Avg',
  'xdMath:Nz',
  'xdMath:Eval',
  'xdUser:get-UserName',
  'msxsl:node-set',
  'msxsl:string-compare',
];
const NAMES = [
  ...R41,
  'concat',
  'generate-id',
  'function-available',
  'replace',
  'counter',
  'tokenize',
  'ipApp:GetMajorVersion',
];

const implemented = (name: string) => {
  const [prefix, local] = name.includes(':') ? name.split(':') : ['', name];
  if (prefix === '') return CORE_FUNCTIONS.has(local!);
  return table.get(NS[prefix as keyof typeof NS])?.has(local!) === true;
};

test('function-available is true exactly for the implemented set (R4.2)', async () => {
  const view = await compileText(
    sheet(NAMES.map((n) => `<p><xsl:value-of select="function-available('${n}')"/></p>`).join('')),
  );
  const shown = [
    ...runCompiled(view, '<r/>', { functions: table }).html.matchAll(/<p>(\w+)<\/p>/g),
  ].map((m) => m[1]);
  expect(Object.fromEntries(NAMES.map((n, i) => [n, shown[i]]))).toEqual(
    Object.fromEntries(NAMES.map((n) => [n, String(implemented(n))])),
  );
  // Task 2: formatString is the one extension so far; xsltjs's own extras stay hidden (MSXML).
  expect(NAMES.filter(implemented)).toEqual([
    'xdFormatting:formatString',
    'concat',
    'generate-id',
    'function-available',
  ]);
});

test('in fallback mode no extension function is available (R10.1)', async () => {
  const view = await compileText(
    sheet('<p><xsl:value-of select="function-available(\'xdFormatting:formatString\')"/></p>'),
  );
  expect(runCompiled(view, '<r/>', { functions: table, fallback: true }).html).toBe('<p>false</p>');
});

test("an unguarded unknown function gives '' and one UNKNOWN_FUNCTION per name with its calls (R4.4)", async () => {
  const view = await compileText(
    sheet(
      '<p>[<xsl:value-of select="ipApp:GetMajorVersion()"/>]</p>' +
        '<xsl:for-each select="/r/a"><q><xsl:value-of select="concat(ipApp:GetMajorVersion(), \'x\')"/></q></xsl:for-each>' +
        '<xsl:choose><xsl:when test="function-available(\'ipApp:GetMajorVersion\')"><xsl:value-of select="ipApp:GetMajorVersion()"/></xsl:when><xsl:otherwise><s>guarded</s></xsl:otherwise></xsl:choose>' +
        '<b><xsl:value-of select="msxsl:node-set(/r)"/></b>',
    ),
  );
  const out = runCompiled(view, '<r><a/><a/></r>', { functions: table });
  expect(out.html).toBe('<p>[]</p><q>x</q><q>x</q><s>guarded</s><b></b>');
  expect(out.issues.map((i) => [i.code, i.details])).toEqual([
    ['UNKNOWN_FUNCTION', { name: 'ipApp:GetMajorVersion', calls: 3 }],
    ['UNKNOWN_FUNCTION', { name: 'msxsl:node-set', calls: 1 }],
  ]);
});

test('a function in an undeclared-to-us namespace is named {uri}local', async () => {
  const view = await compileText(
    `<xsl:stylesheet version="1.0" xmlns:xsl="${XSL}" xmlns:z="urn:z"><xsl:output method="html"/>` +
      '<xsl:template match="/"><p><xsl:value-of select="z:f()"/></p></xsl:template></xsl:stylesheet>',
  );
  expect(runCompiled(view, '<r/>', { functions: table }).issues[0]?.details).toEqual({
    name: '{urn:z}f',
    calls: 1,
  });
});

test('formatString results are charged to the budget like concat (design §6)', async () => {
  const view = await compileText(
    sheet(
      `<p><xsl:value-of select="xdFormatting:formatString('1234567.5', 'currency', 'numDigits:2;')"/></p>`,
    ),
  );
  const out = runCompiled(view, '<r/>', { functions: table });
  expect(out.html).toBe('<p>$1,234,567.50</p>');
  // '$1,234,567.50' is 13 characters → 1 step; no location steps.
  expect(out.budget.steps).toBe(1);
});

let cases: ViewCase[];
beforeAll(async () => {
  cases = await viewCases();
});

test('the 53 views call no unimplemented function with either record', async () => {
  for (const c of cases) {
    const view = await compileCase(c);
    for (const record of [c.records.empty, c.records.first]) {
      const out = runCompiled(view, record, { functions: table });
      expect(
        out.issues.filter((i) => i.code === 'UNKNOWN_FUNCTION'),
        c.id,
      ).toEqual([]);
    }
  }
});

test('form 02 and form 01 show amounts and dates as InfoPath does (R4.3)', async () => {
  const render = async (slug: string) => {
    const c = sampleCabinets().find((s) => s.slug === slug)!;
    const t = await parseXsn(readSample(c.path));
    const view = cases.find((v) => v.slug === slug)!;
    return renderView(await prepareView(t, buildFormIR(t)), {
      now: NOW,
      record: view.records.first,
    }).html;
  };
  const f02 = await render('02-expense-report');
  for (const amount of ['$55.39', '$294.91', '$350.30']) expect(f02).toContain(amount);
  expect(f02).not.toMatch(/>\d{4}-\d{2}-\d{2}</);
  const f01 = await render('01-leave-request');
  expect(f01).toContain('>7/28/2025<');

  // Fallback mode, as xsltproc: the guards take xsl:otherwise and the raw values show.
  const c02 = cases.find((v) => v.slug === '02-expense-report')!;
  const raw = runCompiled(await compileCase(c02), c02.records.first, { fallback: true }).html;
  expect(raw).toContain('>350.30<');
  expect(raw).not.toContain('$350.30');
});
