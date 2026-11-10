import { describe, expect, test } from 'vitest';
import { filterDeclarations, scopeCss, scopeId, type Removed } from '../../src/render/html/css';
import { OWN_CSS } from '../../src/render/html/own-css';
import { postText } from '../helpers/engine';

// Spec 03 task 3 (R5.1 CSS items, R5.5 scoping, design §8.4): one case per filter and scoping
// rule. The browser check of R5.5 is in test/browser/render-dom.browser.test.ts (task 4).

const R = '.afl-root[data-afl-scope="s1"]';
const decls = (text: string) => {
  const removed: Removed = [];
  return { kept: filterDeclarations(text, removed), removed };
};
const sheet = (text: string) => {
  const removed: Removed = [];
  return { css: scopeCss(text, 's1', removed), removed };
};

describe('declaration filter', () => {
  test('ordinary declarations are kept, trimmed, joined by ;', () => {
    expect(decls(' color : red ;; WIDTH:100% ;').kept).toBe('color:red;WIDTH:100%');
  });

  test.each([
    ['width:expression(alert(1))', 'width'],
    ['width:EXPRESSION (alert(1))', 'width'],
    ['width:e\\78pression(alert(1))', 'width'],
    ['width:e\\000078 pression(alert(1))', 'width'],
    ['width:ex/**/pression(alert(1))', 'width'],
    ['behavior:url(x.htc)', 'behavior'],
    ['beh\\61vior:url(#default#x) url(x.htc)', 'behavior'],
    ['-ms-behavior:url(x.htc)', '-ms-behavior'],
    ['-moz-binding:url(x.xml#b)', '-moz-binding'],
    ['background:url(http://h.example/a.png)', 'background'],
    ['background:url( "javascript:x" )', 'background'],
    ['background:u\\72l(http://h.example/a.png)', 'background'],
    ['background:url(data:image/svg+xml;base64,PHN2Zz4=)', 'background'],
    ['background:image("x.png")', 'background'],
    ['background:-webkit-image-set(url(x.png) 1x)', 'background'],
    ['background:element(#x)', 'background'],
    ['background:src("x.png")', 'background'],
    ['font:red @IMPORT "x"', 'font'],
    ['font:red @\\69mport "x"', 'font'],
    ['background:url(data:image/png;base64,AAAA', 'declaration'],
    ['content:"a', 'declaration'],
    ['content:"</style><script>x</script>"', 'declaration'],
    ['color', 'declaration'],
  ])('%s is dropped', (text, name) => {
    expect(decls(`color:red;${text}`)).toEqual({ kept: 'color:red', removed: [name] });
  });

  test('raster data URLs are kept, quoted or not, with whitespace inside url()', () => {
    const png = 'url( "data:image/png;base64,iVBORw0KGgo=" )';
    expect(decls(`background:${png};list-style:url(data:image/gif;base64,R0lG)`).kept).toBe(
      `background:${png};list-style:url(data:image/gif;base64,R0lG)`,
    );
  });

  test("InfoPath's behavior: url(#default#…) is dropped silently, written url(…) or url (…)", () => {
    expect(
      decls(
        'BEHAVIOR: url(#default#urn::controls/Binder) url(#default#Formatting);behavior:url (#default#CalPopup);color:red',
      ),
    ).toEqual({ kept: 'color:red', removed: [] });
  });

  test('comments are removed from what is kept; a string keeps its braces and quotes', () => {
    expect(decls('color:/* c */red;content:"}{\\";/*x*/"').kept).toBe(
      'color:red;content:"}{\\";/*x*/"',
    );
  });
});

describe('scoping (R5.5)', () => {
  test('BODY{…} becomes the root; TABLE{…} gets the root as ancestor', () => {
    expect(sheet('BODY{margin-left:21px;color:windowtext} TABLE{border:0}').css).toBe(
      `${R}{margin-left:21px;color:windowtext}\n${R} TABLE{border:0}`,
    );
  });

  test.each([
    ['html', R],
    [':root', R],
    ['body.x:hover', `${R}.x:hover`],
    ['html body p', `${R} p`],
    ['html > BODY > p', `${R} > p`],
    ['body p, .xdTextBox', `${R} p,${R} .xdTextBox`],
    ['bodyx', `${R} bodyx`],
    ['*', `${R} *`],
    ['td[title="a,b"] > span', `${R} td[title="a,b"] > span`],
    ['a:not(.b, .c)', `${R} a:not(.b, .c)`],
  ])('%s → %s', (selector, scoped) => {
    expect(sheet(`${selector}{color:red}`).css).toBe(`${scoped}{color:red}`);
  });

  test('a selector that does not tokenize cleanly is dropped with its whole list, as in the browser', () => {
    expect(sheet('a[x{color:red} .b,.c{color:blue} p, td({color:green}')).toEqual({
      css: `${R} .b,${R} .c{color:blue}`,
      removed: ['selector', 'selector', 'selector'],
    });
  });

  test('a brace inside a string cannot end the rule early', () => {
    expect(sheet('.a{content:"}body{color:red}"}').css).toBe(`${R} .a{content:"}body{color:red}"}`);
  });

  test('a rule with nothing left is not written', () => {
    expect(
      sheet(
        '.xdBehavior_Boolean{BEHAVIOR: url(#default#urn::controls/Binder) url(#default#BooleanHelper);}',
      ).css,
    ).toBe('');
  });

  test('an unclosed block runs to the end of the sheet, as in the browser', () => {
    expect(sheet('p{color:red').css).toBe(`${R} p{color:red}`);
  });
});

describe('at-rules', () => {
  test.each([
    ['@import url(x.css);', '@import'],
    ['@IMPORT "x.css";', '@import'],
    ['@font-face{font-family:x;src:url(http://h.example/f.woff)}', '@font-face'],
    ['@namespace svg url(http://www.w3.org/2000/svg);', '@namespace'],
    ['@charset "utf-8";', '@charset'],
    ['@page{margin:1cm}', '@page'],
    ['@supports (display:grid){p{color:red}}', '@supports'],
  ])('%s is dropped', (text, name) => {
    expect(sheet(`${text} p{color:red}`)).toEqual({ css: `${R} p{color:red}`, removed: [name] });
  });

  test('@media is kept, with its rules scoped and filtered', () => {
    expect(sheet('@media print{BODY{margin:0} p{width:expression(1);color:red}}').css).toBe(
      `@media print{${R}{margin:0}\n${R} p{color:red}}`,
    );
  });

  test('HTML comment markers around a sheet are ignored', () => {
    expect(sheet('<!-- p{color:red} -->').css).toBe(`${R} p{color:red}`);
  });
});

describe('scope id (D11)', () => {
  test('a 32-bit FNV-1a of URN, version and view: stable, and different per view', () => {
    const a = scopeId('urn:x', '1.0.0.1', 'View 1');
    expect(a).toMatch(/^s[0-9a-f]{8}$/);
    expect(scopeId('urn:x', '1.0.0.1', 'View 1')).toBe(a);
    expect(scopeId('urn:x', '1.0.0.1', 'View 2')).not.toBe(a);
    // FNV-1a of the two LF bytes, computed outside core.
    expect(scopeId('', '', '')).toBe('s878f5675');
  });
});

test('renderView CSS: the view sheets in order, then our own rules', async () => {
  const XSL = 'http://www.w3.org/1999/XSL/Transform';
  const r = await postText(
    `<xsl:stylesheet version="1.0" xmlns:xsl="${XSL}"><xsl:output method="html"/><xsl:template match="/">` +
      '<html><head><style>BODY{color:red} @import url(x.css);</style></head><body><style>TABLE{border:0}</style><p>x</p></body></html>' +
      '</xsl:template></xsl:stylesheet>',
  );
  expect(r.css).toBe(`${R}{color:red}\n${R} TABLE{border:0}\n${OWN_CSS}`);
  expect(r.issues.map((i) => i.details)).toEqual([{ kind: 'css', count: 1 }]);
});
