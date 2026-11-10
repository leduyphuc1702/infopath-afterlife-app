import { describe, expect, test } from 'vitest';
import { postText } from '../helpers/engine';

// Spec 03 task 12 (design §8.2, parser-safe nesting): the tree is rewritten so that no start tag
// makes the HTML parser close an open element, which would let an orphaned end tag close the
// render root. Chromium's own parse of these cases is checked in test/browser/p5.browser.test.ts.

const XSL = 'http://www.w3.org/1999/XSL/Transform';
const view = (body: string) =>
  `<xsl:stylesheet version="1.0" xmlns:xsl="${XSL}"><xsl:output method="html"/>` +
  `<xsl:template match="/"><html><body>${body}</body></html></xsl:template></xsl:stylesheet>`;
const inner = (html: string) => html.slice(html.indexOf('>') + 1, -'</div>'.length);
const render = async (body: string) => {
  const r = await postText(view(body));
  return {
    html: inner(r.html),
    removed: r.issues.filter((i) => i.code === 'CONTENT_REMOVED').map((i) => i.details),
  };
};

describe('select', () => {
  test('holds only option and optgroup; an option holds only text', async () => {
    expect(
      await render(
        '<select><div><select><option>a</option></select></div><optgroup><option><b>b</b></option><span>c</span></optgroup><input/></select><p>out</p>',
      ),
    ).toEqual({
      html: '<select><option>a</option><optgroup><option>b</option>c</optgroup></select><p>out</p>',
      removed: [{ kind: 'element', count: 5 }],
    });
  });
});

describe('elements the parser closes when nested in themselves', () => {
  test.each(['a', 'button', 'nobr'])('%s inside %s is unwrapped, at any depth', async (n) => {
    const r = await render(`<${n}><div><${n}>x</${n}></div></${n}><p>out</p>`);
    expect(r.html).toBe(`<${n}><div>x</div></${n}><p>out</p>`);
    expect(r.removed).toEqual([{ kind: 'element', count: 1 }]);
  });
});

describe('lists', () => {
  test('li stays only in ul or ol; dd and dt only in dl', async () => {
    expect(
      await render(
        '<li><div><li>x</li></div></li><ul><li>a<ol><li>b</li></ol></li></ul><dl><dt>t</dt><dd>d</dd></dl><dd>e</dd>',
      ),
    ).toEqual({
      html: '<div>x</div><ul><li>a<ol><li>b</li></ol></li></ul><dl><dt>t</dt><dd>d</dd></dl>e',
      removed: [{ kind: 'element', count: 3 }],
    });
  });
});

describe('tables', () => {
  test('a well-formed table, and cells the parser completes, are kept as they are', async () => {
    const t =
      '<table><caption>c</caption><colgroup><col/></colgroup><thead><tr><th>h</th></tr></thead>' +
      '<tbody><tr><td>d<table><tr><td>n</td></tr></table></td></tr></tbody></table><table><td>x</td></table>';
    expect(await render(t)).toEqual({ html: t.replace('<col/>', '<col>'), removed: [] });
  });

  test('what a table cannot hold stands before the table, as foster parenting puts it', async () => {
    expect(
      await render(
        '<table><div>a<table><tr><td>i</td></tr></table></div><tr>b<td>c</td><span>d</span></tr></table>',
      ),
    ).toEqual({
      html: '<div>a<table><tr><td>i</td></tr></table></div>b<span>d</span><table><tr><td>c</td></tr></table>',
      removed: [],
    });
  });

  test('a table in a table section or row is fostered; a misplaced table part is unwrapped', async () => {
    expect(
      await render(
        '<table><tr><td><div><table><table><tr><td>x</td></tr></table></table></div></td></tr></table>' +
          '<div><tr><td>y</td></tr></div><table><caption><div><tr>z</tr></div></caption></table>',
      ),
    ).toEqual({
      html:
        '<table><tr><td><div><table><tr><td>x</td></tr></table><table></table></div></td></tr></table>' +
        '<div>y</div><table><caption><div>z</div></caption></table>',
      removed: [{ kind: 'element', count: 3 }],
    });
  });
});
