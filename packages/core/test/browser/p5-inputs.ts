// Inputs of property P5 (spec 03 R8.1, design §11): hostile view XSL and records. The generator
// is adversarial: every piece is something a sanitiser has been known to get wrong. No Node
// imports, so the browser test can use it.
//
// Strings marked "XML source" are written into the XSL or the record as they are, so they may
// hold character references (`jav&#x09;ascript:`) that the XML parser decodes before the engine
// sees them. In XSL attribute values, `{` starts an expression (an AVT), so pools hold no braces
// except where an expression is meant.

import fc from 'fast-check';

export const NS = {
  xhtml: 'http://www.w3.org/1999/xhtml',
  svg: 'http://www.w3.org/2000/svg',
  math: 'http://www.w3.org/1998/Math/MathML',
  xlink: 'http://www.w3.org/1999/xlink',
  xd: 'http://schemas.microsoft.com/office/infopath/2003',
} as const;

/** XML text escaping, for raw strings placed in XSL or record text. */
export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---- pools ------------------------------------------------------------------------------------

/** URL schemes, XML source: mixed case, entity-split, control characters, encoded colons. */
const SCHEMES = [
  'javascript:',
  'JaVaScRiPt:',
  'jav&#x09;ascript:',
  'jav&#x0A;ascript:',
  'jav&#x0D;ascript:',
  'j&#x09;a&#x0A;v&#x0D;ascript:',
  '&#x20;javascript:',
  '&#x09;&#x0A; javascript:',
  '&#106;avascript:',
  '&#x6A;&#x61;&#x76;&#x61;&#x73;&#x63;&#x72;&#x69;&#x70;&#x74;&#x3A;',
  'java&#0000115;cript:',
  'javascript&#58;',
  'javascript&amp;colon;',
  'javascript&amp;#58;',
  'java&#xAD;script:',
  'java&#x200B;script:',
  '&#xFEFF;javascript:',
  'javascript&#x09;:',
  'vbscript:',
  'VBScript&#x09;:',
  'livescript:',
  'x-javascript:',
  'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
  'data:text/html,&lt;script&gt;alert(1)&lt;/script&gt;',
  'DATA:text/html,x',
  'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+',
  'data:image/svg+xml,&lt;svg onload=alert(1)&gt;',
  'data:image/png,raw',
  'data:image/png;base64,iVBORw0KGgo=',
  'DATA:IMAGE/PNG;BASE64,iVBORw0KGgo=',
  'data:image/png;base64,iVBORw0KGgo= ,http://evil.example/x 2x',
  '&#x20;data:image/gif;base64,R0lGODlh',
  'http://evil.example/',
  'HTTPS://evil.example/',
  '//evil.example/',
  '\\\\evil.example\\x',
  'mailto:a@evil.example',
  'file:///etc/passwd',
  'res://infopath.exe/calendar.gif',
  'res://shdoclc.dll/x',
  'blob:https://evil.example/x',
  'jar:file:x!/',
  'ms-its:x.chm::/x',
  'msoxd:;inline;iVBORw0KGgoAAAANSUhEUg==',
  'msoxd:;inline;PHN2Zy8+',
  '',
  'relative/path',
  '#frag',
];
const TAILS = ['alert(1)', '//x', '', '%0Aalert(1)', 'x.png'];

/** Element names: the R5.1 set, the mXSS carriers, and harmless ones, in any case. */
const ELEMENTS = [
  ...['script', 'SCRIPT', 'ScRiPt', 'object', 'embed', 'applet', 'iframe', 'frame'],
  ...['frameset', 'base', 'form', 'link', 'meta', 'style', 'title', 'svg', 'math'],
  ...['noscript', 'template', 'noembed', 'noframes', 'xmp', 'plaintext', 'textarea'],
  ...['select', 'option', 'a', 'A', 'img', 'image', 'input', 'button', 'video', 'audio'],
  ...['source', 'track', 'param', 'area', 'map', 'isindex', 'keygen', 'marquee'],
  ...['details', 'dialog', 'portal', 'body', 'html', 'head', 'table', 'td', 'div'],
  ...['span', 'p', 'foreignObject', 'annotation-xml', 'mglyph', 'malignmark', 'use'],
  ...['animate', 'set', 'x-script', 'listing', 'canvas', 'object'],
  // Start tags the parser lets close open elements (task 12: a root escape went through these).
  ...['tr', 'tbody', 'thead', 'caption', 'colgroup', 'col', 'li', 'dd', 'dt', 'nobr', 'optgroup'],
  ...['ul', 'dl', 'h1', 'h2'],
];
const PREFIXES = ['', '', '', 'h:', 'svg:', 'math:', 'my:', 'xd:'];

/** Namespaces for `xsl:element`/`xsl:attribute`. */
const NAMESPACES = [
  undefined,
  undefined,
  '',
  NS.xhtml,
  NS.svg,
  NS.math,
  NS.xlink,
  NS.xd,
  'urn:evil',
  'http://www.w3.org/XML/1998/namespace',
];

/** Attribute names for literal attributes and for `xsl:attribute`. */
const ATTRS = [
  ...['href', 'HREF', 'src', 'SRC', 'srcset', 'poster', 'background', 'lowsrc', 'dynsrc'],
  ...['data', 'action', 'formaction', 'formAction', 'xlink:href', 'ping', 'srcdoc'],
  ...['style', 'STYLE', 'onclick', 'ONLOAD', 'onMouseOver', 'onerror', 'on', 'onfocusin'],
  ...['id', 'name', 'for', 'form', 'contenteditable', 'tabindex', 'autofocus', 'accesskey'],
  ...['title', 'class', 'xml:base', 'xd:binding', 'data-afl-ctrl', 'data-afl-path'],
  ...['http-equiv', 'content', 'type', 'value', 'is', 'slot', 'popover', 'xmlns:x'],
];

/** CSS declarations, XML source (inside a double-quoted attribute or element text). */
const DECLS = [
  'width:expression(alert(1))',
  'width:EXPRESSION(alert(1))',
  'width:e\\78pression(alert(1))',
  'width:e\\000078pression(alert(1))',
  'width:e\\78 pression(alert(1))',
  'width:exp/**/ression(alert(1))',
  'width:expression\\28 alert(1))',
  'w\\idth:\\65xpression(1)',
  'behavior:url(x.htc)',
  'BEHAVIOR: url(#default#x)',
  'b\\65havior:url(x.htc)',
  'be\\hav\\ior:url(x)',
  '-moz-binding:url(x.xml#y)',
  '-\\6d oz-binding:url(x)',
  '-moz-binding:u\\72l(x)',
  'background:url(javascript:alert(1))',
  'background:u\\72l(javascript:x)',
  'background:\\75rl(x)',
  'background:url( &quot;javascript:x&quot; )',
  "background:url('jav\\61script:x')",
  'background:url(java&#x09;script:x)',
  'background:url(&#x6A;avascript:x)',
  'background:url(x',
  'background-image:url(http://evil.example/x.png)',
  'background:url(data:image/svg+xml;base64,PHN2Zy8+)',
  'background:url(data:image/png;base64,iVBORw0KGgo=)',
  'background:url(&quot;data:image/png;base64,iVBORw0KGgo=&quot;) , url(x)',
  'background:url(data:image/png;base64,iVBORw0KGgo=)url(x)',
  'list-style:url(x)',
  'cursor:url(x),auto',
  'background:image-set(&quot;x.png&quot; 1x)',
  'background:-webkit-image-set(url(x) 1x)',
  'background:image(x.png)',
  'content:src(x)',
  'background:element(#x)',
  '--x:url(javascript:x)',
  '--y:expression(1)',
  'background:var(--x)',
  'color:red',
  'x:y;color:red',
  'color:red;}a{background:url(x)',
  'color:&quot;\\&quot;};@import url(x);',
  'font-family:&quot;a\\&quot;b&quot;',
  '@import &quot;x.css&quot;',
  'color:red /* unterminated',
  'position:fixed;top:0;left:0',
  'mask:url(#x)',
  'filter:url(x.svg#f)',
  'src:url(x.woff)',
];

/** Style element text, XML source. */
const RULES = [
  '@import url(x.css);',
  '@\\69mport url(x);',
  '@IMPORT &quot;x&quot;;',
  '@font-face{font-family:x;src:url(http://evil.example/x.woff)}',
  '@namespace svg url(http://www.w3.org/2000/svg);',
  '@media all{a{background:url(javascript:x)}}',
  '@media screen{body{width:expression(1)}}',
  '@m\\65 dia all{a{color:red}}',
  'a{behavior:url(x)}',
  'a{color:red}',
  'body{background:url(x)}',
  'html,:root,BODY > p{color:red}',
  'a{x:&quot;}&quot;; background:url(x)}',
  'a{}&lt;/style&gt;&lt;script&gt;alert(1)&lt;/script&gt;',
  '}{}a{background:u\\rl(x)}',
  'a/**/{-moz-binding:url(x)}',
  ':root{--x:url(javascript:x)}',
  '@charset &quot;x&quot;;',
  '@page{background:url(x)}',
  '@supports (color:red){a{background:url(x)}}',
  '@layer x{a{background:url(x)}}',
  '@container (min-width:1px){a{background:url(x)}}',
  'a{&amp; b{background:url(x)}}',
  'a{color:red;b{background:url(x)}}',
  '*{color:red}',
  'a[href^=&quot;javascript:&quot;]{color:red}',
  'a{color:red',
  '{color:red}',
  '@media all{',
  '&lt;!--a{color:red}--&gt;',
  'a{background:url(data:image/png;base64,iVBORw0KGgo=)}',
];

/** Rich text copied by `copy-of`, record XML source. */
const RICH = [
  `<svg xmlns="${NS.svg}"><script>alert(1)</script></svg>`,
  `<svg xmlns="${NS.svg}" onload="alert(1)"/>`,
  `<svg xmlns="${NS.svg}"><foreignObject><iframe xmlns="${NS.xhtml}" src="javascript:x"/></foreignObject></svg>`,
  `<svg xmlns="${NS.svg}" xmlns:xlink="${NS.xlink}"><a xlink:href="javascript:x"><text>x</text></a></svg>`,
  `<svg xmlns="${NS.svg}"><style>&lt;img src=x onerror=alert(1)&gt;</style></svg>`,
  `<math xmlns="${NS.math}"><mtext><table><mglyph><style>&lt;img src=x onerror=alert(1)&gt;</style></mglyph></table></mtext></math>`,
  `<math xmlns="${NS.math}"><annotation-xml encoding="text/html"><style>&lt;img src=x onerror=alert(1)&gt;</style></annotation-xml></math>`,
  `<math><mi xlink:href="javascript:x" xmlns:xlink="${NS.xlink}">x</mi></math>`,
  '<noscript><p title="&lt;/noscript&gt;&lt;img src=x onerror=alert(1)&gt;"/></noscript>',
  `<noscript xmlns="${NS.xhtml}">&lt;/noscript&gt;&lt;img src=x onerror=alert(1)&gt;</noscript>`,
  '<template><script>alert(1)</script></template>',
  `<template xmlns="${NS.xhtml}"><img src="x" onerror="alert(1)"/></template>`,
  `<h:div xmlns:h="${NS.xhtml}"><h:script>alert(1)</h:script></h:div>`,
  `<div xmlns="${NS.xhtml}"><iframe srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;"/></div>`,
  `<p xmlns="${NS.xhtml}" style="background:url(javascript:x)">x</p>`,
  `<p style="width:e\\78pression(alert(1))">x</p>`,
  `<a xmlns="${NS.xhtml}" href="jav&#x09;ascript:alert(1)">x</a>`,
  `<form xmlns="${NS.xhtml}" action="javascript:x"><button formaction="javascript:x">b</button></form>`,
  '<textarea>&lt;/textarea&gt;&lt;script&gt;alert(1)&lt;/script&gt;</textarea>',
  '<title>&lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt;</title>',
  '<xmp>&lt;/xmp&gt;&lt;img src=x onerror=alert(1)&gt;</xmp>',
  '<style>@import url(x);</style>',
  '<style>&lt;/style&gt;&lt;script&gt;alert(1)&lt;/script&gt;</style>',
  '<select><template><script>alert(1)</script></template></select>',
  '<select><style>&lt;/select&gt;&lt;img src=x onerror=alert(1)&gt;</style></select>',
  `<table><svg xmlns="${NS.svg}"><a/></svg></table>`,
  '<table><td><textarea>&lt;/table&gt;&lt;img src=x onerror=alert(1)&gt;</textarea></td></table>',
  `<img xmlns="${NS.xhtml}" src="x" onerror="alert(1)"/>`,
  '<object data="javascript:x"><param name="x" value="y"/><embed src="x"/></object>',
  '<a href="https://ok.example/">ok</a>',
  '<p>plain &amp; &lt;b&gt;text&lt;/b&gt;</p>',
  '<div><!-- </div><script>alert(1)</script> --></div>',
  '<p><![CDATA[</p><script>alert(1)</script>]]></p>',
  '<?php echo 1 ?><p>x</p>',
  '<base href="javascript:x/"/>',
  '<meta http-equiv="refresh" content="0;url=javascript:x"/>',
  '<link rel="stylesheet" href="x.css"/>',
  '<input type="image" src="javascript:x" autofocus="autofocus" onfocus="alert(1)"/>',
  '<p id="location" name="cookie">clobber</p><form name="getElementById"/>',
  '<div contenteditable="true" tabindex="1" accesskey="x">e</div>',
  `<a xmlns:xlink="${NS.xlink}" xlink:href="javascript:x">x</a>`,
  '<p xml:base="javascript:/">x</p>',
  '<my:script xmlns:my="urn:my">alert(1)</my:script>',
  '<SCRIPT>alert(1)</SCRIPT>',
  '<iframe><p>x</p></iframe>',
  '<plaintext>&lt;/plaintext&gt;&lt;img src=x onerror=alert(1)&gt;</plaintext>',
  '<a href="javascript:x"><a href="https://ok.example/">nested</a></a>',
  '<p data-afl-ctrl="forged" data-afl-path="/x">forge</p>',
  '<select><div><select></select></div></select><p style="position:fixed">out</p>',
  '<button><div><button>x</button></div></button><p>out</p>',
  '<li><div><li>x</li></div></li><p>out</p>',
  '<dd><div><dt>x</dt></div></dd><p>out</p>',
  '<table><tr><td><div><table><table></table></table></div></td></tr></table><p>out</p>',
  '<table><div><table></table></div></table><p>out</p>',
  '<table><span>x<table></table></span></table><p>out</p>',
  '<td><div><td>x</td></div></td><p>out</p>',
  '<caption><div><tr>x</tr></div></caption><p>out</p>',
  '<select><input/></select><select><div><textarea>t</textarea></div></select><p>out</p>',
  '<nobr><div><nobr>x</nobr></div></nobr><p>out</p>',
  '<a href="https://ok.example/"><div><a href="https://ok.example/">x</a></div></a><p>out</p>',
  '<colgroup><div>x</div></colgroup><tbody><div><tbody/></div></tbody><p>out</p>',
  '<p><span><div>x</div></span></p><h1><div><h2>y</h2></div></h1><p>out</p>',
];

/** Text that looks like markup or attributes, raw (escaped when written). */
const DOE = [
  '"><script>alert(1)</script>',
  '" onmouseover="alert(1)',
  "' onfocus='alert(1)' autofocus='",
  '<img src=x onerror=alert(1)>',
  '</div><script>alert(1)</script>',
  '</div></div></div><img src=x onerror=alert(1)>',
  '<!--',
  '-->',
  ']]>',
  '</textarea><script>alert(1)</script>',
  '</style><script>alert(1)</script>',
  '</title><script>alert(1)</script>',
  'href="javascript:alert(1)"',
  '<svg onload=alert(1)>',
  '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
  '&lt;script&gt;alert(1)&lt;/script&gt;',
  '<a href=javascript:alert(1)>x</a>',
  '<style>@import url(x)</style>',
  '<base href=javascript:/>',
  '<p style="width:expression(alert(1))">',
  '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
];

/** Plain text values for record fields, raw. */
const PLAIN = [...DOE, 'plain', '', '  ', 'a&b', '\u{1F600}', '{x}'];

/** Element names for `{/my:r/my:name}`, valid QNames whose prefixes the XSL declares. */
const NAMES = [
  ...['script', 'iframe', 'svg', 'math', 'style', 'object', 'form', 'base', 'meta', 'link'],
  ...['svg:script', 'h:script', 'h:iframe', 'math:mi', 'noscript', 'template', 'a', 'img'],
];
/** Attribute names for `{/my:r/my:attr}`. */
const ATTR_NAMES = [
  ...['onclick', 'ONLOAD', 'href', 'src', 'style', 'xlink:href', 'formaction', 'srcdoc'],
  ...['on', 'title', 'id', 'background', 'tabindex', 'data-afl-ctrl', 'srcset', 'poster'],
];

/** Wrappers, as open and close tags (literal result elements). */
const WRAPPERS: readonly (readonly [string, string])[] = [
  ['', ''],
  ['', ''],
  ['<p>', '</p>'],
  ['<table><tr><td>', '</td></tr></table>'],
  ['<table>', '</table>'],
  ['<select>', '</select>'],
  ['<textarea>', '</textarea>'],
  ['<title>', '</title>'],
  ['<a href="https://ok.example/">', '</a>'],
  ['<option>', '</option>'],
  ['<style>', '</style>'],
  ['<button>', '</button>'],
  ['<pre>', '</pre>'],
  ['<noscript>', '</noscript>'],
  ['<svg:svg>', '</svg:svg>'],
  ['<h:div>', '</h:div>'],
  ["<xsl:element name=\"{concat('d','iv')}\">", '</xsl:element>'],
  ['<xsl:element name="{/my:r/my:name}">', '</xsl:element>'],
  ['<font face="x">', '</font>'],
  ['<ul><li>', '</li></ul>'],
  ['<li>', '</li>'],
  ['<button><div>', '</div></button>'],
  ['<tr>', '</tr>'],
  ['<td><div>', '</div></td>'],
  ['<table><tr><td><div>', '</div></td></tr></table>'],
  ['<table><div>', '</div></table>'],
  ['<nobr><div>', '</div></nobr>'],
  ['<a href="https://ok.example/"><div>', '</div></a>'],
  ['<dd><div>', '</div></dd>'],
  ['<caption>', '</caption>'],
  ['<select><optgroup>', '</optgroup></select>'],
  ['<h1><div>', '</div></h1>'],
];

// ---- arbitraries ------------------------------------------------------------------------------

const pick = <T>(xs: readonly T[]) => fc.constantFrom(...xs);

/** A hostile URL, XML source. */
const url = fc.tuple(pick(SCHEMES), pick(TAILS)).map(([s, t]) => s + t);
/** A style attribute value, XML source. */
const decls = fc.array(pick(DECLS), { minLength: 1, maxLength: 3 }).map((d) => d.join(';'));

/** A literal result element's attribute value is an AVT: braces are doubled to stay text. */
const avt = (s: string) => s.replace(/[{}]/g, (b) => b + b);

/** An attribute value, XML source, for the attribute `name`. */
const valueFor = (name: string): fc.Arbitrary<string> =>
  name.toLowerCase() === 'style'
    ? decls
    : fc.oneof(url, decls, pick(DOE.map(esc)), fc.constant('x'));

/** A literal attribute ` name="value"`, or `{expr}` built at run time. */
const literalAttr = pick(ATTRS).chain((name) =>
  fc.oneof(
    valueFor(name).map((v) => ` ${name}="${avt(v)}"`),
    fc.constantFrom(
      ` ${name}="{/my:r/my:url}"`,
      ` ${name}="{concat('java','script:alert(1)')}"`,
      ` ${name}="{/my:r/my:plain}"`,
    ),
  ),
);

/** A name for `xsl:element`/`xsl:attribute`: written, or built at run time. */
const runtimeName = (pool: readonly string[], field: string) =>
  fc.oneof(
    pick(pool),
    pick(pool).map((n) => {
      const cut = Math.max(1, Math.floor(n.length / 2));
      return `{concat('${n.slice(0, cut)}','${n.slice(cut)}')}`;
    }),
    pick(pool).map(
      (n) =>
        `{translate('${n.toUpperCase()}','ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')}`,
    ),
    fc.constant(`{/my:r/my:${field}}`),
  );

const nsAttr = pick(NAMESPACES).map((ns) => (ns === undefined ? '' : ` namespace="${ns}"`));

/** `xsl:attribute`, with a value from text, the record or `disable-output-escaping`. */
const xslAttribute = fc
  .record({
    name: runtimeName(ATTRS, 'attr'),
    ns: nsAttr,
    value: fc.oneof(
      url,
      decls,
      fc.constant('<xsl:value-of select="/my:r/my:url"/>'),
      fc.constant('<xsl:value-of select="/my:r/my:plain" disable-output-escaping="yes"/>'),
      pick(DOE).map((d) => `<xsl:text disable-output-escaping="yes">${esc(d)}</xsl:text>`),
    ),
  })
  .map((a) => `<xsl:attribute name="${a.name}"${a.ns}>${a.value}</xsl:attribute>`);

export type ItemKind =
  | 'literal'
  | 'element'
  | 'attribute'
  | 'style'
  | 'styleElement'
  | 'copyOf'
  | 'doe'
  | 'comment'
  | 'rawText';

export interface Item {
  readonly kind: ItemKind;
  /** XSL source of a template body fragment. */
  readonly xsl: string;
}

const leaf = (kind: ItemKind, a: fc.Arbitrary<string>) => a.map((xsl): Item => ({ kind, xsl }));

const content = fc.oneof(
  fc.constant('x'),
  fc.constant('<xsl:value-of select="/my:r/my:plain"/>'),
  pick(DOE).map(esc),
);

const items: fc.Memo<Item> = fc.memo((depth: number) => {
  const child =
    depth <= 1
      ? content
      : fc.oneof(
          content,
          items(depth - 1).map((i) => i.xsl),
        );
  return fc.oneof(
    leaf(
      'literal',
      fc
        .record({
          prefix: pick(PREFIXES),
          name: pick(ELEMENTS),
          attrs: fc.array(literalAttr, { maxLength: 3 }),
          child,
        })
        .map((e) => `<${e.prefix}${e.name}${e.attrs.join('')}>${e.child}</${e.prefix}${e.name}>`),
    ),
    leaf(
      'element',
      fc
        .record({
          name: runtimeName([...ELEMENTS, 'svg:script', 'h:script', 'math:mi', 'svg:a'], 'name'),
          ns: nsAttr,
          attrs: fc.array(xslAttribute, { maxLength: 2 }),
          child,
        })
        .map(
          (e) => `<xsl:element name="${e.name}"${e.ns}>${e.attrs.join('')}${e.child}</xsl:element>`,
        ),
    ),
    leaf(
      'attribute',
      fc
        .record({
          carrier: pick(['a', 'img', 'iframe', 'div', 'form', 'button', 'input', 'base', 'link']),
          attrs: fc.array(xslAttribute, { minLength: 1, maxLength: 3 }),
          child,
        })
        .map((e) => `<${e.carrier}>${e.attrs.join('')}${e.child}</${e.carrier}>`),
    ),
    leaf(
      'style',
      fc
        .record({ tag: pick(['div', 'span', 'p', 'td', 'img', 'a']), d: decls, how: fc.boolean() })
        .map((e) =>
          e.how
            ? `<${e.tag} style="${avt(e.d)}">s</${e.tag}>`
            : `<${e.tag}><xsl:attribute name="style">${e.d}</xsl:attribute>s</${e.tag}>`,
        ),
    ),
    leaf(
      'styleElement',
      fc
        .record({
          rules: fc.array(pick(RULES), { minLength: 1, maxLength: 3 }),
          where: pick(['<style>', '<STYLE>', '<style type="text/css">', '<h:style>']),
          doe: fc.boolean(),
        })
        .map((e) => {
          const close = e.where.startsWith('<h:')
            ? '</h:style>'
            : e.where.startsWith('<STYLE')
              ? '</STYLE>'
              : '</style>';
          const text = e.rules.join(' ');
          return e.doe
            ? `${e.where}<xsl:text disable-output-escaping="yes">${text}</xsl:text>${close}`
            : `${e.where}${text}${close}`;
        }),
    ),
    leaf(
      'copyOf',
      pick([
        '<div><xsl:copy-of select="/my:r/my:rich/node()"/></div>',
        '<xsl:copy-of select="/my:r/my:rich/node()"/>',
        '<xsl:copy-of select="/my:r/my:rich"/>',
        '<span><xsl:copy-of select="/my:r"/></span>',
        '<p><xsl:copy-of select="/my:r/my:rich/*/@*"/></p>',
        '<table><xsl:copy-of select="/my:r/my:rich/node()"/></table>',
        '<xsl:for-each select="/my:r/my:rich/*"><xsl:copy><xsl:copy-of select="@*|node()"/></xsl:copy></xsl:for-each>',
      ]),
    ),
    leaf(
      'doe',
      fc.oneof(
        pick(DOE).map((d) => `<xsl:text disable-output-escaping="yes">${esc(d)}</xsl:text>`),
        fc.constant('<xsl:value-of select="/my:r/my:plain" disable-output-escaping="yes"/>'),
        fc.constant('<xsl:value-of select="/my:r/my:rich" disable-output-escaping="yes"/>'),
        pick(DOE).map(
          (d) =>
            `<p title="t"><xsl:attribute name="class"><xsl:text disable-output-escaping="yes">${esc(d)}</xsl:text></xsl:attribute>d</p>`,
        ),
      ),
    ),
    leaf(
      'comment',
      pick([
        '<xsl:comment>&gt;&lt;script&gt;alert(1)&lt;/script&gt;</xsl:comment>',
        '<xsl:comment><xsl:value-of select="/my:r/my:plain"/></xsl:comment>',
        '<xsl:processing-instruction name="xml-stylesheet">href="javascript:x"</xsl:processing-instruction>',
        '<xsl:processing-instruction name="x">?&gt;&lt;script&gt;alert(1)&lt;/script&gt;</xsl:processing-instruction>',
      ]),
    ),
    leaf(
      'rawText',
      fc
        .record({
          tag: pick(['textarea', 'title', 'xmp', 'option', 'pre', 'noscript', 'style']),
          d: pick(DOE),
        })
        .map((e) => `<${e.tag}>${esc(e.d)}</${e.tag}>`),
    ),
  );
});

export interface P5Input {
  readonly items: readonly Item[];
  readonly wrappers: readonly number[];
  /** Whole page (`html`, `head`, `body`) or a bare fragment. */
  readonly page: boolean;
  readonly head: readonly Item[];
  /** Attributes of `body`, literal. */
  readonly bodyAttrs: readonly string[];
  readonly record: {
    readonly plain: string;
    readonly url: string;
    readonly name: string;
    readonly attr: string;
    readonly rich: readonly string[];
  };
}

export const p5Input: fc.Arbitrary<P5Input> = fc.record({
  items: fc.array(items(3), { minLength: 1, maxLength: 6 }),
  wrappers: fc.array(fc.nat(WRAPPERS.length - 1), { minLength: 6, maxLength: 6 }),
  page: fc.boolean(),
  head: fc.array(items(1), { maxLength: 2 }),
  bodyAttrs: fc.array(literalAttr, { maxLength: 3 }),
  record: fc.record({
    plain: pick(PLAIN),
    url: url,
    name: pick(NAMES),
    attr: pick(ATTR_NAMES),
    rich: fc.array(pick(RICH), { minLength: 1, maxLength: 3 }),
  }),
});

// ---- building ---------------------------------------------------------------------------------

export function viewXsl(input: P5Input): string {
  const body = input.items
    .map((it, i) => {
      const [open, close] = WRAPPERS[input.wrappers[i % input.wrappers.length]!]!;
      return `${open}${it.xsl}${close}`;
    })
    .join('');
  const page = input.page
    ? `<html><head>${input.head.map((h) => h.xsl).join('')}</head>` +
      `<body${input.bodyAttrs.join('')}>${body}</body></html>`
    : body;
  return (
    `<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"` +
    ` xmlns:my="urn:my" xmlns:xd="${NS.xd}" xmlns:h="${NS.xhtml}" xmlns:svg="${NS.svg}"` +
    ` xmlns:math="${NS.math}" xmlns:xlink="${NS.xlink}">` +
    `<xsl:output method="html"/><xsl:template match="/">${page}</xsl:template></xsl:stylesheet>`
  );
}

/** The record, XML source: raw values escaped; the URL and rich text are XML source already. */
export function recordXml(input: P5Input): string {
  const r = input.record;
  return (
    `<?xml version="1.0" encoding="UTF-8"?><my:r xmlns:my="urn:my">` +
    `<my:plain>${esc(r.plain)}</my:plain><my:url>${r.url}</my:url>` +
    `<my:name>${r.name}</my:name><my:attr>${r.attr}</my:attr>` +
    `<my:rich>${r.rich.join('')}</my:rich></my:r>`
  );
}
