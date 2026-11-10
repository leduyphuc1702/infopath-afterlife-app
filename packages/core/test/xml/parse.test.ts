import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { DEFAULT_LIMITS } from '../../src/limits';
import type { XmlElement } from '../../src/xml/node';
import { parseXml, xmlContext } from '../../src/xml/parse';
import { catchError } from '../helpers/catch-error';
import { encode } from '../helpers/encode';
import { repoRoot } from '../helpers/samples';

// R5.4–R5.6, design §7.2 steps 1–4.

const parse = (text: string, file = 'manifest.xsf') =>
  parseXml(encode(text, 'utf-8'), file, xmlContext(DEFAULT_LIMITS));
const el = (e: XmlElement | undefined, ...indexes: number[]): XmlElement => {
  let cur = e!;
  for (const i of indexes) cur = cur.children[i] as XmlElement;
  return cur;
};

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<xsf:xDocumentClass xmlns:xsf="http://schemas.microsoft.com/office/infopath/2003/solutionDefinition" xmlns:my="urn:my" name="urn:x">
  <xsf:views default="View 1">
    <xsf:view   name="View 1" my:extra="e"><![CDATA[a]]>b<!--c-->  </xsf:view>
  </xsf:views>
</xsf:xDocumentClass>`;

describe('the tree', () => {
  const { root, encoding, issues } = parse(SAMPLE);

  test('root, names, namespaces and no issues', () => {
    expect(encoding).toBe('utf-8');
    expect(issues).toEqual([]);
    expect(root).toMatchObject({
      kind: 'element',
      localName: 'xDocumentClass',
      name: 'xsf:xDocumentClass',
      namespaceURI: 'http://schemas.microsoft.com/office/infopath/2003/solutionDefinition',
      path: '/xsf:xDocumentClass[1]',
    });
  });

  test('line and column on elements, and on attribute values (R5.6)', () => {
    expect(root).toMatchObject({ line: 2, column: 1 });
    expect(el(root, 0)).toMatchObject({ line: 3, column: 3 });
    const view = el(root, 0, 0);
    expect(view).toMatchObject({ line: 4, column: 5 });
    expect(view.attributes.map((a) => [a.name, a.line, a.column])).toEqual([
      // xmldom places an attribute at the opening quote of its value: name= is at column 17.
      ['name', 4, 22],
      ['my:extra', 4, 40],
    ]);
  });

  test('namespace declarations are not attributes', () => {
    expect(root.attributes.map((a) => a.name)).toEqual(['name']);
  });

  test('attributes keep namespace, value and path', () => {
    expect(el(root, 0, 0).attributes[1]).toEqual({
      kind: 'attribute',
      localName: 'extra',
      namespaceURI: 'urn:my',
      name: 'my:extra',
      value: 'e',
      line: 4,
      column: 40,
      path: '/xsf:xDocumentClass[1]/xsf:views[1]/xsf:view[1]/@{urn:my}extra',
    });
  });

  test('children: elements and non-whitespace text; CDATA joins the text next to it', () => {
    expect(root.children.map((c) => c.kind)).toEqual(['element']);
    const view = el(root, 0, 0);
    expect(view.children).toEqual([
      { kind: 'text', text: 'ab', line: 4, column: 44, path: `${view.path}/text()[1]` },
    ]);
  });

  test('outerXml re-declares the namespaces in scope', () => {
    const xml = el(root, 0, 0).outerXml();
    expect(xml).toContain(
      'xmlns:xsf="http://schemas.microsoft.com/office/infopath/2003/solutionDefinition"',
    );
    expect(xml).toContain('xmlns:my="urn:my"');
    expect(xml).toContain('<![CDATA[a]]>b<!--c-->');
  });
});

describe('errors (R5.4, R5.6)', () => {
  test.each([
    ['mismatched tags (at the open tag)', '<r>\n  <a></b>\n</r>', 2, 3],
    ['duplicate attribute', '<r>\n<a x="1" x="2"/></r>', 2, 1],
    ['unknown entity', '<r>&nbsp;</r>', 1, 1],
    ['two roots', '<r/><s/>', 1, 5],
  ])('%s → INVALID_XML with a position', (_name, text, line, column) => {
    expect(catchError(() => parse(text, 'a.xsd'))).toMatchObject({
      code: 'INVALID_XML',
      details: { file: 'a.xsd', line, column },
    });
  });

  test('an empty document is INVALID_XML at 1:1', () => {
    expect(catchError(() => parse(''))).toMatchObject({
      code: 'INVALID_XML',
      details: { line: 1, column: 1 },
    });
  });

  test('a parser warning is an XML_WARNING issue with a position, not an error', () => {
    const { issues } = parse('<r>\n <a b=c/></r>');
    expect(issues).toEqual([
      expect.objectContaining({ code: 'XML_WARNING', file: 'manifest.xsf', line: 2, column: 2 }),
    ]);
  });

  test('a DOCTYPE is refused before the parser runs', () => {
    expect(catchError(() => parse('<!DOCTYPE r><r/>')).code).toBe('UNSAFE_XML');
  });

  test('an INVALID_ENCODING issue from decoding is passed on (xmldom then warns about U+FFFD)', () => {
    const bytes = new Uint8Array([...encode('<r>', 'utf-8'), 0xff, ...encode('</r>', 'utf-8')]);
    const { issues } = parseXml(bytes, 'x.xml', xmlContext(DEFAULT_LIMITS));
    expect(issues.map((i) => i.code)).toEqual(['INVALID_ENCODING', 'XML_WARNING']);
  });
});

describe('every XML file under samples/own/forms', () => {
  const root = `${repoRoot}samples/own/forms/`;
  const files = readdirSync(root).flatMap((slug) =>
    readdirSync(`${root}${slug}`)
      .filter((n) => /\.(xsf|xsd|xml|xsl)$/i.test(n))
      .map((n) => `${slug}/${n}`),
  );

  test('there are at least 265 of them', () => {
    expect(files.length).toBeGreaterThanOrEqual(265);
  });

  test('all parse with no issue', () => {
    for (const f of files) {
      const { issues } = parseXml(
        new Uint8Array(readFileSync(`${root}${f}`)),
        f,
        xmlContext(DEFAULT_LIMITS),
      );
      expect(issues, f).toEqual([]);
    }
  });
});
