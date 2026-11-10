import { beforeAll, describe, expect, test } from 'vitest';
import {
  buildFormIR,
  parsePackage,
  prepareView,
  renderView,
  type PreparedView,
} from '../../src/index';
import { attachmentHeader, typeText, MAX_NAME_UNITS } from '../../src/render/attachment';
import { packageFile } from '../helpers/package';
import { r51Items } from '../helpers/r51';
import { viewCases } from '../helpers/render-cases';
import { manifestBytes } from '../helpers/synthetic-manifest';

// Spec 03 R6.7 (task 6, design §9.3): a filled FileAttachment shows our file icon, the file name
// and the size, read from the [MS-IPFFX] §2.1.3.1 header only.

const NOW = '2026-11-03T09:00:00-08:00';

/** An attachment as InfoPath writes it; `patch` edits the bytes before base64. */
function attachment(name: string, file: Uint8Array, patch?: (b: Uint8Array) => Uint8Array): string {
  const units = name.length + 1;
  const b = new Uint8Array(24 + units * 2 + file.length);
  const v = new DataView(b.buffer);
  b.set([0xc7, 0x49, 0x46, 0x41]);
  v.setUint32(4, 20, true);
  v.setUint32(8, 1, true);
  v.setUint32(16, file.length, true);
  v.setUint32(20, units, true);
  for (let i = 0; i < name.length; i++) v.setUint16(24 + 2 * i, name.charCodeAt(i), true);
  b.set(file, 24 + units * 2);
  const out = patch ? patch(b) : b;
  return btoa(String.fromCharCode(...out));
}
const bytes = (n: number) => new Uint8Array(n).fill(0x41);

describe('the header (MS-IPFFX §2.1.3.1)', () => {
  test('name and size; whitespace in the base64 is ignored', () => {
    const b64 = attachment('receipt-01-1.txt', bytes(109));
    expect(attachmentHeader(`\n  ${b64.slice(0, 30)}\n  ${b64.slice(30)}\n`)).toEqual({
      name: 'receipt-01-1.txt',
      size: 109,
    });
  });

  test.each([
    ['not base64', '%%%%', 'base64'],
    ['a truncated fixed header', attachment('a.txt', bytes(3)).slice(0, 16), 'truncated'],
    [
      'a header whose name runs past the data',
      attachment('a.txt', bytes(0), (b) => b.slice(0, 28)),
      'truncated',
    ],
    [
      'another signature',
      attachment('a.txt', bytes(1), (b) => (b.set([0x50, 0x4b]), b)),
      'signature',
    ],
    ['another header size', attachment('a.txt', bytes(1), (b) => (b.set([24], 4), b)), 'header'],
    ['another version', attachment('a.txt', bytes(1), (b) => (b.set([2], 8), b)), 'header'],
    [
      'a name-length overflow (0xFFFFFFFF units)',
      attachment('a.txt', bytes(1), (b) => (b.set([0xff, 0xff, 0xff, 0xff], 20), b)),
      'nameLength',
    ],
    [
      `a name longer than ${MAX_NAME_UNITS} units`,
      attachment('x'.repeat(MAX_NAME_UNITS), bytes(1)),
      'nameLength',
    ],
    ['a name of one unit (no characters)', attachment('', bytes(1)), 'nameLength'],
    [
      'a name with no terminating zero',
      attachment('ab', bytes(1), (b) => (b.set([0x63, 0], 28), b)),
      'name',
    ],
    [
      'a declared size that is not the data size',
      attachment('a.txt', bytes(5), (b) => b.slice(0, -1)),
      'size',
    ],
  ])('%s gives problem %s', (_what, b64, problem) => {
    expect(attachmentHeader(b64)).toEqual({ problem });
  });

  test('only the header is decoded: atob sees the header characters, never the file bytes', () => {
    const b64 = attachment('a.txt', bytes(30_000));
    const seen: number[] = [];
    const real = globalThis.atob;
    globalThis.atob = (data: string) => {
      seen.push(data.length);
      return real(data);
    };
    try {
      expect(attachmentHeader(b64)).toEqual({ name: 'a.txt', size: 30_000 });
    } finally {
      globalThis.atob = real;
    }
    // 24 fixed bytes, then 6 UTF-16 units: 36 bytes, 48 characters at most.
    expect(Math.max(...seen)).toBeLessThanOrEqual(48);
    expect(b64.length).toBeGreaterThan(40_000);
  });
});

test("form 02's first record shows each receipt's icon, name, type and size", async () => {
  const c = (await viewCases()).find((v) => v.slug === '02-expense-report')!;
  const r = renderView(await prepareView(c.t, buildFormIR(c.t)), {
    now: NOW,
    record: c.records.first,
  });
  const shown = [
    ...r.html.matchAll(
      /<span class="afl-attachment afl-attachment-filled" title="([^"]*)"><span class="afl-icon afl-icon-file" aria-hidden="true"><\/span><span class="afl-attachment-text"><span class="afl-attachment-name">([^<]*)<\/span><span class="afl-attachment-type">([^<]*)<\/span><span class="afl-attachment-size">([^<]*)<\/span><\/span><\/span>/g,
    ),
  ].map((m) => [m[1], m[2], m[3], m[4]]);
  expect(shown).toEqual([
    ['receipt-01-1.txt', 'receipt-01-1.txt', 'Text Document', '109 bytes'],
    ['receipt-01-2.txt', 'receipt-01-2.txt', 'Text Document', '110 bytes'],
  ]);
  expect(r.issues.filter((i) => i.code === 'ATTACHMENT_UNREADABLE')).toEqual([]);
  // The empty record has no attachment, so no display.
  const empty = renderView(await prepareView(c.t, buildFormIR(c.t)), {
    now: NOW,
    record: c.records.empty,
  });
  expect(empty.html).not.toContain('afl-attachment');
});

describe('synthetic FileAttachment', () => {
  const XSD = 'http://www.w3.org/2001/XMLSchema';
  let p: PreparedView;
  beforeAll(async () => {
    const view =
      '<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:my="urn:my" ' +
      'xmlns:xd="http://schemas.microsoft.com/office/infopath/2003"><xsl:output method="html"/>' +
      '<xsl:template match="my:r"><html><body><xsl:for-each select="my:f">' +
      '<span class="xdFileAttachment" xd:xctname="FileAttachment" xd:binding="."></span>' +
      '</xsl:for-each></body></html></xsl:template></xsl:stylesheet>';
    const t = parsePackage([
      packageFile(
        'manifest.xsf',
        manifestBytes(
          '<xsf:package><xsf:files><xsf:file name="schema.xsd"/><xsf:file name="view1.xsl"/></xsf:files></xsf:package>' +
            '<xsf:documentSchemas><xsf:documentSchema rootSchema="yes" location="urn:my schema.xsd"/></xsf:documentSchemas>' +
            '<xsf:views default="V"><xsf:view name="V"><xsf:mainpane transform="view1.xsl"/></xsf:view></xsf:views>',
        ),
      ),
      packageFile(
        'schema.xsd',
        `<xsd:schema targetNamespace="urn:my" xmlns:my="urn:my" xmlns:xsd="${XSD}" elementFormDefault="qualified">` +
          '<xsd:element name="r"><xsd:complexType><xsd:sequence><xsd:element ref="my:f" maxOccurs="unbounded"/>' +
          '</xsd:sequence></xsd:complexType></xsd:element><xsd:element name="f" type="xsd:base64Binary" nillable="true"/></xsd:schema>',
      ),
      packageFile('view1.xsl', view),
    ]);
    p = await prepareView(t, buildFormIR(t));
  });
  const render = (...files: string[]) =>
    renderView(p, {
      now: NOW,
      record: new TextEncoder().encode(
        `<my:r xmlns:my="urn:my">${files.map((f) => `<my:f>${f}</my:f>`).join('')}</my:r>`,
      ),
    });

  test('an unreadable header shows the icon alone, with one issue per problem; nothing throws', () => {
    const r = render(
      attachment('a.txt', bytes(3)).slice(0, 16),
      attachment('b.txt', bytes(1), (b) => (b.set([0xff, 0xff, 0xff, 0x7f], 20), b)),
      attachment('c.txt', bytes(1)).slice(0, 20),
      '',
    );
    const icons = r.html.match(
      /<span class="afl-attachment"><span class="afl-icon afl-icon-file" aria-hidden="true"><\/span><\/span>/g,
    );
    expect(icons).toHaveLength(3);
    expect(r.issues.map((i) => [i.code, i.details])).toEqual([
      ['ATTACHMENT_UNREADABLE', { problem: 'truncated', count: 2 }],
      ['ATTACHMENT_UNREADABLE', { problem: 'nameLength', count: 1 }],
    ]);
  });

  test('the file name is record data: markup in it is escaped text (P5)', () => {
    const name = '"><img src=x onerror=alert(1)><script>alert(2)</script>&amp;.txt';
    const r = render(attachment(name, bytes(2)));
    expect(r.html).toContain(
      '<span class="afl-attachment-name">"&gt;&lt;img src=x onerror=alert(1)&gt;&lt;script&gt;alert(2)&lt;/script&gt;&amp;amp;.txt</span>',
    );
    expect(r.html).toContain(
      'title="&quot;&gt;&lt;img src=x onerror=alert(1)&gt;&lt;script&gt;alert(2)&lt;/script&gt;&amp;amp;.txt"',
    );
    expect(r51Items(r.html, r.css)).toEqual([]);
  });
});

test.each([
  ['receipt-01-1.txt', 'Text Document'],
  ['NOTES.TXT', 'Text Document'],
  ['scan.pdf', 'PDF File'],
  ['archive.tar.gz', 'GZ File'],
  ['README', 'File'],
  ['trailing.', 'File'],
])('the type line of %s is %s', (name, type) => {
  expect(typeText(name)).toBe(type);
});
