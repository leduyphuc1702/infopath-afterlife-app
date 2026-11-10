import { beforeAll, describe, expect, test } from 'vitest';
import {
  buildFormIR,
  parsePackage,
  prepareView,
  renderView,
  type RenderResult,
} from '../../src/index';
import { packageFile } from '../helpers/package';
import { postText } from '../helpers/engine';
import { viewCases, type ViewCase } from '../helpers/render-cases';
import { manifestBytes } from '../helpers/synthetic-manifest';

// Spec 03 task 8 (R6.1, R6.2, R6.4, design §8.1 steps 2–4): package images, the ActiveX
// placeholder and our icons for InfoPath's res:// images.

const NOW = '2026-11-03T09:00:00-08:00';
const XSL = 'http://www.w3.org/1999/XSL/Transform';
const page = (body: string) =>
  `<xsl:stylesheet version="1.0" xmlns:xsl="${XSL}"><xsl:output method="html"/>` +
  `<xsl:template match="/"><html><body>${body}</body></html></xsl:template></xsl:stylesheet>`;
const inner = (html: string) => html.slice(html.indexOf('>') + 1, -'</div>'.length);
const codes = (r: { issues: readonly { code: string; details?: object }[] }) =>
  r.issues.map((i) => [i.code, i.details]);

let cases: ViewCase[];
beforeAll(async () => {
  cases = await viewCases();
});
const render = async (slug: string, record: 'empty' | 'first'): Promise<RenderResult> => {
  const c = cases.find((v) => v.slug === slug)!;
  return renderView(await prepareView(c.t, buildFormIR(c.t)), {
    now: NOW,
    record: c.records[record],
  });
};

describe('R6.1: package images', () => {
  const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
  const view = page(
    '<img src="logo.png"/><img src="./LOGO.PNG"/><img src="notes.txt"/><img src="missing.png"/>' +
      '<img src="sub/logo.png"/><img src="http://h.example/logo.png"/>',
  );
  let result: RenderResult;
  beforeAll(async () => {
    const XSD = 'http://www.w3.org/2001/XMLSchema';
    const t = parsePackage([
      packageFile(
        'manifest.xsf',
        manifestBytes(
          '<xsf:package><xsf:files><xsf:file name="schema.xsd"/><xsf:file name="view1.xsl"/>' +
            '<xsf:file name="logo.png"/><xsf:file name="notes.txt"/></xsf:files></xsf:package>' +
            '<xsf:documentSchemas><xsf:documentSchema rootSchema="yes" location="urn:my schema.xsd"/></xsf:documentSchemas>' +
            '<xsf:views default="V"><xsf:view name="V"><xsf:mainpane transform="view1.xsl"/></xsf:view></xsf:views>',
        ),
      ),
      packageFile(
        'schema.xsd',
        `<xsd:schema targetNamespace="urn:my" xmlns:xsd="${XSD}" elementFormDefault="qualified"><xsd:element name="r" type="xsd:string"/></xsd:schema>`,
      ),
      packageFile('view1.xsl', view),
      packageFile('logo.png', PNG),
      packageFile('notes.txt', 'not an image'),
    ]);
    result = renderView(await prepareView(t, buildFormIR(t)), {
      now: NOW,
      record: new TextEncoder().encode('<my:r xmlns:my="urn:my"/>'),
    });
  });

  test('a relative src naming a package PNG gets a data:image/png source, ignoring case', () => {
    const url = `data:image/png;base64,${btoa(String.fromCharCode(...PNG))}`;
    expect(inner(result.html)).toBe(`<img src="${url}"><img src="${url}"><img><img><img><img>`);
  });

  test('a non-image, a missing file, a folder path and a remote URL are each removed', () => {
    expect(codes(result)).toEqual([['CONTENT_REMOVED', { kind: 'url', count: 4 }]]);
  });
});

describe('R6.2: ActiveX', () => {
  test('form 44: the object becomes the placeholder, with one UNSUPPORTED_CONTROL', async () => {
    const r = await render('44-contract-approval-task', 'first');
    const guid = '61e40d31-993d-4777-8fa0-19ca59b6d0bb';
    const box = new RegExp(
      `<div class="afl-unsupported" style="WIDTH:100%" data-afl-ctrl="[^"]+object\\[1\\]" data-afl-path="[^"]+">Custom control \\{${guid}\\}: not supported</div>`,
    );
    expect(r.html).toMatch(box);
    expect(r.html).not.toMatch(/<object|<param/i);
    const ax = buildFormIR(cases.find((c) => c.slug === '44-contract-approval-task')!.t).activeX;
    expect(r.issues.filter((i) => i.code === 'UNSUPPORTED_CONTROL')).toEqual([
      {
        code: 'UNSUPPORTED_CONTROL',
        message: `view1.xsl: custom control clsid:${guid} is not supported; 1 placeholder(s) drawn`,
        file: 'view1.xsl',
        details: { classid: `clsid:${guid}`, controlId: ax.controls[0]!.id, count: 1 },
      },
    ]);
    // Its param children went with it, uncounted.
    expect(r.issues.filter((i) => i.code === 'CONTENT_REMOVED')).toEqual([]);
  });

  test('a synthetic object: width and height attributes kept as style, counts per classid', async () => {
    const r = await postText(
      page(
        '<object classid="clsid:{{AAAA}}" width="200" height="40" style="color:red;HEIGHT:2em"><param name="x"/></object>' +
          '<object classid="clsid:{{AAAA}}"/><object data="x"><b>fallback</b></object>',
      ),
    );
    expect(inner(r.html)).toBe(
      '<div class="afl-unsupported" style="width:200px;height:40px;HEIGHT:2em">Custom control {AAAA}: not supported</div>' +
        '<div class="afl-unsupported">Custom control {AAAA}: not supported</div><b>fallback</b>',
    );
    expect(codes(r)).toEqual([
      ['UNSUPPORTED_CONTROL', { classid: 'clsid:{AAAA}', count: 2 }],
      ['CONTENT_REMOVED', { kind: 'element', count: 1 }],
    ]);
  });
});

describe('R6.4: InfoPath resources', () => {
  test.each([
    ['calendar.gif', 'calendar'],
    ['CALENDAR.GIF', 'calendar'],
    ['pictureclick.gif', 'picture'],
    ['signaturevalid.gif', 'signature'],
    ['addsignaturebutton.gif', 'signature'],
    ['signatureerror.gif', 'signature'],
  ])('res://infopath.exe/%s becomes the %s icon, uncounted', async (file, icon) => {
    const r = await postText(
      page(`<button><img src="res://InfoPath.exe/${file}" alt="x"/></button>`),
    );
    expect(inner(r.html)).toBe(
      `<button><span class="afl-icon afl-icon-${icon}" aria-hidden="true"></span></button>`,
    );
    expect(r.issues).toEqual([]);
  });

  test('any other res://infopath.exe image becomes a neutral box of its size, named in CONTENT_REMOVED', async () => {
    const r = await postText(
      page(
        '<img src="res://infopath.exe/other.gif" width="24" height="24"/><img src="res://shdoclc.dll/x.gif"/>',
      ),
    );
    expect(inner(r.html)).toBe(
      '<span class="afl-icon afl-icon-unknown" aria-hidden="true" style="width:24px;height:24px"></span><img>',
    );
    expect(codes(r)).toEqual([
      ['CONTENT_REMOVED', { kind: 'url', count: 1 }],
      ['CONTENT_REMOVED', { kind: 'resource', count: 1 }],
    ]);
    expect(r.issues[1]!.message).toBe('view1.xsl: 1 resource item(s) removed: other.gif');
  });

  test("form 02's date pickers and form 06's picture control show the icons; no res: URL is left", async () => {
    const f02 = await render('02-expense-report', 'first');
    expect(f02.html.match(/afl-icon-calendar/g)).toHaveLength(2);
    const f06 = await render('06-safety-incident', 'empty');
    expect(f06.html).toContain(
      '<span class="afl-icon afl-icon-picture" aria-hidden="true"></span>',
    );
    for (const r of [f02, f06]) {
      expect(r.html).not.toMatch(/res:/i);
      expect(r.issues.filter((i) => i.code === 'CONTENT_REMOVED')).toEqual([]);
    }
  });
});
