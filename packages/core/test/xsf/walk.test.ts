import { describe, expect, test } from 'vitest';
import { DEFAULT_LIMITS } from '../../src/limits';
import { parseXml, xmlContext } from '../../src/xml/parse';
import type { Vocabulary } from '../../src/xsf/vocabulary';
import { walkManifest } from '../../src/xsf/walk';
import { catchError } from '../helpers/catch-error';
import { encode } from '../helpers/encode';

// R13.1–R13.5, R13.7, R13.8; design §8.2. A small test table, not the real vocabulary.

const TABLE: Vocabulary = {
  'xsf:xDocumentClass': {
    attrs: { name: 'string', trustSetting: { enum: ['manual', 'automatic'] } },
    children: { 'xsf:views': 'xsf:views', 'xsf:ruleSets': 'xsf:ruleSets' },
    content: 'elements',
    req: 'test',
  },
  'xsf:views': {
    attrs: {},
    children: { 'xsf:view': 'xsf:view' },
    content: 'elements',
    req: 'test',
  },
  'xsf:view': {
    attrs: { name: 'string', showMenuItem: 'yesNo' },
    children: { 'xsf:editing': 'xsf:editing' },
    content: 'elements',
    req: 'test',
  },
  'xsf:editing': {
    attrs: {},
    children: { 'xsf:fragmentToInsert': 'xsf:fragmentToInsert' },
    content: 'elements',
    req: 'test',
  },
  'xsf:fragmentToInsert': { attrs: {}, children: {}, content: 'rawXml', req: 'test' },
  'xsf:ruleSets': {
    attrs: {},
    children: { 'xsf:rule': 'xsf:rule' },
    content: 'elements',
    req: 'test',
  },
  'xsf:rule': {
    attrs: { caption: 'string' },
    children: { 'xsf:dialogBoxMessageAction': 'xsf:dialogBoxMessageAction' },
    content: 'elements',
    req: 'test',
  },
  'xsf:dialogBoxMessageAction': { attrs: {}, children: {}, content: 'text', req: 'test' },
};

const XSF = 'http://schemas.microsoft.com/office/infopath/2003/solutionDefinition';
const XSF2 = 'http://schemas.microsoft.com/office/infopath/2006/solutionDefinition/extensions';
const ROOT_OPEN = `<xsf:xDocumentClass xmlns:xsf="${XSF}" xmlns:xsf2="${XSF2}" xmlns:x="urn:x"`;

const walk = (xml: string) => {
  const { root } = parseXml(encode(xml, 'utf-8'), 'manifest.xsf', xmlContext(DEFAULT_LIMITS));
  return walkManifest(root, 'manifest.xsf', TABLE);
};

const R = '/xsf:xDocumentClass[1]';

describe('modelled content', () => {
  test('attributes, children and locations', () => {
    const { root, unknowns } = walk(`${ROOT_OPEN} name="urn:a">
  <xsf:views><xsf:view name="V1"/><xsf:view name="V2" showMenuItem="no"/></xsf:views>
</xsf:xDocumentClass>`);
    expect(unknowns).toEqual([]);
    expect(root).toMatchObject({
      key: 'xsf:xDocumentClass',
      file: 'manifest.xsf',
      path: R,
      line: 1,
      column: 1,
      attrs: { name: 'urn:a' },
    });
    const views = root.children[0]!;
    expect(views.children.map((v) => [v.key, v.path, v.attrs, v.line])).toEqual([
      ['xsf:view', `${R}/xsf:views[1]/xsf:view[1]`, { name: 'V1' }, 2],
      ['xsf:view', `${R}/xsf:views[1]/xsf:view[2]`, { name: 'V2', showMenuItem: 'no' }, 2],
    ]);
  });

  test('absent attributes stay absent', () => {
    const { root } = walk(`${ROOT_OPEN}/>`);
    expect(root.attrs).toEqual({});
  });

  test('rawXml content is kept verbatim as inner XML', () => {
    const inner =
      '<xsf:chooseFragment innerFragment="a"><my:item xmlns:my="urn:my">x &amp; y</my:item></xsf:chooseFragment>';
    const { root, unknowns } = walk(
      `${ROOT_OPEN}><xsf:views><xsf:view><xsf:editing><xsf:fragmentToInsert>${inner}</xsf:fragmentToInsert></xsf:editing></xsf:view></xsf:views></xsf:xDocumentClass>`,
    );
    expect(unknowns).toEqual([]);
    const fragment = root.children[0]!.children[0]!.children[0]!.children[0]!;
    expect(fragment.key).toBe('xsf:fragmentToInsert');
    expect(fragment.children).toEqual([]);
    // Verbatim, except that each top-level node re-declares the namespaces it uses, so the payload
    // stands alone (the same serialiser as outerXml).
    expect(fragment.raw).toBe(
      inner.replace('innerFragment="a"', `innerFragment="a" xmlns:xsf="${XSF}"`),
    );
  });

  test('text content is kept verbatim, whitespace and CDATA included', () => {
    const { root, unknowns } = walk(
      `${ROOT_OPEN}><xsf:ruleSets><xsf:rule caption="r"><xsf:dialogBoxMessageAction>  Line one,
  <![CDATA[<two>]]> &amp; three  </xsf:dialogBoxMessageAction></xsf:rule></xsf:ruleSets></xsf:xDocumentClass>`,
    );
    expect(unknowns).toEqual([]);
    const action = root.children[0]!.children[0]!.children[0]!;
    expect(action.text).toBe('  Line one,\n  <two> & three  ');
  });

  test('whitespace-only text content is kept too', () => {
    const { root } = walk(
      `${ROOT_OPEN}><xsf:ruleSets><xsf:rule><xsf:dialogBoxMessageAction>  </xsf:dialogBoxMessageAction></xsf:rule></xsf:ruleSets></xsf:xDocumentClass>`,
    );
    expect(root.children[0]!.children[0]!.children[0]!.text).toBe('  ');
  });
});

describe('unknown entries', () => {
  test('an unknown element is one entry for its whole subtree, with outer XML and line', () => {
    const { root, unknowns } = walk(`${ROOT_OPEN}>
  <xsf:views>
    <xsf:view name="V"><x:panel a="1"><x:inner><xsf:rule caption="deep"/></x:inner></x:panel></xsf:view>
  </xsf:views>
</xsf:xDocumentClass>`);
    expect(unknowns).toEqual([
      {
        kind: 'element',
        reason: 'notModelled',
        file: 'manifest.xsf',
        path: `${R}/xsf:views[1]/xsf:view[1]/{urn:x}panel[1]`,
        line: 3,
        column: 24,
        namespace: 'urn:x',
        name: 'panel',
        raw: `<x:panel a="1" xmlns:x="urn:x"><x:inner><xsf:rule caption="deep" xmlns:xsf="${XSF}"/></x:inner></x:panel>`,
        documented: false,
      },
    ]);
    expect(root.children[0]!.children[0]!.children).toEqual([]);
  });

  test('an unknown attribute on a modelled element is one entry with its value', () => {
    const { root, unknowns } = walk(`${ROOT_OPEN} name="n" x:extra="a&lt;&quot;b"/>`);
    expect(root.attrs).toEqual({ name: 'n' });
    expect(unknowns).toEqual([
      {
        kind: 'attribute',
        reason: 'notModelled',
        file: 'manifest.xsf',
        path: `${R}/@{urn:x}extra`,
        line: 1,
        column: expect.any(Number) as number,
        namespace: 'urn:x',
        name: 'extra',
        raw: 'x:extra="a&lt;&quot;b"',
        documented: false,
      },
    ]);
  });

  test('non-whitespace text in an element-only position is a text entry', () => {
    const { unknowns } = walk(
      `${ROOT_OPEN}><xsf:views> stray <xsf:view/></xsf:views></xsf:xDocumentClass>`,
    );
    expect(unknowns).toEqual([
      expect.objectContaining({
        kind: 'text',
        reason: 'notModelled',
        path: `${R}/xsf:views[1]/text()[1]`,
        namespace: null,
        name: '#text',
        raw: ' stray ',
        documented: false,
      }),
    ]);
  });

  test('an element inside text content is unknown; the text is still kept', () => {
    const { root, unknowns } = walk(
      `${ROOT_OPEN}><xsf:ruleSets><xsf:rule><xsf:dialogBoxMessageAction>a<x:b/>c</xsf:dialogBoxMessageAction></xsf:rule></xsf:ruleSets></xsf:xDocumentClass>`,
    );
    expect(root.children[0]!.children[0]!.children[0]!.text).toBe('ac');
    expect(unknowns.map((u) => [u.kind, u.name])).toEqual([['element', 'b']]);
  });

  test('enum and yesNo values outside their list are kept and reported as unexpectedValue', () => {
    const { root, unknowns } = walk(
      `${ROOT_OPEN} trustSetting="sometimes"><xsf:views><xsf:view showMenuItem="Yes"/></xsf:views></xsf:xDocumentClass>`,
    );
    expect(root.attrs).toEqual({ trustSetting: 'sometimes' });
    expect(root.children[0]!.children[0]!.attrs).toEqual({ showMenuItem: 'Yes' });
    expect(unknowns.map((u) => [u.kind, u.reason, u.path, u.raw, u.documented])).toEqual([
      ['attribute', 'unexpectedValue', `${R}/@trustSetting`, 'trustSetting="sometimes"', true],
      [
        'attribute',
        'unexpectedValue',
        `${R}/xsf:views[1]/xsf:view[1]/@showMenuItem`,
        'showMenuItem="Yes"',
        true,
      ],
    ]);
  });

  test('comments, processing instructions, whitespace and namespace declarations give nothing', () => {
    const { unknowns } = walk(`<?xml version="1.0"?>
<?mso-infoPathSolution name="x"?>
<!-- top -->
${ROOT_OPEN} xmlns="urn:default">
  <!-- inside -->
  <?pi data?>
  <xsf:views xmlns:y="urn:y">

    <xsf:view/>  <!-- c -->
  </xsf:views>
</xsf:xDocumentClass>`);
    expect(unknowns).toEqual([]);
  });

  test('entries come out in document order', () => {
    const { unknowns } = walk(`${ROOT_OPEN} bogus="1">
  <x:a/>
  <xsf:views z="2"><x:b/><xsf:view showMenuItem="maybe"/>text</xsf:views>
  <x:c/>
</xsf:xDocumentClass>`);
    expect(unknowns.map((u) => u.path)).toEqual([
      `${R}/@bogus`,
      `${R}/{urn:x}a[1]`,
      `${R}/xsf:views[1]/@z`,
      `${R}/xsf:views[1]/{urn:x}b[1]`,
      `${R}/xsf:views[1]/xsf:view[1]/@showMenuItem`,
      `${R}/xsf:views[1]/text()[1]`,
      `${R}/{urn:x}c[1]`,
    ]);
  });
});

describe('documented follows ms-ipff2.ts', () => {
  const documented = (xml: string) =>
    walk(xml).unknowns.map((u) => [u.kind === 'attribute' ? `@${u.name}` : u.name, u.documented]);

  test('elements: global and local children by position, nothing else', () => {
    expect(
      documented(`${ROOT_OPEN}>
  <xsf:taskpane/>
  <xsf:view/>
  <x:taskpane/>
  <xsf:ruleSets><xsf:rule><xsf:exitRuleSet/><xsf2:exitRuleSet/><xsf:switchViewAction view="v"/></xsf:rule></xsf:ruleSets>
</xsf:xDocumentClass>`),
    ).toEqual([
      ['taskpane', true], // MS-IPFF2 declares xsf:taskpane under xDocumentClass
      ['view', false], // xsf:view exists, but not here
      ['taskpane', false], // not the InfoPath namespace
      ['exitRuleSet', true], // the local xsf:rule/exitRuleSet
      ['exitRuleSet', false], // same local name, other namespace
      ['switchViewAction', true], // global, referenced from xsf:rule
    ]);
  });

  test('attributes: declared on that position', () => {
    expect(documented(`${ROOT_OPEN} author="a" bogus="b" caption="c"/>`)).toEqual([
      ['@author', true],
      ['@bogus', false],
      ['@caption', false], // declared on xsf:rule, not on xDocumentClass
    ]);
  });
});

describe('the root', () => {
  test('a root other than xsf:xDocumentClass is INVALID_XML', () => {
    const e = catchError(() => walk(`<?xml version="1.0"?>\n  <xsf:views xmlns:xsf="${XSF}"/>`));
    expect(e).toMatchObject({
      code: 'INVALID_XML',
      details: {
        file: 'manifest.xsf',
        line: 2,
        column: 3,
        reason: expect.stringContaining('xDocumentClass') as string,
      },
    });
  });

  test('xDocumentClass in another namespace is not a manifest', () => {
    const e = catchError(() => walk(`<xsf:xDocumentClass xmlns:xsf="${XSF2}"/>`));
    expect(e.code).toBe('INVALID_XML');
  });
});
