import { describe, expect, test } from 'vitest';
import { DEFAULT_LIMITS } from '../../src/limits';
import type { XmlElement, XmlText } from '../../src/xml/node';
import { parseXml, xmlContext } from '../../src/xml/parse';
import { NS, qualified } from '../../src/xml/path';
import { encode } from '../helpers/encode';

// Design §7.3, glossary "Path".

const parse = (text: string) =>
  parseXml(encode(text, 'utf-8'), 'm.xsf', xmlContext(DEFAULT_LIMITS)).root;

/** Every element, attribute and text path in document order. */
function paths(e: XmlElement): string[] {
  return [
    e.path,
    ...e.attributes.map((a) => a.path),
    ...e.children.flatMap((c) => (c.kind === 'element' ? paths(c) : [c.path])),
  ];
}

describe('prefixes are fixed, whatever the document uses', () => {
  const variants = [
    `<xsf:a xmlns:xsf="${NS.xsf}"><xsf:b/></xsf:a>`,
    `<foo:a xmlns:foo="${NS.xsf}"><foo:b/></foo:a>`,
    `<a xmlns="${NS.xsf}"><b/></a>`,
  ];
  test.each(variants)('%s', (text) => {
    expect(paths(parse(text))).toEqual(['/xsf:a[1]', '/xsf:a[1]/xsf:b[1]']);
  });

  test('xsf2, xsf3, xsd and xml', () => {
    const root = parse(
      `<xsd:schema xmlns:xsd="${NS.xsd}" xmlns:e="${NS.xsf2}" xmlns:f="${NS.xsf3}" xml:lang="en"><e:x/><f:y/></xsd:schema>`,
    );
    expect(paths(root)).toEqual([
      '/xsd:schema[1]',
      '/xsd:schema[1]/@xml:lang',
      '/xsd:schema[1]/xsf2:x[1]',
      '/xsd:schema[1]/xsf3:y[1]',
    ]);
  });
});

describe('other namespaces and none', () => {
  test('{uri}local for other namespaces; bare local for no namespace', () => {
    const root = parse('<r><my:f xmlns:my="urn:my" my:a="1" b="2"/><plain/></r>');
    expect(paths(root)).toEqual([
      '/r[1]',
      '/r[1]/{urn:my}f[1]',
      '/r[1]/{urn:my}f[1]/@{urn:my}a',
      '/r[1]/{urn:my}f[1]/@b',
      '/r[1]/plain[1]',
    ]);
  });

  test('qualified() with an empty namespace is the local name', () => {
    expect(qualified('', 'x')).toBe('x');
    expect(qualified(null, 'x')).toBe('x');
  });
});

describe('positions', () => {
  test('counted per namespace and local name, not per element', () => {
    const root = parse(
      `<r xmlns:a="urn:a" xmlns:b="urn:b"><a:i/><b:i/><a:i/><j/><a:i/><i/><b:i/></r>`,
    );
    expect(root.children.map((c) => c.path)).toEqual([
      '/r[1]/{urn:a}i[1]',
      '/r[1]/{urn:b}i[1]',
      '/r[1]/{urn:a}i[2]',
      '/r[1]/j[1]',
      '/r[1]/{urn:a}i[3]',
      '/r[1]/i[1]',
      '/r[1]/{urn:b}i[2]',
    ]);
  });

  test('text()[n] counts XPath text nodes: whitespace ones count, comments and elements separate them', () => {
    const root = parse('<r> <a/>one<!--c-->two<![CDATA[+]]>three<b/>\n</r>');
    const texts = root.children.filter((c): c is XmlText => c.kind === 'text');
    // text()[1] is " " (not returned), then "one", then "two+three" (CDATA joined); "\n" is text()[4].
    expect(texts.map((t) => [t.path, t.text])).toEqual([
      ['/r[1]/text()[2]', 'one'],
      ['/r[1]/text()[3]', 'two+three'],
    ]);
  });
});
