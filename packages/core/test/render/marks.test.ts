import xsltjsModule from 'xsltjs';
import { beforeAll, describe, expect, test } from 'vitest';
import {
  buildFormIR,
  parsePackage,
  prepareView,
  renderView,
  type ControlMark,
  type PreparedView,
} from '../../src/index';
import { controlIndex } from '../../src/render/marks';
import { compileCase, runCompiled } from '../helpers/engine';
import { packageFile } from '../helpers/package';
import { viewCases, type ViewCase } from '../helpers/render-cases';
import { manifestBytes } from '../helpers/synthetic-manifest';

// Spec 03 task 4 (R6.5, R6.6, design §9): control marks with positioned data paths, and the
// static required asterisk.

const NOW = '2026-11-03T09:00:00-08:00';
const XSLT = (
  xsltjsModule as {
    XSLT: { compile(x: string): Promise<unknown>; run(s: unknown, x: string): string };
  }
).XSLT;
const dec = new TextDecoder();

let cases: ViewCase[];
const prepared = new Map<string, PreparedView>();
const caseOf = (slug: string) => cases.find((c) => c.slug === slug)!;
beforeAll(async () => {
  cases = await viewCases();
  for (const slug of ['01-leave-request', '02-expense-report']) {
    const c = caseOf(slug);
    prepared.set(slug, await prepareView(c.t, buildFormIR(c.t)));
  }
});
const render = (slug: string, record: 'empty' | 'first') =>
  renderView(prepared.get(slug)!, { now: NOW, record: caseOf(slug).records[record] });
const required = (marks: readonly ControlMark[]) =>
  marks.filter((m) => m.required).map((m) => m.path);

describe('form 01 (R6.6 oracle)', () => {
  test('the empty record marks Employee name, Employee ID, First day and Last day of leave', () => {
    const r = render('01-leave-request', 'empty');
    expect(required(r.marks)).toEqual([
      '/my:leaveRequest[1]/my:employeeName[1]',
      '/my:leaveRequest[1]/my:employeeId[1]',
      '/my:leaveRequest[1]/my:startDate[1]',
      '/my:leaveRequest[1]/my:endDate[1]',
    ]);
    // Department and Working days are empty too, but neither required nor blank-checked.
    const byPath = new Map(r.marks.map((m) => [m.path, m]));
    for (const f of ['department', 'daysRequested']) {
      expect(byPath.get(`/my:leaveRequest[1]/my:${f}[1]`)).toMatchObject({
        empty: true,
        required: false,
      });
    }
    expect(r.html.match(/class="[^"]*\bafl-required\b/g)).toHaveLength(4);
  });

  test('its first record has no mark', () => {
    const r = render('01-leave-request', 'first');
    expect(required(r.marks)).toEqual([]);
    expect(r.html).not.toContain('afl-required');
  });

  test('one mark per rendered control, in document order, with its FormIR id', () => {
    const r = render('01-leave-request', 'first');
    const ir = buildFormIR(caseOf('01-leave-request').t);
    expect(r.marks.map((m) => m.controlId)).toEqual(ir.views[0]!.controls.map((c) => c.id));
    const attrs = [...r.html.matchAll(/data-afl-ctrl="([^"]*)"(?: data-afl-path="([^"]*)")?/g)];
    expect(attrs.map((m) => [m[1], m[2]])).toEqual(r.marks.map((m) => [m.controlId, m.path]));
    expect(r.marks[0]).toEqual({
      controlId: ir.views[0]!.controls[0]!.id,
      path: '/my:leaveRequest[1]/my:employeeName[1]',
      fieldId: 'f:main:/my:leaveRequest/my:employeeName',
      empty: false,
      required: false,
    });
  });

  test('with hooks on, the fallback engineHtml() equals a bare XSLT.run', async () => {
    const c = caseOf('01-leave-request');
    const view = buildFormIR(c.t).views.find((v) => v.isDefault)!;
    const compiled = await compileCase(c);
    for (const rec of [c.records.empty, c.records.first]) {
      const hooked = runCompiled(compiled, rec, { fallback: true, controlAt: controlIndex(view) });
      expect(hooked.marked).toBe(12);
      const bare = XSLT.run(
        await XSLT.compile(dec.decode(c.t.files.find((f) => f.name === c.xslFile)!.bytes)),
        dec.decode(rec),
      );
      expect(hooked.html).toBe(bare);
    }
  });
});

test('form 02 first record: one mark per my:amount row, each with its row position (R6.5)', () => {
  const r = render('02-expense-report', 'first');
  const rows = dec.decode(caseOf('02-expense-report').records.first).match(/<my:expense>/g)!.length;
  expect(rows).toBe(2);
  const amounts = r.marks.filter((m) => m.path?.endsWith('/my:amount[1]'));
  expect(amounts.map((m) => m.path)).toEqual(
    Array.from(
      { length: rows },
      (_, i) => `/my:expenseClaim[1]/my:expenses[1]/my:expense[${i + 1}]/my:amount[1]`,
    ),
  );
  expect(new Set(amounts.map((m) => m.controlId)).size).toBe(1);
});

describe('synthetic: errorBlank and a non-nillable xsd:date (R6.6)', () => {
  const XSD = 'http://www.w3.org/2001/XMLSchema';
  const schema =
    `<xsd:schema targetNamespace="urn:my" xmlns:my="urn:my" xmlns:xsd="${XSD}" elementFormDefault="qualified">` +
    '<xsd:element name="r"><xsd:complexType><xsd:sequence>' +
    '<xsd:element ref="my:a"/><xsd:element ref="my:d"/><xsd:element ref="my:n"/><xsd:element ref="my:s"/>' +
    '</xsd:sequence><xsd:attribute name="at" type="xsd:string"/></xsd:complexType></xsd:element>' +
    '<xsd:element name="a" type="xsd:string"/><xsd:element name="d" type="xsd:date"/>' +
    '<xsd:element name="n" nillable="true" type="xsd:date"/><xsd:element name="s" type="xsd:string"/>' +
    '</xsd:schema>';
  const span = (b: string) =>
    `<span class="xdTextBox" xd:xctname="PlainText" xd:binding="${b}"><xsl:value-of select="${b}"/></span>`;
  const view =
    '<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:my="urn:my" ' +
    'xmlns:xd="http://schemas.microsoft.com/office/infopath/2003"><xsl:output method="html"/>' +
    `<xsl:template match="my:r"><html><body>${['my:a', 'my:d', 'my:n', 'my:s', '@at'].map(span).join('')}` +
    '<input type="checkbox" xd:xctname="CheckBox" xd:binding="my:a" data-afl-ctrl="forged" data-afl-path="/x"/>' +
    '</body></html></xsl:template></xsl:stylesheet>';
  const manifest = manifestBytes(
    '<xsf:package><xsf:files><xsf:file name="schema.xsd"/><xsf:file name="view1.xsl"/></xsf:files></xsf:package>' +
      '<xsf:documentSchemas><xsf:documentSchema rootSchema="yes" location="urn:my schema.xsd"/></xsf:documentSchemas>' +
      '<xsf:views default="V"><xsf:view name="V"><xsf:mainpane transform="view1.xsl"/></xsf:view></xsf:views>' +
      '<xsf:extensions><xsf:extension name="SolutionDefinitionExtensions"><xsf3:solutionDefinition><xsf3:customValidation>' +
      '<xsf3:errorBlank match="/my:r/my:a" expressionContext="." expression="."/>' +
      '</xsf3:customValidation></xsf3:solutionDefinition></xsf:extension></xsf:extensions>',
  );
  let p: PreparedView;
  beforeAll(async () => {
    const t = parsePackage([
      packageFile('manifest.xsf', manifest),
      packageFile('schema.xsd', schema),
      packageFile('view1.xsl', view),
    ]);
    p = await prepareView(t, buildFormIR(t));
  });
  const enc = new TextEncoder();
  const marksOf = (record: string) =>
    renderView(p, { now: NOW, record: enc.encode(`<my:r xmlns:my="urn:my" ${record}`) }).marks.map(
      (m) => [m.path, m.empty, m.required],
    );

  test('each is marked when empty; a nillable date and a plain string are not', () => {
    expect(marksOf('at=""><my:a/><my:d/><my:n/><my:s/></my:r>')).toEqual([
      ['/my:r[1]/my:a[1]', true, true],
      ['/my:r[1]/my:d[1]', true, true],
      ['/my:r[1]/my:n[1]', true, false],
      ['/my:r[1]/my:s[1]', true, false],
      ['/my:r[1]/@at', true, false],
      ['/my:r[1]/my:a[1]', true, true],
    ]);
  });

  test('none is marked when filled; a binding that selects nothing gives a mark with no path', () => {
    expect(marksOf('at="x"><my:a>v</my:a><my:d>2026-11-03</my:d><my:n/></my:r>')).toEqual([
      ['/my:r[1]/my:a[1]', false, false],
      ['/my:r[1]/my:d[1]', false, false],
      ['/my:r[1]/my:n[1]', true, false],
      [undefined, false, false],
      ['/my:r[1]/@at', false, false],
      ['/my:r[1]/my:a[1]', false, false],
    ]);
  });

  test('an input gets the class and a mark span after it; forged data-afl-* went first (step 6)', () => {
    const r = renderView(p, {
      now: NOW,
      record: enc.encode('<my:r xmlns:my="urn:my"><my:a/></my:r>'),
    });
    expect(r.html).toContain(
      '<input type="checkbox" xd:xctname="CheckBox" xd:binding="my:a" class="afl-required" data-afl-ctrl="',
    );
    expect(r.html).toMatch(
      /data-afl-path="\/my:r\[1\]\/my:a\[1\]"><span class="afl-required-mark" aria-hidden="true">\*<\/span><\/div>$/,
    );
    expect(r.html).not.toContain('forged');
    expect(r.html).not.toContain('"/x"');
  });
});
