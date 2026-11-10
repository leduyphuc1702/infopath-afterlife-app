import { beforeAll, expect, test } from 'vitest';
import { buildFormIR, parseXsn, prepareView, renderView } from '../../src/index';
import { CORE_FUNCTIONS } from '../../src/render/engine/host';
import { functionTable, type FunctionInputs } from '../../src/render/functions';
import { compileCase, compileText, runCompiled } from '../helpers/engine';
import { viewCases, type ViewCase } from '../helpers/render-cases';
import { readSample, sampleCabinets } from '../helpers/samples';

// Spec 03 R4.2 (function-available is true exactly for what is implemented), R4.3 (formatString
// in the views) and R4.4 (an unimplemented function outside a guard gives '' and one issue).
// Task 6: one case per R4.1 function and edge case (design §7.1), at the end of this file.

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
  // Task 6: every R4.1 function; xsltjs's own extras stay hidden (MSXML).
  expect(NAMES.filter(implemented)).toEqual([
    ...R41,
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
  // '$1,234,567.50' is 13 characters → 1 step; no location steps; p and value-of → 2 steps.
  expect(out.budget.steps).toBe(1 + 2);
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

// --- Task 6: the R4.1 functions (design §7.1) ------------------------------------------------

const run = async (body: string, record = '<r/>', inputs: Partial<FunctionInputs> = {}) =>
  runCompiled(await compileText(sheet(body)), record, {
    functions: functionTable({ now: NOW, locale: 'en-US', userName: '', ...inputs }),
  });
const value = (select: string) => `<p><xsl:value-of select="${select}"/></p>`;
const paras = (html: string) => [...html.matchAll(/<p>([^<]*)<\/p>/g)].map((m) => m[1]);

test('xdXDocument:GetDOM: a package source is its document; any other name an empty document, one issue per name', async () => {
  const out = runCompiled(
    await compileText(
      sheet(
        value("count(xdXDocument:GetDOM('Rows')/rows/row)") +
          value("count(xdXDocument:GetDOM('Db'))") +
          value("count(xdXDocument:GetDOM('Db')/*)") +
          value("count(xdXDocument:GetDOM('Db')/*)") +
          value("count(xdXDocument:GetDOM('Other')/*)"),
      ),
    ),
    '<r/>',
    {
      functions: functionTable({
        now: NOW,
        locale: 'en-US',
        userName: '',
        secondary: new Map([['Rows', 'rows.xml']]),
        file: 'view1.xsl',
      }),
      documents: { 'rows.xml': '<rows><row/><row/></rows>' },
    },
  );
  expect(paras(out.html)).toEqual(['2', '1', '0', '0', '0']);
  expect(out.issues.map((i) => [i.code, i.details])).toEqual([
    ['SECONDARY_DATA_UNAVAILABLE', { dataSource: 'Db' }],
    ['SECONDARY_DATA_UNAVAILABLE', { dataSource: 'Other' }],
  ]);
});

test("xdXDocument:GetNamedNodeProperty returns the caller's default, '' without one (R4.5)", async () => {
  const out = await run(
    value("xdXDocument:GetNamedNodeProperty(., 'IsValidSignature', 'false')") +
      value("xdXDocument:GetNamedNodeProperty(., 'filterVersion')"),
  );
  expect(paras(out.html)).toEqual(['false', '']);
});

test('xdImage:getImageUrl: one element with a base64 raster image gives its data URL; otherwise empty', async () => {
  const png = btoa(
    String.fromCharCode(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13),
  );
  const attachment = 'x0lGQRQAAAABAAAAAAAAAG0AAAARAAAA';
  const out = await run(
    value('xdImage:getImageUrl(/r/png)') +
      value('xdImage:getImageUrl(/r/*)') +
      value('xdImage:getImageUrl(/r/att)') +
      value('xdImage:getImageUrl(/r/text)') +
      value('xdImage:getImageUrl(/r/png/@a)'),
    `<r><png a="${png}">\n${png.slice(0, 8)}\n${png.slice(8)}</png><att>${attachment}</att><text>hello</text></r>`,
  );
  expect(paras(out.html)).toEqual([`data:image/png;base64,${png}`, '', '', '', '']);
  expect(out.budget.output).toBeGreaterThan(`data:image/png;base64,${png}`.length);
});

test('xdDate:Today and xdDate:Now come from now, in its own offset; no clock (R4.5)', async () => {
  const body = value('xdDate:Today()') + value('xdDate:Now()');
  expect(paras((await run(body)).html)).toEqual(['2026-11-03', '2026-11-03T09:00:00']);
  expect(paras((await run(body, '<r/>', { now: '2026-11-10T21:24+07:00' })).html)).toEqual([
    '2026-11-10',
    '2026-11-10T21:24:00',
  ]);
  expect(paras((await run(body, '<r/>', { now: '2026-12-31T23:59:59.999Z' })).html)).toEqual([
    '2026-12-31',
    '2026-12-31T23:59:59',
  ]);
});

test('two renders with different now differ only in the Today and Now values (R4.5)', async () => {
  const body =
    value('xdDate:Today()') + value('xdDate:Now()') + value('concat(/r/a, generate-id(/r))');
  const a = (await run(body, '<r><a>x</a></r>')).html;
  const b = (await run(body, '<r><a>x</a></r>', { now: '2027-01-02T03:04:05+00:00' })).html;
  expect(a).not.toBe(b);
  expect(
    b.replace('2027-01-02T03:04:05', '2026-11-03T09:00:00').replace('2027-01-02', '2026-11-03'),
  ).toBe(a);
});

test('xdMath:Avg: the mean of number(); NaN when empty or a value is not a number', async () => {
  const out = await run(
    value('xdMath:Avg(/r/n)') + value('xdMath:Avg(/r/none)') + value('xdMath:Avg(/r/*)'),
    '<r><n>6</n><n> 12 </n><n>15</n><x>abc</x></r>',
  );
  expect(paras(out.html)).toEqual(['11', 'NaN', 'NaN']);
});

test('xdMath:Nz: blank values become 0, in arithmetic and in sum', async () => {
  const out = await run(
    value('xdMath:Nz(/r/a) + 1') + value('sum(xdMath:Nz(/r/*))') + value('count(xdMath:Nz(/r/*))'),
    '<r><a/><b>2</b><c> </c><d>3.5</d></r>',
  );
  expect(paras(out.html)).toEqual(['1', '5.5', '4']);
});

test("xdMath:Eval: each node as context, with the caller's namespaces; nested calls work", async () => {
  const out = runCompiled(
    await compileText(
      `<xsl:stylesheet version="1.0" xmlns:xsl="${XSL}" xmlns:xdMath="${NS.xdMath}" xmlns:q="urn:q" exclude-result-prefixes="xdMath q">` +
        '<xsl:output method="html"/><xsl:template match="/">' +
        value("sum(xdMath:Eval(/q:r/q:i, 'q:p * q:n'))") +
        value("count(xdMath:Eval(/q:r/q:i, 'q:p'))") +
        value("sum(xdMath:Eval(xdMath:Eval(/q:r/q:i, 'q:p * q:n'), '. * 2'))") +
        value("xdMath:Eval(/q:r/q:none, 'q:p')") +
        '</xsl:template></xsl:stylesheet>',
    ),
    '<r xmlns="urn:q"><i><p>2</p><n>3</n></i><i><p>4.5</p><n>2</n></i></r>',
    { functions: table },
  );
  expect(paras(out.html)).toEqual(['15', '2', '30', '']);
  expect(out.issues).toEqual([]);
});

test('xdMath:Eval never runs JavaScript: a probe that would call a global fails as XPath', async () => {
  const g = globalThis as { aflProbe?: () => string };
  let calls = 0;
  g.aflProbe = () => {
    calls++;
    return 'ran';
  };
  try {
    const out = runCompiled(
      await compileText(
        sheet(
          value("xdMath:Eval(/r, 'globalThis.aflProbe()')") +
            value("xdMath:Eval(/r, 'aflProbe()')") +
            value(
              `xdMath:Eval(/r, 'constructor.constructor(&quot;return globalThis.aflProbe()&quot;)()')`,
            ) +
            value("xdMath:Eval(/r, '1 +')") +
            value("xdMath:Eval(/r, 'globalThis.aflProbe()')"),
        ),
      ),
      '<r>x</r>',
      { functions: functionTable({ now: NOW, locale: 'en-US', userName: '', file: 'view1.xsl' }) },
    );
    expect(calls).toBe(0);
    expect(paras(out.html)).toEqual(['', '', '', '', '']);
    // A dotted name is an XPath function name: unknown, ''. The constructor chain and a bad
    // expression do not compile: '' and one EXPRESSION_FAILED per expression.
    expect(out.issues.map((i) => [i.code, i.details])).toEqual([
      ['UNKNOWN_FUNCTION', { name: 'globalThis.aflProbe', calls: 2 }],
      ['UNKNOWN_FUNCTION', { name: 'aflProbe', calls: 1 }],
      ['EXPRESSION_FAILED', { expr: 'constructor.constructor("return globalThis.aflProbe()")()' }],
      ['EXPRESSION_FAILED', { expr: '1 +' }],
    ]);
  } finally {
    delete g.aflProbe;
  }
});

test('xdUser:get-UserName is the userName input, empty by default (R4.5)', async () => {
  const body = value('xdUser:get-UserName()');
  expect(paras((await run(body)).html)).toEqual(['']);
  expect(paras((await run(body, '<r/>', { userName: 'Test User' })).html)).toEqual(['Test User']);
});

test('msxsl:node-set: a fragment gives its nodes, a node-set itself, a string one text node', async () => {
  const out = await run(
    '<xsl:variable name="v"><b>1</b><b>2</b></xsl:variable>' +
      value('count(msxsl:node-set($v)/b)') +
      value('sum(msxsl:node-set($v)/b)') +
      value('count(msxsl:node-set(/r/a))') +
      value("msxsl:node-set('abc')") +
      value("count(msxsl:node-set('abc'))"),
    '<r><a/><a/><a/></r>',
  );
  expect(paras(out.html)).toEqual(['2', '3', '3', 'abc', '1']);
});

test('msxsl:string-compare: -1, 0, 1 by code units; i folds ASCII case; lang ignored', async () => {
  const out = await run(
    value("msxsl:string-compare('a', 'b')") +
      value("msxsl:string-compare('b', 'a')") +
      value("msxsl:string-compare('2026-11-03', '2026-11-03')") +
      value("msxsl:string-compare('A', 'a')") +
      value("msxsl:string-compare('A', 'a', 'en-US', 'i')") +
      value("msxsl:string-compare('2026-11-04', '2026-11-03', 'vi')"),
  );
  expect(paras(out.html)).toEqual(['-1', '1', '0', '-1', '0', '1']);
});

test('formatString issues: one FORMAT_UNSUPPORTED per type and option, one LOCALE_UNSUPPORTED per locale (task 7)', async () => {
  const f = (v: string, t: string, o: string) =>
    value(`xdFormatting:formatString('${v}', '${t}', '${o}')`);
  const out = await run(
    f('5', 'fraction', '') +
      f('6', 'fraction', '') +
      f('2026-11-03', 'date', 'dateFormat:Medium Date;') +
      f('5', 'currency', 'numDigits:2;currencyLocale:1036;') +
      f('7', 'currency', 'numDigits:2;currencyLocale:1036;'),
    '<r/>',
    { locale: 'vi-VN', file: 'view1.xsl' },
  );
  expect(paras(out.html)).toEqual(['5', '6', '2026-11-03', '$5.00', '$7.00']);
  expect(out.issues.map((i) => [i.code, i.details])).toEqual([
    ['FORMAT_UNSUPPORTED', { type: 'fraction', option: 'type' }],
    ['LOCALE_UNSUPPORTED', { locale: 'vi-VN' }],
    ['FORMAT_UNSUPPORTED', { type: 'date', option: 'dateFormat' }],
    ['LOCALE_UNSUPPORTED', { locale: '1036' }],
  ]);
});
