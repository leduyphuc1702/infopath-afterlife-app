import { beforeAll, describe, expect, test } from 'vitest';
import { buildFormIR, prepareView, renderView, type RenderResult } from '../../src/index';
import { functionTable } from '../../src/render/functions';
import { compileCase, postText, runCompiled } from '../helpers/engine';
import { r51Items, startTags } from '../helpers/r51';
import { viewCases, type ViewCase } from '../helpers/render-cases';

// Spec 03 task 3 (R5.1, R5.2, R5.4 attributes, design §8.1–§8.3): one case per sanitiser and
// serialiser rule, on result trees built by real stylesheets, then form 02's render.

const XSL = 'http://www.w3.org/1999/XSL/Transform';
const XD = 'http://schemas.microsoft.com/office/infopath/2003';
const sheet = (page: string, top = '') =>
  `<xsl:stylesheet version="1.0" xmlns:xsl="${XSL}" xmlns:xd="${XD}">${top}` +
  `<xsl:output method="html"/><xsl:template match="/">${page}</xsl:template></xsl:stylesheet>`;
const page = (body: string, head = '', bodyAttrs = '') =>
  sheet(`<html><head>${head}</head><body${bodyAttrs}>${body}</body></html>`);

const ROOT = '<div class="afl-root" data-afl-scope="s1" inert>';
/** The content of the render root. */
const inner = (html: string) => {
  expect(html.startsWith('<div class="afl-root"')).toBe(true);
  return html.slice(html.indexOf('>') + 1, -'</div>'.length);
};
const body = async (b: string, record?: string) => inner((await postText(page(b), record)).html);
const removed = (issues: readonly { code: string; details?: object }[]) =>
  issues.filter((i) => i.code === 'CONTENT_REMOVED').map((i) => i.details);

describe('step 1: structure', () => {
  test('html > body becomes the root div; head is dropped; body attributes move to the root', async () => {
    const r = await postText(
      page(
        '<p>x</p>',
        '<meta http-equiv="Content-Type" content="text/html"/><title>T</title>',
        ' class="b" dir="rtl" lang="vi" style="color:red" onload="x()"',
      ),
    );
    expect(r.html).toBe(
      '<div class="afl-root b" data-afl-scope="s1" dir="rtl" lang="vi" style="color:red" inert><p>x</p></div>',
    );
    expect(removed(r.issues)).toEqual([]);
  });

  test('a fragment with no html element is the root content', async () => {
    expect((await postText(sheet('<p>a</p><p>b</p>'))).html).toBe(`${ROOT}<p>a</p><p>b</p></div>`);
  });

  test('style elements anywhere are collected for the CSS and dropped from the HTML', async () => {
    const r = await postText(
      page('<style>p{color:red}</style><p>x</p>', '<style>td{color:blue}</style>'),
    );
    expect(inner(r.html)).toBe('<p>x</p>');
    expect(r.css.split('\n').slice(0, 2)).toEqual([
      '.afl-root[data-afl-scope="s1"] td{color:blue}',
      '.afl-root[data-afl-scope="s1"] p{color:red}',
    ]);
  });
});

describe('step 5: elements (R5.1)', () => {
  test.each([
    ['script', '<script>alert(1)</script>'],
    ['embed', '<embed src="x.swf"/>'],
    ['applet', '<applet code="X">a</applet>'],
    ['iframe', '<iframe src="http://h.example/"></iframe>'],
    ['frame', '<frame src="x"/>'],
    ['frameset', '<frameset><frame/></frameset>'],
    ['base', '<base href="http://h.example/"/>'],
    ['link', '<link rel="stylesheet" href="x.css"/>'],
    ['meta', '<meta http-equiv="refresh" content="0;url=http://h.example/"/>'],
    ['svg', '<svg><script>x</script></svg>'],
    ['math', '<math><mi>x</mi></math>'],
    ['noscript', '<noscript><p>x</p></noscript>'],
    ['template', '<template><p>x</p></template>'],
  ])('%s is dropped with its content', async (name, markup) => {
    const r = await postText(page(`<p>a</p>${markup}<p>b</p>`));
    expect(inner(r.html)).toBe('<p>a</p><p>b</p>');
    expect(removed(r.issues)[0]).toMatchObject({ kind: 'element' });
    expect(r51Items(r.html, r.css)).toEqual([]);
  });

  test('object and form are unwrapped: the element goes, its children stay; param goes', async () => {
    const r = await postText(
      page(
        '<form action="http://h.example/"><object data="x"><param name="a"/><b>fallback</b></object><input/></form>',
      ),
    );
    expect(inner(r.html)).toBe('<b>fallback</b><input>');
    expect(removed(r.issues)).toEqual([{ kind: 'element', count: 3 }]);
  });

  test('an unknown element is unwrapped and counted; xsl:element can build any name', async () => {
    const r = await postText(
      page(
        '<foo><b>x</b></foo><xsl:element name="script">alert(1)</xsl:element><xsl:element name="SCRIPT">y</xsl:element>',
      ),
    );
    expect(inner(r.html)).toBe('<b>x</b>');
    expect(removed(r.issues)).toEqual([{ kind: 'element', count: 3 }]);
  });

  test('an allowed name in another namespace is unwrapped', async () => {
    expect(
      await body('<s:b xmlns:s="urn:x">t</s:b><h:b xmlns:h="http://www.w3.org/1999/xhtml">u</h:b>'),
    ).toBe('t<b>u</b>');
  });

  test('comments and processing instructions are not written', async () => {
    expect(
      await body(
        '<p><xsl:comment>c</xsl:comment><xsl:processing-instruction name="pi">x</xsl:processing-instruction>t</p>',
      ),
    ).toBe('<p>t</p>');
  });
});

describe('step 5: attributes (R5.1, R5.2)', () => {
  test('every on* attribute goes, in any case and however it was built', async () => {
    const r = await postText(
      page(
        '<p onclick="a()" ONMOUSEOVER="b()" class="k"><xsl:attribute name="onfocus">c()</xsl:attribute>t</p>',
      ),
    );
    expect(inner(r.html)).toBe('<p class="k">t</p>');
    expect(removed(r.issues)).toEqual([{ kind: 'attribute', count: 3 }]);
  });

  test('srcdoc, action, formaction, xlink:href, ping and data-afl-* go', async () => {
    const r = await postText(
      page(
        '<button formaction="http://h.example/" xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="x" data-afl-ctrl="forged" data-afl-path="/x">b</button>' +
          '<a ping="http://h.example/" href="https://ok.example/">a</a><div srcdoc="&lt;p&gt;" action="x">d</div>',
      ),
    );
    expect(inner(r.html)).toBe('<button>b</button><a href="https://ok.example/">a</a><div>d</div>');
    expect(removed(r.issues)).toEqual([{ kind: 'attribute', count: 7 }]);
  });

  test('an attribute name outside the safe pattern goes', async () => {
    const r = await postText(page('<p><xsl:attribute name="a&#xB7;b">x</xsl:attribute>t</p>'));
    expect(inner(r.html)).toBe('<p>t</p>');
    expect(removed(r.issues)).toEqual([{ kind: 'attribute', count: 1 }]);
  });

  test.each([
    ['javascript:alert(1)'],
    ['JaVaScRiPt:alert(1)'],
    ['&#106;avascript:alert(1)'],
    ['java&#x09;script:alert(1)'],
    [' &#x0A;javascript:alert(1)'],
    ['vbscript:x'],
    ['data:text/html,&lt;script&gt;'],
    ['relative/page.html'],
  ])('href %s goes', async (href) => {
    const r = await postText(page(`<a href="${href}">x</a>`));
    expect(inner(r.html)).toBe('<a>x</a>');
    expect(removed(r.issues)).toEqual([{ kind: 'url', count: 1 }]);
  });

  test('href keeps http, https and mailto, on a only', async () => {
    expect(
      await body(
        '<a href="http://a.example/">1</a><a href="HTTPS://b.example/">2</a><a href="mailto:x@y.example">3</a><span href="http://a.example/">4</span>',
      ),
    ).toBe(
      '<a href="http://a.example/">1</a><a href="HTTPS://b.example/">2</a><a href="mailto:x@y.example">3</a><span>4</span>',
    );
  });

  test('loading attributes keep raster data URLs only', async () => {
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    const r = await postText(
      page(
        `<img src="${png}"/><img src="http://h.example/a.png"/><img src="data:image/svg+xml;base64,PHN2Zz4="/>` +
          `<img src="d&#x0A;ata:image/gif;base64,R0lG"/><img srcset="http://h.example/a.png 1x"/>` +
          '<video poster="x.png"/><table background="x.gif"><tr><td>t</td></tr></table>' +
          '<img lowsrc="x" dynsrc="y"/><input type="image" src="javascript:x"/>',
      ),
    );
    expect(inner(r.html)).toBe(
      `<img src="${png}"><img><img><img src="data:image/gif;base64,R0lG"><img><table><tr><td>t</td></tr></table><img><input type="image">`,
    );
    expect(removed(r.issues)).toEqual([
      { kind: 'element', count: 1 },
      { kind: 'url', count: 7 },
    ]);
  });

  test('style, class, title and xd:* stay (R5.2)', async () => {
    expect(
      await body(
        '<span class="xdTextBox" title="Name" style="width:100%" xd:binding="my:a" xd:CtrlId="CTRL1">v</span>',
      ),
    ).toBe(
      '<span class="xdTextBox" title="Name" style="width:100%" xd:binding="my:a" xd:ctrlid="CTRL1">v</span>',
    );
  });

  test('a style attribute goes through the declaration filter; an empty result drops it', async () => {
    const r = await postText(
      page(
        '<p style="color:red;width:expression(alert(1))">a</p><p style="BEHAVIOR: url(#default#CalPopup)">b</p>',
      ),
    );
    expect(inner(r.html)).toBe('<p style="color:red">a</p><p>b</p>');
    expect(removed(r.issues)).toEqual([{ kind: 'css', count: 1 }]);
  });

  test('a repeated attribute keeps its first value', async () => {
    expect(await body('<p title="a" TITLE="b">x</p>')).toBe('<p title="a">x</p>');
  });
});

describe('step 8: inert controls (R5.4)', () => {
  test('editing and focus attributes go silently; id, name and for are prefixed', async () => {
    const r = await postText(
      page(
        '<span contentEditable="true" tabIndex="0" hideFocus="1" accesskey="n" autofocus="autofocus" id="x">v</span>' +
          '<label for="x">L</label><input name="CTRL1_5"/>',
      ),
    );
    expect(inner(r.html)).toBe(
      '<span id="afl-x">v</span><label for="afl-x">L</label><input name="afl-CTRL1_5">',
    );
    expect(removed(r.issues)).toEqual([]);
    expect(r.html.startsWith(ROOT.slice(0, -'inert>'.length))).toBe(true);
    expect(r.html).toMatch(/^<div [^>]* inert>/);
  });
});

describe('serialiser (§8.3)', () => {
  test('text and attribute values are escaped; U+0000 cannot reach the output', async () => {
    const r = await postText(
      page('<p title="{/r/@t}"><xsl:value-of select="/r"/></p>'),
      '<r t="&quot;&gt;&lt;x a=&apos;1&apos;&amp;">&lt;/p&gt;&lt;script&gt;&amp;amp;</r>',
    );
    expect(inner(r.html)).toBe(
      '<p title="&quot;&gt;&lt;x a=\'1\'&amp;">&lt;/p&gt;&lt;script&gt;&amp;amp;</p>',
    );
  });

  test('void elements have no end tag and lose children; names are lowercased', async () => {
    expect(
      await body(
        '<BR/><IMG>x</IMG><Hr/><input><b>y</b></input><wbr/><table><COLGROUP><col/></COLGROUP></table>',
      ),
    ).toBe('<br><img><hr><input><wbr><table><colgroup><col></colgroup></table>');
  });

  test('pre and textarea starting with LF keep it; textarea holds text only', async () => {
    expect(
      await body(
        '<pre><xsl:text>&#10;a</xsl:text></pre><textarea><xsl:text>&#10;b</xsl:text><b>c</b></textarea>',
      ),
    ).toBe('<pre>\n\na</pre><textarea>\n\nbc</textarea>');
  });

  test('disable-output-escaping is ignored, with one OUTPUT_ESCAPING_IGNORED (D6)', async () => {
    const r = await postText(
      page(
        '<p><xsl:value-of disable-output-escaping="yes" select="/r"/></p><p><xsl:text disable-output-escaping="yes">&lt;b&gt;</xsl:text></p>',
      ),
      '<r>&lt;img src=x onerror=alert(1)&gt;</r>',
    );
    expect(inner(r.html)).toBe('<p>&lt;img src=x onerror=alert(1)&gt;</p><p>&lt;b&gt;</p>');
    expect(r.issues).toEqual([
      {
        code: 'OUTPUT_ESCAPING_IGNORED',
        message: 'view1.xsl: disable-output-escaping ignored on 2 text node(s); written as text',
        file: 'view1.xsl',
        details: { nodes: 2 },
      },
    ]);
  });
});

test('CONTENT_REMOVED: one issue per kind, in a fixed order, with counts', async () => {
  const r = await postText(
    page(
      '<p style="behavior:url(x.htc)" onclick="x"><script/><a href="javascript:x">a</a><img src="x"/></p>',
      '<style>@import url(x.css);</style>',
    ),
  );
  expect(r.issues.map((i) => [i.code, i.details])).toEqual([
    ['CONTENT_REMOVED', { kind: 'element', count: 1 }],
    ['CONTENT_REMOVED', { kind: 'attribute', count: 1 }],
    ['CONTENT_REMOVED', { kind: 'url', count: 2 }],
    ['CONTENT_REMOVED', { kind: 'css', count: 2 }],
  ]);
  expect(r.issues[3]!.message).toBe('view1.xsl: 2 css item(s) removed: behavior, @import');
});

describe('form 02 (R5.2 oracle)', () => {
  const NOW = '2026-11-03T09:00:00-08:00';
  let c: ViewCase;
  let result: RenderResult;
  let engine: string;
  beforeAll(async () => {
    c = (await viewCases()).find((v) => v.slug === '02-expense-report')!;
    const t = c.t;
    result = renderView(await prepareView(t, buildFormIR(t)), {
      now: NOW,
      record: c.records.first,
    });
    engine = runCompiled(await compileCase(c), c.records.first, {
      functions: functionTable({ now: NOW, locale: 'en-US', userName: '' }),
    }).html;
  });

  test('keeps the title, class and xd:binding attributes', () => {
    const count = (html: string, attr: string) =>
      startTags(html).reduce(
        (n, t) => n + t.attrs.filter(([a]) => a.toLowerCase() === attr).length,
        0,
      );
    for (const attr of ['title', 'xd:binding']) {
      expect(count(result.html, attr), attr).toBe(count(engine, attr));
      expect(count(result.html, attr), attr).toBeGreaterThan(0);
    }
    // The engine's html and body classes move to the root or go with the element.
    expect(count(result.html, 'class')).toBeGreaterThan(0);
  });

  test('keeps its table structure', () => {
    const shape = (html: string) =>
      startTags(html)
        .filter((t) =>
          ['table', 'tbody', 'thead', 'tfoot', 'tr', 'td', 'th', 'col', 'colgroup'].includes(
            t.name,
          ),
        )
        .map((t) => t.name)
        .join(' ');
    expect(shape(result.html)).toBe(shape(engine));
    expect(shape(result.html)).toContain('table');
  });

  test('contains none of the R5.1 items', () => {
    expect(r51Items(result.html, result.css)).toEqual([]);
    // Only its two res:// date-picker images were removed; task 8 turns them into icons.
    expect(engine.match(/src="res:\/\//g)).toHaveLength(2);
    expect(removed(result.issues)).toEqual([{ kind: 'url', count: 2 }]);
  });
});
